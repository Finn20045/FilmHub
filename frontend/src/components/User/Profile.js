import React, { useState, useEffect } from 'react';
import { api } from '../../Services/api';
import toast from 'react-hot-toast'; // Используем toast для уведомлений
import '../../styles/components/Auth.css';

const Profile = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    age: '',
    country: '',
    gender: 'M',
  });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  // Функция для исправления ссылки на картинку (убираем порт 8000)
  const getCorrectImageUrl = (url) => {
      if (!url) return null;
      // Если ссылка полная с локальным портом - обрезаем до относительной
      return url.replace('http://127.0.0.1:8000', '');
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('profile/me/');
      const data = response.data;
      setFormData({
        username: data.username,
        email: data.email || '',
        age: data.age || '',
        country: data.country || '',
        gender: data.gender || 'M',
      });
      
      // Используем функцию исправления URL
      if (data.photo) {
        setPreview(getCorrectImageUrl(data.photo));
      }
    } catch (error) {
      console.error('Ошибка загрузки профиля', error);
      toast.error('Не удалось загрузить профиль');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const loadToast = toast.loading('Сохраняем...');
    
    const dataToSend = new FormData();
    if (formData.email) dataToSend.append('email', formData.email);
    if (formData.country) dataToSend.append('country', formData.country);
    if (formData.gender) dataToSend.append('gender', formData.gender);
    if (formData.age) dataToSend.append('age', formData.age);
    if (photo) dataToSend.append('photo', photo);

    try {
      await api.patch('profile/me/', dataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Профиль обновлен!', { id: loadToast });
    } catch (error) {
      console.error(error);
      toast.error('Ошибка при обновлении', { id: loadToast });
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div className="auth-page">
      <div className="auth-container" style={{maxWidth: '600px'}}>
        <div className="auth-header">
          <h1>👤 Мой профиль</h1>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div style={{textAlign: 'center', marginBottom: '20px'}}>
            <div style={{
                width: '100px', height: '100px', 
                borderRadius: '50%', overflow: 'hidden', 
                margin: '0 auto 10px', background: '#333', border: '2px solid #6c5ce7'
            }}>
                {preview ? (
                    <img src={preview} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                ) : (
                    <div style={{lineHeight: '100px', fontSize: '40px'}}>👤</div>
                )}
            </div>
            <label className="btn-secondary" style={{cursor: 'pointer', display: 'inline-block', padding: '5px 15px', border: '1px solid #555', borderRadius: '5px'}}>
                📸 Загрузить фото
                <input type="file" onChange={handlePhotoChange} style={{display: 'none'}} accept="image/*" />
            </label>
          </div>

          <div className="form-group">
            <label>Логин</label>
            <input type="text" value={formData.username} disabled style={{opacity: 0.7}} />
          </div>

          <div style={{display: 'flex', gap: '15px'}}>
              <div className="form-group" style={{flex: 1}}>
                <label>Возраст</label>
                <input type="number" name="age" value={formData.age} onChange={handleChange} />
              </div>
              <div className="form-group" style={{flex: 1}}>
                <label>Пол</label>
                <select name="gender" value={formData.gender} onChange={handleChange}>
                    <option value="M">Мужской</option>
                    <option value="F">Женский</option>
                </select>
              </div>
          </div>

          <div className="form-group">
            <label>Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Страна</label>
            <input type="text" name="country" value={formData.country} onChange={handleChange} />
          </div>

          <button type="submit" className="auth-btn primary">💾 Сохранить изменения</button>
        </form>
      </div>
    </div>
  );
};

export default Profile;