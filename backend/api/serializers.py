from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Movie, Room, Message, UserData, UserProfile, Series, Episode

# --- Сериализаторы пользователя ---

class UserSerializer(serializers.ModelSerializer):
    """Базовый сериализатор для User"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class UserDataSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = UserData
        fields = ['user', 'age', 'country', 'gender']

class UserProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = UserProfile
        fields = ['user', 'photo']

# --- Сериализаторы контента ---

class EpisodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Episode
        fields = ['id', 'number', 'title', 'video']

class SeriesSerializer(serializers.ModelSerializer):
    # Включаем список эпизодов внутрь сериала
    episodes = EpisodeSerializer(many=True, read_only=True)
    
    class Meta:
        model = Series
        fields = ['id', 'title', 'description', 'image', 'episodes', 'is_private']

class MovieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Movie
        fields = '__all__' # Отдаем все поля фильма

class RoomSerializer(serializers.ModelSerializer):
    owner_name = serializers.ReadOnlyField(source='owner.username')
    is_protected = serializers.SerializerMethodField()
    participants_count = serializers.IntegerField(source='participants.count', read_only=True)
    
    # Вложенные объекты (чтобы фронт знал, что именно играет)
    active_series = SeriesSerializer(read_only=True)
    active_episode = EpisodeSerializer(read_only=True)
    
    # Умные поля (вычисляются на лету)
    current_video_url = serializers.SerializerMethodField()
    current_poster_url = serializers.SerializerMethodField()
    current_title = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = [
            'id', 'name', 'description', 'max_participants', 
            'owner', 'owner_name', 
            'video',          # Объект фильма (если выбран фильм)
            'active_series',  # Объект сериала (если выбран сериал)
            'active_episode', # Текущая серия
            'current_video_url', 'current_poster_url', 'current_title', # <-- Умные поля
            'participants_count', 'is_protected', 'password'
        ]
        read_only_fields = ['owner']
        extra_kwargs = {'password': {'write_only': True}}

    def get_is_protected(self, obj):
        return bool(obj.password and obj.password.strip())

    # === ЛОГИКА ВЫБОРА КОНТЕНТА ===
    
    def get_current_video_url(self, obj):
        # 1. Если выбран сериал и серия -> отдаем видео серии
        if obj.active_episode and obj.active_episode.video:
            return obj.active_episode.video.url
        # 2. Если выбран фильм (загруженный файл)
        if obj.video and obj.video.video:
            return obj.video.video.url
        # 3. Если выбран фильм (ссылка)
        if obj.video and obj.video.video_url:
            return obj.video.video_url
        return None

    def get_current_poster_url(self, obj):
        # 1. Постер сериала
        if obj.active_series and obj.active_series.image:
            return obj.active_series.image.url
        # 2. Постер фильма (файл)
        if obj.video and obj.video.image:
            return obj.video.image.url
        # 3. Постер фильма (ссылка)
        if obj.video and obj.video.poster_url:
            return obj.video.poster_url
        return None

    def get_current_title(self, obj):
        if obj.active_series:
            ep_num = obj.active_episode.number if obj.active_episode else '?'
            return f"{obj.active_series.title} (Серия {ep_num})"
        if obj.video:
            return obj.video.title
        return "Ничего не выбрано"

class MessageSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')
    # === НОВОЕ ПОЛЕ ===
    user_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Message
        # Не забудь добавить 'user_avatar' сюда
        fields = ['id', 'room', 'user', 'user_name', 'user_avatar', 'content', 'timestamp']
        read_only_fields = ['timestamp', 'user']

    # Метод для получения ссылки на фото
    def get_user_avatar(self, obj):
        if hasattr(obj.user, 'user_profile') and obj.user.user_profile.photo:
            url = obj.user.user_profile.photo.url
            # === ИСПРАВЛЕНИЕ ===
            # Если это заглушка 'default', возвращаем None, чтобы фронт рисовал букву
            if 'default' in url:
                return None
            # ===================
            return url
        return None

class FullProfileSerializer(serializers.ModelSerializer):
    # Добавляем поля из связанных моделей
    age = serializers.IntegerField(source='user_data.age', required=False)
    country = serializers.CharField(source='user_data.country', required=False, allow_blank=True)
    gender = serializers.CharField(source='user_data.gender', required=False, allow_blank=True)
    photo = serializers.ImageField(source='user_profile.photo', required=False)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'age', 'country', 'gender', 'photo']
        read_only_fields = ['username'] # Логин менять нельзя

    def update(self, instance, validated_data):
        print(f"DEBUG DATA: {validated_data}") 
        
        instance.email = validated_data.get('email', instance.email)
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.save()

        user_data_info = validated_data.pop('user_data', {})
        
        if user_data_info:
            # Используем get_or_create для надежности
            user_data, created = UserData.objects.get_or_create(user=instance)
            
            if 'age' in user_data_info: user_data.age = user_data_info['age']
            if 'country' in user_data_info: user_data.country = user_data_info['country']
            if 'gender' in user_data_info: user_data.gender = user_data_info['gender']
            user_data.save()

        # 3. Обновляем UserProfile (фото)
        user_profile_info = validated_data.pop('user_profile', {})
        
        if user_profile_info:
            user_profile, created = UserProfile.objects.get_or_create(user=instance)
            
            if 'photo' in user_profile_info:
                user_profile.photo = user_profile_info['photo']
                user_profile.save()

        return instance