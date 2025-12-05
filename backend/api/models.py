from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

# === РАСШИРЕНИЕ МОДЕЛИ ПОЛЬЗОВАТЕЛЯ ===

class UserData(models.Model):
    """
    Таблица с дополнительными демографическими данными пользователя.
    Связь OneToOne с таблицей User.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='user_data')
    age = models.IntegerField(null=True, blank=True)
    country = models.CharField(max_length=100, blank=True)
    gender = models.CharField(max_length=10, choices=[('M', 'Male'), ('F', 'Female')], blank=True)

    def __str__(self):
        return f"Data for {self.user.username}"


class UserProfile(models.Model):
    """
    Таблица для хранения аватарок пользователей.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='user_profile')
    photo = models.ImageField(upload_to='user_photos/', blank=True, null=True)

    def __str__(self):
        return f"Profile for {self.user.username}"


class UserPermissions(models.Model):
    """
    Хранит специфичные права доступа для системы Filmhub.
    Связь 1-к-1 с User.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='filmhub_permissions')
    is_admin = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)

    def __str__(self):
        return f"Permissions for {self.user.username}"


# === ОСНОВНОЙ КОНТЕНТ ===

class Movie(models.Model):
    """
    Модель Фильма.
    Может быть загружен через админку (публичный) или пользователем (приватный).
    """
    CATEGORY_CHOICES = (
        ('A', 'Action'),
        ('D', 'Drama'),
        ('C', 'Comedy'),
        ('R', 'Romance'),
    )

    STATUS_CHOICES = (
        ('RA', 'Recently Added'),
        ('MW', 'Most Watched'),
        ('TR', 'Top Rated'),
    )

    title = models.CharField(max_length=255)
    description = models.TextField(max_length=1000)
    category = models.CharField(choices=CATEGORY_CHOICES, max_length=1, default='A')
    status = models.CharField(choices=STATUS_CHOICES, max_length=2, default='MW')
    views_count = models.IntegerField(default=0)
    
    
    # Медиа контент
    poster_url = models.URLField(blank=True, null=True)
    video_url = models.URLField(blank=True, null=True) # Если видео на внешнем хостинге
    video = models.FileField(upload_to='videos/', blank=True, null=True) # Если загружаем файл локально
    image = models.ImageField(upload_to='movie_images/', default='movie_images/default.jpg')
    
    # Связи и флаги
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_movies')
    is_private = models.BooleanField(default=False)
    def __str__(self):
        return self.title


# --- Комнаты и Сообщения ---

class Room(models.Model):
    """
    Модель Комнаты для совместного просмотра.
    """
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    max_participants = models.PositiveIntegerField(default=10)
    password = models.CharField(max_length=255, blank=True, null=True) # Можно оставить пустым для открытых комнат
    
    # Владелец комнаты
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_rooms")
    
    # Текущий фильм 
    video = models.ForeignKey(Movie, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Участники
    participants = models.ManyToManyField(User, related_name="rooms", blank=True)
    
    # Текущее время воспроизведения (для сохранения состояния)
    current_time = models.FloatField(default=0.0)

    last_activity = models.DateTimeField(default=timezone.now)


    def __str__(self):
        return self.name

    
    def add_participant(self, user):
        if self.participants.count() < self.max_participants:
            self.participants.add(user)
            return True
        return False

    def remove_participant(self, user):
        self.participants.remove(user)


class Message(models.Model):
    """
    История сообщений в чате комнаты.
    """
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="messages")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username}: {self.content[:20]}"