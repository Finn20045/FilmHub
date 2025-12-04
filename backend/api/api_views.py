from django.db.models import Q
from rest_framework.views import APIView 
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework import viewsets, permissions
from rest_framework.authentication import SessionAuthentication, BasicAuthentication
from .models import Movie, Room, Message
from .serializers import MovieSerializer, RoomSerializer, MessageSerializer, FullProfileSerializer
from django.utils import timezone

# === МАГИЯ ЗДЕСЬ ===
# Создаем класс, который отключает проверку CSRF для API
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

class RoomViewSet(viewsets.ModelViewSet):
    # === ВОТ ЭТА СТРОКА ОБЯЗАТЕЛЬНА ДЛЯ ROUTER ===
    queryset = Room.objects.all().order_by('-id') 
    # ============================================
    
    serializer_class = RoomSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    authentication_classes = [CsrfExemptSessionAuthentication, BasicAuthentication]
    lookup_field = 'name'
    
    # Парсеры для приема файлов
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def perform_create(self, serializer):
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
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.last_activity = timezone.now()
        instance.save(update_fields=['last_activity'])
        return super().retrieve(request, *args, **kwargs)

    def perform_destroy(self, instance):
        # Если у комнаты есть видео и оно помечено как приватное -> удаляем видео
        if instance.video and instance.video.is_private:
            instance.video.delete() # Удалит запись и файл (если настроен cleanup, но запись точно)
        
        instance.delete()

    # Метод проверки пароля (оставляем как был)
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