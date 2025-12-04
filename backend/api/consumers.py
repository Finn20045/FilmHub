import json
import hashlib # <--- Добавили библиотеку для хеширования
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from .models import Room, Message
from urllib.parse import unquote

class PlayerConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        raw_room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_name = unquote(raw_room_name)
        
        # --- ОТЛАДКА ---
        print(f"🔌 WS CONNECTING to room: '{self.room_name}'")
        print(f"👤 WS USER: {self.scope['user']}")
        # ----------------

        safe_group_name = hashlib.md5(self.room_name.encode('utf-8')).hexdigest()
        self.room_group_name = f'room_{safe_group_name}'

        if self.scope["user"].is_authenticated:
            await self.add_participant(self.room_name, self.scope["user"])
        else:
            print("⚠️ User is NOT authenticated in WebSocket!")

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Удаляем пользователя из списка
        if self.scope["user"].is_authenticated:
            await self.remove_participant(self.room_name, self.scope["user"])

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Получаем сообщение от WebSocket (от React)
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            event_type = data.get('type')

            # === ЛОГИКА ЧАТА ===
            if event_type == 'chat_message':
                message = data.get('message')
                username = data.get('username')

                # Сохраняем в БД (синхронно, поэтому оборачиваем)
                await self.save_message(username, message)

                # Рассылаем всем в комнате
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message_event',
                        'message': message,
                        'username': username,
                    }
                )

            # === ЛОГИКА ВИДЕО (СИНХРОНИЗАЦИЯ) ===
            elif event_type in ['play', 'pause', 'seek', 'sync', 'change_video', 'request_sync', 'response_sync']:
                # Просто пересылаем это событие всем остальным
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'video_event',
                        'action': event_type,
                        'payload': data, # Время, статус и т.д.
                        'sender_channel_name': self.channel_name # Чтобы не отправлять обратно себе
                    }
                )
        except Exception as e:
            print(f"Ошибка в receive: {e}")

    # === ОТПРАВКА ОБРАТНО НА ФРОНТЕНД ===

    # Событие чата
    async def chat_message_event(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'username': event['username'],
        }))

    # Событие видео
    async def video_event(self, event):
        # Не отправляем событие тому, кто его инициировал (чтобы не было эхо)
        if self.channel_name != event.get('sender_channel_name'):
            await self.send(text_data=json.dumps({
                'type': 'video_event',
                'action': event['action'],
                'data': event['payload'] # Внутри payload уже лежит currentTime
            }))

    # === РАБОТА С БД ===
    @database_sync_to_async
    def save_message(self, username, content):
        try:
            # Ищем пользователя, если не нашли - берем первого или ничего (чтобы не падало)
            user = User.objects.filter(username=username).first()
            if not user:
                return 
            
            # Находим комнату по ИМЕНИ (оригинальному, русскому)
            room = Room.objects.filter(name=self.room_name).first()
            if room:
                Message.objects.create(user=user, room=room, content=content)
        except Exception as e:
            print(f"Error saving message: {e}")

    # === РАБОТА С БД (С ОТЛАДКОЙ) ===
    @database_sync_to_async
    def add_participant(self, room_name, user):
        try:
            room = Room.objects.get(name=room_name)
            room.participants.add(user)
            print(f"✅ User {user} added to room {room_name}")
            print(f"👥 Current participants count: {room.participants.count()}")
        except Room.DoesNotExist:
            print(f"❌ ERROR: Room '{room_name}' not found in DB!")
        except Exception as e:
            print(f"❌ ERROR adding participant: {e}")

    @database_sync_to_async
    def remove_participant(self, room_name, user):
        try:
            room = Room.objects.get(name=room_name)
            room.participants.remove(user)
            print(f"👋 User {user} removed from room {room_name}")
        except Room.DoesNotExist:
            pass