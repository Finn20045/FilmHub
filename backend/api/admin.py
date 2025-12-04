from django.contrib import admin
from .models import UserProfile, UserData, UserPermissions, Room, Movie

class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'photo')

class UserDataAdmin(admin.ModelAdmin):
    list_display = ('user', 'age', 'country', 'gender')

class UserPermissionsAdmin(admin.ModelAdmin):
    list_display = ('user', 'can_edit', 'can_delete')

class RoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'get_video_url', 'owner', 'max_participants')
    search_fields = ('name',)
    actions = ['delete_selected']

    def get_video_url(self, obj):
        return obj.video.video_url if obj.video else 'Нет видео'
    get_video_url.short_description = 'Видео URL'

    def delete_selected(self, request, queryset):
        for obj in queryset:
            obj.delete()
        self.message_user(request, "Выбранные комнаты были успешно удалены.")
    delete_selected.short_description = "Удалить выбранные комнаты"


admin.site.register(Movie)
admin.site.register(Room, RoomAdmin)
admin.site.register(UserProfile, UserProfileAdmin)
admin.site.register(UserData, UserDataAdmin)
admin.site.register(UserPermissions, UserPermissionsAdmin)
