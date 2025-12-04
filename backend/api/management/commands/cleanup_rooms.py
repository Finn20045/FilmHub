from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import Room
from datetime import timedelta

class Command(BaseCommand):
    help = 'Удаляет старые комнаты, в которых давно никого не было'

    def handle(self, *args, **kwargs):
        # Время жизни без активности (например, 24 часа)
        time_threshold = timezone.now() - timedelta(days=1)
        
        # Находим старые комнаты
        old_rooms = Room.objects.filter(last_activity__lt=time_threshold)
        
        count = old_rooms.count()
        
        for room in old_rooms:
            # Срабатывает логика perform_destroy (удаление видео), если вызывать delete() у модели
            # Но perform_destroy это метод ViewSet.
            # Поэтому здесь удаляем видео вручную, если оно приватное
            if room.video and room.video.is_private:
                room.video.delete()
            room.delete()

        self.stdout.write(self.style.SUCCESS(f'Успешно удалено {count} заброшенных комнат.'))