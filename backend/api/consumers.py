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

        # Логика входа
        if self.scope["user"].is_authenticated:
            await self.add_participant(self.room_name, self.scope["user"])
            
            # 🔔 СИСТЕМНОЕ СООБЩЕНИЕ: Вход
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
            
            # 🔔 СИСТЕМНОЕ СООБЩЕНИЕ: Выход
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
            
            # === ЧАТ ===
            if event_type == 'chat_message':
                message = data.get('message')
                username = data.get('username')

                # Сохраняем в БД
                await self.save_message(username, message)
                
                # Получаем аватарку (синхронно -> асинхронно)
                user_data = await self.get_user_data(username)

                # Рассылаем всем с аватаркой
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message_event',
                        'message': message,
                        'username': username,
                        'avatar': user_data['avatar'] # <--- Новое поле
                    }
                )

            # === МОДЕРАЦИЯ (КИК) ===
            elif event_type == 'kick_user':
                target_username = data.get('username')
                request_user = self.scope['user']

                # Проверка: кикать может только владелец комнаты
                # Нам нужно синхронно получить комнату и проверить владельца
                is_owner = await self.check_is_owner(request_user.username)
                
                if is_owner:
                    # Отправляем всем сообщение, что юзер кикнут
                    # Клиент "жертвы" сам обработает это и выйдет
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'kick_event',
                            'kicked_username': target_username
                        }
                    )

            # === ВИДЕО ===
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
            print(f"WS Error: {e}")

    # === ОТПРАВЩИКИ СОБЫТИЙ ===

    async def chat_message_event(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'username': event['username'],
            'avatar': event.get('avatar') # Пересылаем аватарку фронтенду
        }))

    async def system_message_event(self, event):
        await self.send(text_data=json.dumps({
            'type': 'system', # Тип для фронтенда
            'message': event['message']
        }))

    async def video_event(self, event):
        if self.channel_name != event.get('sender_channel_name'):
            await self.send(text_data=json.dumps({
                'type': 'video_event',
                'action': event['action'],
                'data': event['payload']
            }))

    # Метод отправки события кика
    async def kick_event(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_kicked',
            'kicked_username': event['kicked_username']
        }))

    # === РАБОТА С БД ===

    @database_sync_to_async
    def get_user_data(self, username):
        # Получает URL аватарки пользователя
        try:
            user = User.objects.get(username=username)
            if hasattr(user, 'user_profile') and user.user_profile.photo:
                return {'avatar': user.user_profile.photo.url}
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
        except Exception as e:
            print(f"Error saving message: {e}")

    # Проверка владельца в БД
    @database_sync_to_async
    def check_is_owner(self, username):
        try:
            room = Room.objects.get(name=self.room_name)
            return room.owner.username == username
        except Exception:
            return False