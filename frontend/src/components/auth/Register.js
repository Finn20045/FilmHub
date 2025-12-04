import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../Services/api';
import toast from 'react-hot-toast';
import '../../styles/components/Auth.css';

function Register({ onRegister }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    age: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    toast.error('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    toast.error('');

    if (formData.password !== formData.confirmPassword) {
      toast.error('Пароли не совпадают');
      setLoading(false);
      return;
    }

    if (parseInt(formData.age) < 13) {
      toast.error('Минимальный возраст - 13 лет');
      setLoading(false);
      return;
    }

    try {
      // Отправляем запрос на регистрацию
      const response = await api.post('auth/signup/', {
        username: formData.username,
        password: formData.password,
        age: formData.age,
        email: formData.email
      });

      if (response.data.success) {
        if (onRegister) {
          onRegister(response.data.username);
        }
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        toast.error(err.response.data.error);
      } else {
        toast.error('Ошибка при регистрации. Возможно, логин занят.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>📝 Регистрация в FilmHub</h1>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label>Логин *</label>
            <input type="text" name="username" value={formData.username} onChange={handleInputChange} required disabled={loading} />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleInputChange} disabled={loading} />
          </div>

          <div className="form-group">
            <label>Возраст *</label>
            <input type="number" name="age" value={formData.age} onChange={handleInputChange} required disabled={loading} />
          </div>

          <div className="form-group">
            <label>Пароль *</label>
            <input type="password" name="password" value={formData.password} onChange={handleInputChange} required disabled={loading} />
          </div>

          <div className="form-group">
            <label>Подтвердите пароль *</label>
            <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} required disabled={loading} />
          </div>

          <button type="submit" className="auth-btn primary" disabled={loading}>
            {loading ? '⏳ Регистрация...' : '📝 Зарегистрироваться'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Уже есть аккаунт? <span className="auth-link" onClick={() => navigate('/login')}>Войти</span></p>
        </div>
      </div>
    </div>
  );
}

export default Register;