import json
from django.contrib.auth import login, authenticate, logout
from django.http import JsonResponse
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from .models import UserProfile, UserData

"""
views.py
Этот файл отвечает за базовую аутентификацию (Вход, Регистрация, Выход).
Мы используем Session Authentication (куки).
"""

@csrf_exempt
def api_login(request):
    """
    Вход пользователя в систему.
    Принимает JSON: {"username": "...", "password": "..."}
    Создает сессию (sessionid в куках).
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            
            user = authenticate(request, username=username, password=password)
            
            if user is not None:
                login(request, user)
                return JsonResponse({'success': True, 'username': user.username})
            else:
                return JsonResponse({'success': False, 'error': 'Неверный логин или пароль'}, status=401)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)

@csrf_exempt
def api_signup(request):
    """
    Регистрация нового пользователя.
    Создает User, UserProfile и UserData.
    Сразу логинит пользователя после создания.
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            age = data.get('age')
            email = data.get('email', '')

            if User.objects.filter(username=username).exists():
                return JsonResponse({'success': False, 'error': 'Пользователь с таким именем уже существует'}, status=400)

            # 1. Создаем пользователя
            user = User.objects.create_user(username=username, password=password, email=email)
            
            # 2. Создаем связанные модели (профиль и данные)
            UserProfile.objects.create(user=user)
            UserData.objects.create(user=user, age=age)

            # 3. Автоматический вход
            login(request, user)
            
            return JsonResponse({'success': True, 'username': user.username})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)

@csrf_exempt
def api_logout(request):
    """
    Выход из системы.
    Удаляет сессию на сервере.
    """
    if request.method == 'POST':
        logout(request)
        return JsonResponse({'success': True})
    return JsonResponse({'success': False}, status=405)