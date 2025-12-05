import React from 'react';

const RoomCard = ({ room, onJoin, currentUser, onDelete }) => {
  const currentCount = room.participants_count || 0;
  
  // === ИСПРАВЛЕНИЕ КАРТИНОК ===
  // Проверяем: есть ли ссылка и не является ли она "дефолтной" заглушкой Django
  const hasValidPoster = room.video_poster && !room.video_poster.includes('default');

  const bgStyle = hasValidPoster
    ? { backgroundImage: `url(${room.video_poster})` }
    : { 
        background: 'linear-gradient(135deg, #2c3e50 0%, #000000 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      };
  // ============================

  const isOwner = currentUser === room.owner_name;

  return (
    <div className="room-card-modern">
      <div className="room-card-cover" style={bgStyle}>
        {/* Если картинки нет, показываем иконку кино */}
        {!hasValidPoster && <span style={{fontSize: '3rem', opacity: 0.3}}>🎬</span>}

        <div className="room-status-badge">
            {room.is_protected ? '🔒' : '🌍'}
        </div>
        {isOwner && (
            <button 
                className="delete-room-btn"
                onClick={(e) => {
                    e.stopPropagation();
                    if(window.confirm('Удалить комнату?')) onDelete(room.name);
                }}
                title="Удалить комнату"
            >
                🗑️
            </button>
        )}
      </div>
      
      <div className="room-card-body">
        <h3 className="room-title" title={room.name}>{room.name}</h3>
        
        <div className="room-info-row">
            <span className="info-pill user">👤 {room.owner_name}</span>
            <span className={`info-pill count ${currentCount >= room.max_participants ? 'full' : ''}`}>
                👥 {currentCount}/{room.max_participants}
            </span>
        </div>

        {room.video_title && (
            <p className="room-playing">
                🎬 <span>{room.video_title}</span>
            </p>
        )}

        <button className="btn-join-modern" onClick={() => onJoin(room.name)}>
            Войти
        </button>
      </div>
    </div>
  );
};

export default RoomCard;