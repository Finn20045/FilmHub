import os
from django.core.asgi import get_asgi_application

# 1. Сначала указываем настройки
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# 2. ВАЖНО: Инициализируем Django ДО импорта остальных частей
# Это загружает приложения и модели
django_asgi_app = get_asgi_application()

# 3. Только ТЕПЕРЬ импортируем Channels и твой код
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import api.routing 

# 4. Собираем приложение
application = ProtocolTypeRouter({
    "http": django_asgi_app, # Используем уже инициализированное приложение
    "websocket": AuthMiddlewareStack(
        URLRouter(
            api.routing.websocket_urlpatterns
        )
    ),
})