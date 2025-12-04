import React from 'react';
import MovieCard from './MovieCard'; // Убедись, что этот файл существует
// Если есть стили для сетки, раскомментируй строку ниже:
// import '../../styles/components/Movies.css'; 

const MovieGrid = ({ movies }) => {
  if (!movies || movies.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#aaa', marginTop: '20px' }}>
        <p>Список фильмов пока пуст.</p>
      </div>
    );
  }

  return (
    <div className="movie-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
        gap: '20px',
        padding: '20px'
    }}>
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} />
      ))}
    </div>
  );
};

export default MovieGrid;