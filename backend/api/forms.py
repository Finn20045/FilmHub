from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth.models import User
from django import forms
from .models import UserData, UserProfile, Room, Movie

class UserLoginForm(AuthenticationForm):
    username = forms.CharField(
        label="Логин",
        widget=forms.TextInput(attrs={"class": "form-control", "placeholder": "Введите логин"})
    )
    password = forms.CharField(
        label="Пароль",
        widget=forms.PasswordInput(attrs={"class": "form-control", "placeholder": "Введите пароль"})
    )

class UserSignupForm(UserCreationForm):
    # Добавляем age, так как UserCreationForm работает только с моделью User
    age = forms.IntegerField(label="Возраст", required=True)

    class Meta:
        model = User
        fields = ('username', 'email') # Email сохраняем в User

    def save(self, commit=True):
        user = super().save(commit=False)
        if commit:
            user.save()
            # Создаем профиль и дату
            # Важно: UserProfile и UserData создаются здесь, если их нет
        return user

class ProfileForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = ['photo']

    # Поля для редактирования, которые не входят в UserProfile напрямую
    email = forms.EmailField(required=False)
    age = forms.IntegerField(required=False)
    country = forms.CharField(max_length=100, required=False)
    gender = forms.ChoiceField(choices=[('M', 'Male'), ('F', 'Female')], required=False)

    def __init__(self, *args, **kwargs):
        self.user_data = kwargs.pop('user_data', None)
        super(ProfileForm, self).__init__(*args, **kwargs)
        
        # Заполняем начальные данные
        if self.instance.user:
            self.fields['email'].initial = self.instance.user.email
        
        if self.user_data:
            self.fields['age'].initial = self.user_data.age
            self.fields['country'].initial = self.user_data.country
            self.fields['gender'].initial = self.user_data.gender

    def save(self, commit=True):
        user_profile = super(ProfileForm, self).save(commit=False)
        
        # Сохраняем email в модель User
        user = user_profile.user
        user.email = self.cleaned_data.get('email', '')
        if commit:
            user.save()

        # Сохраняем остальные данные в UserData
        if self.user_data:
            self.user_data.age = self.cleaned_data.get('age')
            self.user_data.country = self.cleaned_data.get('country')
            self.user_data.gender = self.cleaned_data.get('gender')
            if commit:
                self.user_data.save()
                user_profile.save()
                
        return user_profile

class RoomCreationForm(forms.ModelForm):
    class Meta:
        model = Room
        fields = ['name', 'password', 'max_participants', 'description']
        widgets = {
            'password': forms.PasswordInput(),
        }

class MovieSelectionForm(forms.Form):
    movie = forms.ModelChoiceField(queryset=Movie.objects.all(), label="Выберите фильм")