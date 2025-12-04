import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../Services/api'; // Импортируем наш настроенный api
import MovieGrid from '../components/Movies/MovieGrid';
import '../styles/pages/MoviePage.css';

function Movies() {
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Запрашиваем фильмы при загрузке страницы
    const fetchMovies = async () => {
      try {
        const response = await api.get('movies/'); // Запрос идет на /api/movies/
        setMovies(response.data);
      } catch (err) {
        console.error("Ошибка загрузки фильмов:", err);
        setError('Не удалось загрузить фильмы. Проверьте соединение с сервером.');
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, []);

  return (
    <div className="movies-page">
      <div className="movies-header">
        <h1>🎞️ Каталог фильмов</h1>
        <p>Выберите фильм для просмотра</p>
      </div>

      <div className="movies-content">
        {loading && <p style={{textAlign: 'center', color: 'white'}}>Загрузка...</p>}
        
        {error && <p style={{textAlign: 'center', color: 'red'}}>{error}</p>}
        
        {!loading && !error && (
            <>
                <MovieGrid movies={movies} />
                
                <div className="feature-actions" style={{marginTop: '30px', textAlign: 'center'}}>
                    <button 
                    className="btn-secondary"
                    onClick={() => navigate('/')}
                    >
                    🏠 На главную
                    </button>
                </div>
            </>
        )}
      </div>
    </div>
  );
}

export default Movies;