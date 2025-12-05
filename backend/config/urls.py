from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from django.conf import settings

"""
Главный файл маршрутизации (URL Configuration).
Сюда приходят все запросы и распределяются по приложениям.
"""

urlpatterns = [
    # Админ-панель Django
    path('admin/', admin.site.urls),
    
    # Подключение API приложения
    # Все запросы, начинающиеся с 'api/', уходят в api/urls.py
    path('api/', include('api.urls')), 
]

# Настройка раздачи медиа-файлов (картинок и видео) в режиме DEBUG/Docker
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)