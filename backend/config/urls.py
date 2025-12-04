from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from django.conf import settings
from django.middleware.csrf import get_token
from django.http import JsonResponse

# ВАЖНО: Импортируем views из приложения api
from api import views 

def get_csrf_token(request):
    return JsonResponse({'csrfToken': get_token(request)})


urlpatterns = [
    path('admin/', admin.site.urls),
    
    # === ГЛАВНОЕ ИЗМЕНЕНИЕ ЗДЕСЬ ===
    # 1. Мы РАСКОММЕНТИРОВАЛИ эту строку. 
    # Теперь все запросы на api/ идут в наш новый router (api/urls.py).
    path('api/', include('api.urls')), 

    # --- Старые пути (Views) ---
    path('', views.PPPP, name='PPPP'),

    # Аутентификация
    path('login/', views.login_view, name='login'),
    path('logout/', views.userLogout, name='logout'),
    path('signup/', views.signup_view, name='signup'),
    path('profile/', views.profile_view, name='profile'),
    path('accounts/', include('django.contrib.auth.urls')),

    # === СТАРЫЕ КОНФЛИКТЫ (МЫ ИХ ОТКЛЮЧАЕМ) ===
    # 2. Мы ЗАКОММЕНТИРОВАЛИ эти строки, потому что теперь 
    # router (пункт 1) сам обрабатывает фильмы и комнаты лучше нас.
    
    # path('api/movies/', views.movie_list_api, name='movie_list_api'),
    # path('api/movies/<int:movie_id>/', views.get_movie_details, name='get_movie_details'),
    # path('api/rooms/', views.get_rooms_api, name='api_rooms'),

    # Управление пользователями
    path('users/', views.user_list_view, name='user_list'),

    # Комнаты (HTML страницы оставляем, API пути выше убрали)
    path('player/<str:room_name>/', views.player_view, name='player_view'),
    path('player/', views.player_view, name='player_no_room'),
    
    # Остальные специфичные функции пока можно оставить, если они не дублируются в Router
    path('room/<str:room_name>/', views.get_room_details, name='get_room_details'),
    path('create_room/', views.create_room, name='create_room'),
    path('room/<str:room_name>/join/', views.join_room, name='join_room'),
    path('room/<str:room_name>/delete/', views.delete_room, name='delete_room'),
    path('room/<str:room_name>/leave/', views.leave_room, name='leave_room'),
    
    path('api/participants/<str:room_name>/', views.get_participants, name='get_participants'),
    
    # Token
    path('api/csrf_token/', get_csrf_token, name='csrf_token'),

]

# Статические файлы (ОБЯЗАТЕЛЬНО ДЛЯ КАРТИНОК)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)