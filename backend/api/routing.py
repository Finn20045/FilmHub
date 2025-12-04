from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Исправленная регулярка: [^/]+ принимает всё (русский, пробелы, смайлики)
    re_path(r'ws/player/(?P<room_name>[^/]+)/$', consumers.PlayerConsumer.as_asgi()),
]