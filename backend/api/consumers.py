import json
import hashlib
from urllib.parse import unquote
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from .models import Room, Message, UserProfile

class PlayerConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        raw_room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_name = unquote(raw_room_name)
        
        # Безопасное имя группы
        safe_group_name = hashlib.md5(self.room_name.encode('utf-8')).hexdigest()
        self.room_group_name = f'room_{safe_group_name}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()

        if self.scope["user"].is_authenticated:
            await self.add_participant(self.room_name, self.scope["user"])
            
            # Системное сообщение о входе
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'system_message_event',
                    'message': f"{self.scope['user'].username} вошел в комнату"
                }
            )

    async def disconnect(self, close_code):
        if self.scope["user"].is_authenticated:
            await self.remove_participant(self.room_name, self.scope["user"])
            
            # Системное сообщение о выходе
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'system_message_event',
                    'message': f"{self.scope['user'].username} покинул комнату"
                }
            )

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            event_type = data.get('type')

            # === ИСПРАВЛЕНИЕ ОШИБКИ ===
            # Определяем username СРАЗУ для всех типов событий
            if self.scope["user"].is_authenticated:
                username = self.scope["user"].username
            else:
                # Если вдруг аноним (хотя у нас стоит защита), берем из данных или ставим дефолт
                username = data.get('username', 'Guest')
            # ===========================

            # === ЧАТ ===
            if event_type == 'chat_message':
                message = data.get('message')
                # Сохраняем
                await self.save_message(username, message)
                # Получаем аватарку
                user_data = await self.get_user_data(username)

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message_event',
                        'message': message,
                        'username': username,
                        'avatar': user_data['avatar']
                    }
                )

            # === ГОЛОСОВОЙ ЧАТ (WEBRTC) ===
            elif event_type in ['webrtc_offer', 'webrtc_answer', 'webrtc_ice_candidate', 'join_voice']:
                target = data.get('target')
                
                # Логирование для отладки
                print(f"📡 [WS] WebRTC: {event_type} from {username} -> {target if target else 'ALL'}")

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'webrtc_signal_event',
                        'sender': username,
                        'action': event_type,
                        'data': data,
                        'target': target,
                        'sender_channel_name': self.channel_name
                    }
                )

            # === МОДЕРАЦИЯ (КИК) ===
            elif event_type == 'kick_user':
                target_username = data.get('username')
                is_owner = await self.check_is_owner(username)
                
                if is_owner:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'kick_event',
                            'kicked_username': target_username
                        }
                    )

            # === ВИДЕО (СИНХРОНИЗАЦИЯ) ===
            elif event_type in ['play', 'pause', 'seek', 'sync', 'change_video', 'request_sync', 'response_sync']:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'video_event',
                        'action': event_type,
                        'payload': data,
                        'sender_channel_name': self.channel_name
                    }
                )
        except Exception as e:
            print(f"🔥 WS Error in receive: {e}")

    # === ОТПРАВЩИКИ СОБЫТИЙ ===

    async def chat_message_event(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'username': event['username'],
            'avatar': event.get('avatar')
        }))

    async def system_message_event(self, event):
        await self.send(text_data=json.dumps({
            'type': 'system',
            'message': event['message']
        }))

    async def video_event(self, event):
        if self.channel_name != event.get('sender_channel_name'):
            await self.send(text_data=json.dumps({
                'type': 'video_event',
                'action': event['action'],
                'data': event['payload']
            }))

    async def kick_event(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_kicked',
            'kicked_username': event['kicked_username']
        }))

    async def webrtc_signal_event(self, event):
        # Не отправляем самому себе
        if self.channel_name == event.get('sender_channel_name'):
            return
        # Если это приватное сообщение (offer/answer/ice) и адресовано не нам -> игнорируем
        target = event.get('target')
        if target and target != self.scope['user'].username:
            return

        await self.send(text_data=json.dumps({
            'type': event['action'],
            'sender': event['sender'],
            'data': event['data']
        }))

    # === РАБОТА С БД ===

    @database_sync_to_async
    def get_user_data(self, username):
        try:
            user = User.objects.get(username=username)
            if hasattr(user, 'user_profile') and user.user_profile.photo:
                url = user.user_profile.photo.url
                if 'default' in url: return {'avatar': None}
                return {'avatar': url}
        except Exception:
            pass
        return {'avatar': None}

    @database_sync_to_async
    def add_participant(self, room_name, user):
        try:
            room = Room.objects.get(name=room_name)
            room.participants.add(user)
        except Room.DoesNotExist:
            pass

    @database_sync_to_async
    def remove_participant(self, room_name, user):
        try:
            room = Room.objects.get(name=room_name)
            room.participants.remove(user)
        except Room.DoesNotExist:
            pass

    @database_sync_to_async
    def save_message(self, username, content):
        try:
            user = User.objects.filter(username=username).first()
            room = Room.objects.filter(name=self.room_name).first()
            if user and room:
                Message.objects.create(user=user, room=room, content=content)
        except Exception:
            pass

    @database_sync_to_async
    def check_is_owner(self, username):
        try:
            room = Room.objects.get(name=self.room_name)
            return room.owner.username == username
        except Exception:
            return False