import React from 'react';

const MovieCard = ({ movie }) => {
  // Логика выбора картинки:
  // 1. Проверяем, есть ли загруженный файл (image)
  // 2. Если нет, проверяем внешнюю ссылку (poster_url)
  // 3. Если ничего нет — ставим заглушку
  
  let imageUrl = 'https://via.placeholder.com/200x300?text=No+Poster';

  if (movie.image) {
    // Если это абсолютный путь (уже с http) или относительный
    imageUrl = movie.image.startsWith('http') 
      ? movie.image 
      : `http://127.0.0.1:8000${movie.image}`;
  } else if (movie.poster_url) {
    imageUrl = movie.poster_url;
  }

  return (
    <div className="movie-card" style={{ background: '#222', borderRadius: '8px', overflow: 'hidden', color: 'white', cursor: 'pointer' }}>
      <img 
        src={imageUrl} 
        alt={movie.title} 
        style={{ width: '100%', height: '300px', objectFit: 'cover' }} 
        onError={(e) => { e.target.src = 'https://via.placeholder.com/200x300?text=Error'; }} // Если картинка битая
      />
      <div style={{ padding: '10px' }}>
        <h3 style={{ fontSize: '1.1rem', margin: '0 0 5px 0' }}>{movie.title}</h3>
        <p style={{ fontSize: '0.9rem', color: '#aaa' }}>
            {movie.category === 'A' ? 'Action' : 
             movie.category === 'D' ? 'Drama' : 
             movie.category === 'C' ? 'Comedy' : movie.category}
        </p>
      </div>
    </div>
  );
};

export default MovieCard;