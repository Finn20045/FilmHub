from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

# --- Расширения пользователя (по схеме) ---

class UserData(models.Model):
    """
    Хранит базовую демографическую информацию (age, country, gender).
    Связь 1-к-1 с User.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='user_data')
    age = models.IntegerField(null=True, blank=True)
    country = models.CharField(max_length=100, blank=True)
    gender = models.CharField(max_length=10, choices=[('M', 'Male'), ('F', 'Female')], blank=True)

    def __str__(self):
        return f"Data for {self.user.username}"


class UserProfile(models.Model):
    """
    Хранит визуальную информацию (фото).
    Связь 1-к-1 с User.
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


# --- Фильмы ---

class Movie(models.Model):
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
    is_private = models.BooleanField(default=False)
    # Медиа контент
    poster_url = models.URLField(blank=True, null=True)
    video_url = models.URLField(blank=True, null=True) # Если видео на внешнем хостинге
    video = models.FileField(upload_to='videos/', blank=True, null=True) # Если загружаем файл локально
    image = models.ImageField(upload_to='movie_images/', default='movie_images/default.jpg')
    
    # Кто загрузил (uploaded_by на схеме)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_movies')

    def __str__(self):
        return self.title


# --- Комнаты и Сообщения ---

class Room(models.Model):
    """
    Виртуальная комната. 
    Содержит ссылку на фильм, владельца и список участников.
    """
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    max_participants = models.PositiveIntegerField(default=10)
    password = models.CharField(max_length=255, blank=True, null=True) # Можно оставить пустым для открытых комнат
    
    # Владелец комнаты (owner на схеме)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_rooms")
    
    # Текущий фильм (video на схеме)
    video = models.ForeignKey(Movie, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Участники (participants на схеме)
    participants = models.ManyToManyField(User, related_name="rooms", blank=True)
    
    # Текущее время воспроизведения (для сохранения состояния)
    current_time = models.FloatField(default=0.0)

    last_activity = models.DateTimeField(default=timezone.now)

    # Примечание: message_array из схемы в SQL реализуется через 
    # ForeignKey в модели Message (связь "один-ко-многим"), а не массивом здесь.

    def __str__(self):
        return self.name

    # Методы add_participant и remove_participant лучше реализовывать 
    # в API (Views) или как методы модели, если очень нужно:
    def add_participant(self, user):
        if self.participants.count() < self.max_participants:
            self.participants.add(user)
            return True
        return False

    def remove_participant(self, user):
        self.participants.remove(user)


class Message(models.Model):
    """
    Сообщения чата в комнате.
    """
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="messages")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username}: {self.content[:20]}"