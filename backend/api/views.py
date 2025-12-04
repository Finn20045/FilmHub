from django.views.decorators.csrf import csrf_exempt
import json
from django.contrib.auth import logout
from django.http import JsonResponse, HttpResponseRedirect
from django.views.decorators.csrf import ensure_csrf_cookie
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth.models import User
from .forms import UserSignupForm, UserLoginForm, ProfileForm, RoomCreationForm, MovieSelectionForm
from .models import UserProfile, UserData, Room, Movie
from django.urls import reverse
from django.utils.text import slugify
import random
from django.utils.decorators import method_decorator

def signup_view(request):
    if request.method == 'POST':
        form = UserSignupForm(request.POST)
        if form.is_valid():
            user = form.save()
            age = form.cleaned_data.get('age')
            UserProfile.objects.create(user=user)
            UserData.objects.create(user=user, age=age)
            login(request, user)
            return redirect('profile')
    else:
        form = UserSignupForm()
    return render(request, 'signup.html', {'form': form})

def login_view(request):
    if request.method == 'POST':
        form = UserLoginForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(username=username, password=password)
            if user is not None:
                login(request, user)
                return redirect('profile')
        else:
            messages.error(request, 'Неверное имя пользователя или пароль.')
    else:
        form = UserLoginForm()
    return render(request, 'registration/login.html', {'form': form})


#@login_required
def profile_view(request):
    user_profile = get_object_or_404(UserProfile, user=request.user)
    user_data = get_object_or_404(UserData, user=request.user)

    if request.method == 'POST':
        form = ProfileForm(request.POST, request.FILES, instance=user_profile, user_data=user_data)
        if form.is_valid():
            form.save()
            messages.success(request, 'Профиль успешно обновлен!')
            return redirect('profile')
    else:
        form = ProfileForm(instance=user_profile, user_data=user_data)

    return render(request, 'profile.html', {'form': form})

#@login_required
def user_list_view(request):
    user_data_list = UserData.objects.all()
    return render(request, 'user_list.html', {'user_data_list': user_data_list})

def userLogout(request):
    logout(request)
    response = redirect('PPPP')
    response.delete_cookie('user_id')
    response.delete_cookie('room_name')
    response.delete_cookie('selected_movie')
    return response

def PPPP(request):
    return render(request, 'PPPP.html')

def get_rooms_api(request):
    rooms = Room.objects.values('name', 'description', 'max_participants', 'owner__username', 'participants')
    return JsonResponse(list(rooms), safe=False)


#@login_required
def player_view(request, room_name=None):
    form = RoomCreationForm()
    rooms = Room.objects.all()
    movies = Movie.objects.all()

    room = None
    participants = []
    current_video_url = None

    if not room_name:
        room_name = 'default_room_name'

    print(f"room_name: {room_name}")  # Отладочный вывод

    if room_name:
        try:
            room = Room.objects.get(name=room_name)
            participants = list(room.participants.values_list('username', flat=True))
            current_video_url = room.video.video.url if room and room.video and room.video.video else None

        except Room.DoesNotExist:
            messages.error(request, 'Комната не найдена.')

    return render(request, 'player.html', {
        'form': form,
        'room_name': room_name,
        'rooms': rooms,
        'movies': movies,
        'room': room,
        'participants': participants,
        'current_video_url': current_video_url,
    })



@csrf_exempt
def api_logout(request):
    if request.method == 'POST':
        logout(request) # Удаляет сессию на сервере
        return JsonResponse({'success': True})
    return JsonResponse({'success': False}, status=405)

# Для function-based views
@csrf_exempt
def create_room(request):
    # твой существующий код создания комнаты
    if request.method == 'POST':
        print("Получен POST-запрос:", request.POST)
        form = RoomCreationForm(request.POST)
        movie_id = request.POST.get('movie_id')
        if form.is_valid():
            room = form.save(commit=False)
            room.owner = request.user
            room.current_time = 0.0
            
            if movie_id:
                try:
                    movie = Movie.objects.get(id=movie_id)
                    room.video = movie
                except Movie.DoesNotExist:
                    pass

            room.save()
            room.participants.add(request.user)
            print(f"Комната '{room.name}' успешно создана и сохранена в БД.")

            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({'success': True, 'message': 'Комната успешно создана!', 'room_name': room.name})

            return redirect('player_view', room_name=room.name)
        else:
            print("Ошибки формы: ", form.errors)
            print("Данные POST:", request.POST)
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({'success': False, 'errors': form.errors})
            messages.error(request, "Ошибка при создании комнаты.")
            return redirect('profile')
    return JsonResponse({'success': False, 'error': 'Некорректный запрос.'}, status=400)



#@login_required
def get_room_details(request, room_name):
    try:
        room = Room.objects.get(name=room_name)
        data = {
            'success': True,
            'room': {
                'name': room.name,
                'description': room.description,
                'participants': room.participants.count(),
                'max_participants': room.max_participants,
                'owner': room.owner.username,

            }
        }
        return JsonResponse(data)
    except Room.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Комната не найдена.'}, status=404)

def get_movie_details(request, movie_id):
    try:
        movie = Movie.objects.get(id=movie_id)
        data = {
            'title': movie.title,
            'description': movie.description,
            'poster_url': movie.poster_url,
            'video_url': movie.video_url,
        }
        return JsonResponse({'success': True, 'movie': data})
    except Movie.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Фильм не найден'}, status=404)

# Добавь эту функцию в views.py
def movie_list_api(request):
    """API для получения списка фильмов"""
    movies = Movie.objects.all().values(
        'id', 'title', 'description', 'category', 
        'status', 'views_count', 'poster_url', 'video_url'
    )
    return JsonResponse(list(movies), safe=False)

@csrf_exempt
def join_room(request, room_name):
    try:
        room = Room.objects.get(name=room_name)
        if room.participants.count() >= room.max_participants:
            return JsonResponse({'success': False, 'error': 'Комната заполнена.'}, status=403)

        if room.password and room.password != request.POST.get('password', ''):
            return JsonResponse({'success': False, 'error': 'Неверный пароль.'}, status=403)

        room.participants.add(request.user)
        return JsonResponse({'success': True, 'message': 'Вы успешно присоединились к комнате!'})
    except Room.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Комната не найдена.'}, status=404)

#@login_required
def delete_room(request, room_name):
    try:
        room = Room.objects.get(name=room_name)
        if room.owner == request.user:
            room.delete()
            return JsonResponse({'success': True, 'message': 'Комната успешно удалена!'})
        else:
            return JsonResponse({'success': False, 'error': 'У вас нет прав на удаление этой комнаты.'}, status=403)
    except Room.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Комната не найдена.'}, status=404)



def get_participants(request, room_name):
    room = get_object_or_404(Room, name=room_name)
    participants = list(room.participants.values_list('username', flat=True))
    return JsonResponse({'participants': participants})

@csrf_exempt
def leave_room(request, room_name):
    if request.method == 'POST':
        try:
            room = get_object_or_404(Room, name=room_name)
            user = request.user
            if user in room.participants.all():
                room.participants.remove(user)
                room.save()
                return JsonResponse({'success': True, 'message': 'Вы успешно покинули комнату.'})
            else:
                return JsonResponse({'success': False, 'error': 'Вы не участник этой комнаты.'}, status=400)
        except Room.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Комната не найдена.'}, status=404)
    return JsonResponse({'success': False, 'error': 'Неверный запрос.'}, status=400)

# --- API AUTH VIEWS ---

@csrf_exempt
def api_login(request):
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
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            age = data.get('age')
            email = data.get('email', '')

            if User.objects.filter(username=username).exists():
                return JsonResponse({'success': False, 'error': 'Пользователь с таким именем уже существует'}, status=400)

            # Создаем пользователя
            user = User.objects.create_user(username=username, password=password, email=email)
            
            # Создаем профиль и данные (как в твоих моделях)
            UserProfile.objects.create(user=user)
            UserData.objects.create(user=user, age=age)

            # Сразу логиним
            login(request, user)
            
            return JsonResponse({'success': True, 'username': user.username})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)