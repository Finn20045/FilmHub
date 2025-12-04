import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../Services/api';
import MovieCard from '../components/Movies/MovieCard'; // Переиспользуем карточки
import '../styles/pages/Home.css';

function Home({ onNavigate }) { // Принимаем onNavigate из App.js для переключения меню
  const navigate = useNavigate();
  const [featuredMovies, setFeaturedMovies] = useState([]);

  useEffect(() => {
    // Загружаем немного фильмов для витрины
    api.get('movies/')
        .then(res => {
            // Берем первые 4 фильма
            setFeaturedMovies(res.data.slice(0, 4));
        })
        .catch(err => console.error(err));
  }, []);

  const handleNavigation = (path, tabName) => {
    navigate(path);
    if (onNavigate) onNavigate(tabName);
  };

  return (
    <div className="home-page">
      {/* Баннер */}
      <section className="hero-section">
        <h1 className="hero-title">Смотрите фильмы вместе</h1>
        <p className="hero-subtitle">
            FilmHub — это место, где расстояние не имеет значения. 
            Создавайте комнаты, приглашайте друзей и наслаждайтесь кино в реальном времени.
        </p>
        <div className="hero-buttons">
            <button 
                className="btn-large btn-primary-hero"
                onClick={() => handleNavigation('/rooms', 'rooms')}
            >
                Создать комнату
            </button>
            <button 
                className="btn-large btn-secondary-hero"
                onClick={() => handleNavigation('/movies', 'movies')}
            >
                Каталог фильмов
            </button>
        </div>
      </section>

      {/* Популярные фильмы */}
      <section className="featured-section">
        <h2 className="section-title">🔥 Сейчас смотрят</h2>
        
        {featuredMovies.length > 0 ? (
            // Используем inline grid для простоты, или можно Grid компонент
            <div style={{
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
                gap: '25px'
            }}>
                {featuredMovies.map(movie => (
                    <MovieCard key={movie.id} movie={movie} />
                ))}
            </div>
        ) : (
            <p style={{color: '#777'}}>Фильмы загружаются или список пуст...</p>
        )}
      </section>
    </div>
  );
}

export default Home;