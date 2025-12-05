from django.db.models import Q
from rest_framework.views import APIView 
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework import viewsets, permissions
from rest_framework.authentication import SessionAuthentication, BasicAuthentication
from .models import Movie, Room, Message, Series, Episode
from .serializers import MovieSerializer, RoomSerializer, MessageSerializer, FullProfileSerializer, SeriesSerializer
from django.utils import timezone

# Класс, который отключает проверку CSRF для API
class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        return  # Просто ничего не делаем, пропуская проверку

class MovieViewSet(viewsets.ModelViewSet):
    """
    API для просмотра и редактирования фильмов.
    """
    queryset = Movie.objects.all().order_by('-id')
    serializer_class = MovieSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    authentication_classes = [CsrfExemptSessionAuthentication, BasicAuthentication]

    def get_queryset(self):
        # Если запрашивают список (для выпадающего меню)
        if self.action == 'list':
            user = self.request.user
            if user.is_authenticated:
                # Показываем: (Публичные) ИЛИ (Загруженные мной)
                return Movie.objects.filter(
                    Q(is_private=False) | Q(uploaded_by=user)
                ).order_by('-id')
            else:
                # Гости видят только публичные
                return Movie.objects.filter(is_private=False).order_by('-id')
                
        # Если запрашивают конкретный фильм по ID (плеер) - отдаем любой
        return Movie.objects.all()

class SeriesViewSet(viewsets.ModelViewSet):
    queryset = Series.objects.all().order_by('-id')
    serializer_class = SeriesSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    authentication_classes = [CsrfExemptSessionAuthentication, BasicAuthentication]

class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all().order_by('-id') 
    
    serializer_class = RoomSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    authentication_classes = [CsrfExemptSessionAuthentication, BasicAuthentication]
    lookup_field = 'name'
    
    # Парсеры для приема файлов
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def perform_create(self, serializer):
        user = self.request.user
        data = self.request.data
        video_file = self.request.FILES.get('video_file')
        movie_instance = None
        
        if video_file:
            movie_instance = Movie.objects.create(
                title=f"В комнате: {self.request.data.get('name')}",
                description="Временное видео",
                video=video_file,
                category='A',
                uploaded_by=self.request.user,
                is_private=True  # <--- ВАЖНО: Помечаем как скрытый
            )
        
        if movie_instance:
            serializer.save(owner=self.request.user, video=movie_instance)
        else:
            serializer.save(owner=self.request.user)

        # 2. Выбор Сериала (НОВАЯ ЛОГИКА)
        series_id = data.get('series_id')
        if series_id:
            try:
                series = Series.objects.get(id=series_id)
                # По умолчанию ставим 1-ю серию
                first_episode = series.episodes.order_by('number').first()
                serializer.save(owner=user, active_series=series, active_episode=first_episode)
                return
            except Series.DoesNotExist:
                pass

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.last_activity = timezone.now()
        instance.save(update_fields=['last_activity'])
        return super().retrieve(request, *args, **kwargs)

    def perform_destroy(self, instance):
        # Если у комнаты есть видео и оно помечено как приватное -> удаляем видео
        if instance.video and instance.video.is_private:
            instance.video.delete() # Удалит запись и файл
        
        instance.delete()

    # === МЕТОД ПЕРЕКЛЮЧЕНИЯ СЕРИИ ===
    @action(detail=True, methods=['post'])
    def change_episode(self, request, name=None):
        room = self.get_object()
        # Проверка прав (только владелец)
        if room.owner != request.user:
            return Response({'error': 'Только владелец может переключать серии'}, status=403)

        episode_id = request.data.get('episode_id')
        try:
            episode = Episode.objects.get(id=episode_id)
            # Проверка, что серия от того самого сериала
            if episode.series != room.active_series:
                 return Response({'error': 'Серия не от этого сериала'}, status=400)
            
            room.active_episode = episode
            room.save()
            return Response({'success': True, 'new_url': episode.video.url, 'title': episode.title})
        except Episode.DoesNotExist:
            return Response({'error': 'Серия не найдена'}, status=404)

    # Метод проверки пароля
    @action(detail=True, methods=['post'])
    def verify_password(self, request, name=None):
        room = self.get_object()
        password = request.data.get('password', '')

        if room.password and room.password != password:
            return Response({'success': False, 'error': 'Неверный пароль'}, status=403)
        
        return Response({'success': True})

class MessageViewSet(viewsets.ModelViewSet):
    """
    API для сообщений.
    Позволяет получать сообщения конкретной комнаты.
    """
    queryset = Message.objects.all() 

    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication, BasicAuthentication]

    def get_queryset(self):
        # Получаем параметр room из URL (например: /api/messages/?room=Смотрим кота)
        room_name = self.request.query_params.get('room')
        if room_name:
            # Ищем сообщения только для этой комнаты
            return Message.objects.filter(room__name=room_name).order_by('timestamp')
        return Message.objects.none() # Если комнату не указали, ничего не возвращаем

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class UserProfileView(APIView):
    """
    Получение и обновление профиля текущего пользователя.
    """
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication, BasicAuthentication]
    parser_classes = (MultiPartParser, FormParser) # Чтобы принимать файлы (фото)

    def get(self, request):
        serializer = FullProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = FullProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)