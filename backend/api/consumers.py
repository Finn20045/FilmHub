import json
import hashlib
from urllib.parse import unquote
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from .models import Room, Message, UserProfile

"""
consumers.py
Отвечает за обработку WebSocket соединений (Real-time).
Работает асинхронно.
"""

class PlayerConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """
        Вызывается при попытке подключения клиента (браузера) к сокету.
        """
        # 1. Получаем имя комнаты из URL и декодируем (убираем %20 и т.д.)
        raw_room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_name = unquote(raw_room_name)
        
        # 2. Создаем уникальное имя группы (канала) для Django Channels
        # Хешируем имя комнаты, чтобы избежать проблем со спецсимволами
        safe_group_name = hashlib.md5(self.room_name.encode('utf-8')).hexdigest()
        self.room_group_name = f'room_{safe_group_name}'

        # 3. Добавляем пользователя в эту группу (подписываем на рассылку)
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept() # Одобряем соединение

        # 4. Логика входа участника
        if self.scope["user"].is_authenticated:
            await self.add_participant(self.room_name, self.scope["user"])
            
            # Отправляем всем сообщение: "Имя вошел в комнату"
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'system_message_event',
                    'message': f"{self.scope['user'].username} вошел в комнату"
                }
            )

    async def disconnect(self, close_code):
        """
        Вызывается при закрытии вкладки или потере соединения.
        """
        if self.scope["user"].is_authenticated:
            await self.remove_participant(self.room_name, self.scope["user"])
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'system_message_event',
                    'message': f"{self.scope['user'].username} покинул комнату"
                }
            )

        # Удаляем из группы рассылки
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        """
        Вызывается, когда сервер получает сообщение ОТ клиента.
        """
        try:
            data = json.loads(text_data)
            event_type = data.get('type')

            # --- ЧАТ ---
            if event_type == 'chat_message':
                message = data.get('message')
                username = data.get('username')

                await self.save_message(username, message) # Сохраняем в БД
                user_data = await self.get_user_data(username) # Берем аватарку

                # Рассылаем всем участникам группы
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message_event',
                        'message': message,
                        'username': username,
                        'avatar': user_data['avatar']
                    }
                )

            # --- МОДЕРАЦИЯ (КИК) ---
            elif event_type == 'kick_user':
                target_username = data.get('username')
                request_user = self.scope['user']
                is_owner = await self.check_is_owner(request_user.username)
                
                if is_owner:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'kick_event',
                            'kicked_username': target_username
                        }
                    )

            # --- СИНХРОНИЗАЦИЯ ВИДЕО ---
            # Просто пересылаем команду (play, pause, time) всем остальным
            elif event_type in ['play', 'pause', 'seek', 'sync', 'change_video', 'request_sync', 'response_sync']:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'video_event',
                        'action': event_type,
                        'payload': data,
                        'sender_channel_name': self.channel_name # ID отправителя, чтобы не слать ему обратно
                    }
                )
        except Exception as e:
            print(f"WS Error: {e}")

    # === МЕТОДЫ ОТПРАВКИ (От группы к конкретному сокету) ===

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
        # Не отправляем эхо самому себе
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

    # === DATABASE SYNC (Синхронные методы БД в асинхронном коде) ===

    @database_sync_to_async
    def get_user_data(self, username):
        try:
            user = User.objects.get(username=username)
            if hasattr(user, 'user_profile') and user.user_profile.photo:
                url = user.user_profile.photo.url
                # === ИСПРАВЛЕНИЕ ===
                if 'default' in url:
                    return {'avatar': None}
                # ===================
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
        except Exception as e:
            print(f"Error saving message: {e}")

    @database_sync_to_async
    def check_is_owner(self, username):
        try:
            room = Room.objects.get(name=self.room_name)
            return room.owner.username == username
        except Exception:
            return False