import React from 'react';

const RoomCard = ({ room, onJoin, currentUser, onDelete }) => {
  const participantsCount = Array.isArray(room.participants) ? room.participants.length : (room.participants || 0);
  const currentCount = room.participants_count || 0;
  // Генерируем градиент, если нет картинки
  const bgStyle = room.video_poster 
    ? { backgroundImage: `url(${room.video_poster})` }
    : { background: 'linear-gradient(135deg, #2d3436 0%, #000000 74%)' };

  const isOwner = currentUser === room.owner_name;
  return (
    <div className="room-card-modern">
      <div className="room-card-cover" style={bgStyle}>
        <div className="room-status-badge">
            {room.is_protected ? '🔒 Приватная' : '🌍 Открытая'}
        </div>
      
      {/* Кнопка удаления (только для владельца) */}
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
            Войти в комнату
        </button>
      </div>
    </div>
  );
};

export default RoomCard;