import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/components/Header.css';

function Header({ currentPage, onNavigate, isLoggedIn, user, onLogout }) {
  const navigate = useNavigate();

  const handleAuthClick = (page) => {
    navigate(page);
    onNavigate(page.replace('/', ''));
  };

  const handleLogout = () => {
    // Здесь можно добавить вызов API для выхода на сервере (api.post('/logout/'))
    onLogout();
    navigate('/');
    onNavigate('home');
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <div 
          className="logo" 
          onClick={() => {
            navigate('/');
            onNavigate('home');
          }}
        >
          <h1>🎬 FilmHub</h1>
        </div>
        
        <nav className="main-nav">
          <button 
            className={currentPage === 'home' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => {
              navigate('/');
              onNavigate('home');
            }}
          >
            🏠 Главная
          </button>
          <button 
            className={currentPage === 'movies' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => {
              navigate('/movies');
              onNavigate('movies');
            }}
          >
            🎞️ Фильмы
          </button>
          <button 
            className={currentPage === 'rooms' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => {
              navigate('/rooms');
              onNavigate('rooms');
            }}
          >
            🎪 Комнаты
          </button>
        </nav>

        <div className="user-actions">
          {isLoggedIn ? (
            <div className="user-menu">
              {/* === ИЗМЕНЕНИЕ ЗДЕСЬ: Сделали имя кликабельным === */}
              <span 
                className="user-greeting"
                onClick={() => {
                    navigate('/profile');
                    if(onNavigate) onNavigate('profile');
                }}
                style={{ cursor: 'pointer', textDecoration: 'underline', marginRight: '15px' }}
                title="Перейти в профиль"
              >
                👋 Привет, {user}
              </span>
              {/* ================================================ */}
              
              <button className="nav-btn" onClick={handleLogout}>
                🚪 Выйти
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <button 
                className="nav-btn" 
                onClick={() => handleAuthClick('/login')}
              >
                🔐 Войти
              </button>
              <button 
                className="nav-btn primary" 
                onClick={() => handleAuthClick('/register')}
              >
                📝 Регистрация
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;