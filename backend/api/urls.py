from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import api_views  # Вьюсеты (MovieViewSet, etc)
from . import views      # Обычные функции (api_login, api_signup)

# Создаем роутер и регистрируем наши ViewSet
router = DefaultRouter()
router.register(r'movies', api_views.MovieViewSet)
router.register(r'rooms', api_views.RoomViewSet)
router.register(r'messages', api_views.MessageViewSet)

urlpatterns = [
    # 1. Сначала подключаем пути Роутера (api/movies/, api/rooms/)
    path('', include(router.urls)),

    # 2. Добавляем наши пути авторизации
    # Обрати внимание: мы НЕ пишем 'api/' в начале, так как этот файл уже подключен по адресу 'api/'
    path('auth/login/', views.api_login, name='api_login'),
    path('auth/signup/', views.api_signup, name='api_signup'),
    path('auth/logout/', views.api_logout, name='api_logout'),
    path('profile/me/', api_views.UserProfileView.as_view(), name='user_profile'),
]