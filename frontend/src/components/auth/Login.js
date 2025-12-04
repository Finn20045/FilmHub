import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../Services/api';
import toast from 'react-hot-toast';
import '../../styles/components/Auth.css';

function Login({ onLogin }) {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
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

    try {
      // Отправляем реальный запрос
      const response = await api.post('auth/login/', formData);
      
      if (response.data.success) {
        if (onLogin) {
            onLogin(response.data.username);
        }
        // Сохраняем имя пользователя в localStorage (опционально, для удобства)
        localStorage.setItem('username', response.data.username);
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
          toast.error(err.response.data.error);
      } else {
          toast.error('Ошибка соединения с сервером');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>🔐 Вход в FilmHub</h1>
          <p>Войдите в свой аккаунт</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="username">Логин</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="auth-btn primary" disabled={loading}>
            {loading ? '⏳ Вход...' : '🚪 Войти'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Нет аккаунта? <span className="auth-link" onClick={() => navigate('/register')}>Зарегистрироваться</span></p>
          <p><span className="auth-link" onClick={() => navigate('/')}>← На главную</span></p>
        </div>
      </div>
    </div>
  );
}

export default Login;