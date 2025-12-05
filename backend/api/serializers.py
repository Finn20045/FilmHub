from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Movie, Room, Message, UserData, UserProfile

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

class MovieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Movie
        fields = '__all__' # Отдаем все поля фильма

class RoomSerializer(serializers.ModelSerializer):
    owner_name = serializers.ReadOnlyField(source='owner.username')
    video_title = serializers.ReadOnlyField(source='video.title', default=None)
    is_protected = serializers.SerializerMethodField()
    
    video_poster = serializers.ReadOnlyField(source='video.image.url', default=None)
    participants_count = serializers.IntegerField(source='participants.count', read_only=True)
    class Meta:
        model = Room
        fields = ['id', 'name', 'description', 'max_participants', 'owner', 'owner_name', 
        'video', 'video_title', 'video_poster', 'current_time', 'is_protected', 'password', 'participants_count']
        
        read_only_fields = ['owner', 'current_time']
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def get_is_protected(self, obj):
        return bool(obj.password and obj.password.strip())

class MessageSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Message
        fields = ['id', 'room', 'user', 'user_name', 'content', 'timestamp']
        read_only_fields = ['timestamp', 'user']

# === НОВЫЙ СЕРИАЛИЗАТОР ДЛЯ ПРОФИЛЯ ===
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
        # --- ОТЛАДКА ---
        # Это покажет в консоли Django, какие данные реально дошли после валидации
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