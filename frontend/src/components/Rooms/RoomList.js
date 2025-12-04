import React from 'react';
import RoomCard from './RoomCard';

const RoomList = ({ rooms, onJoin, currentUser, onDelete }) => {
  if (!rooms || rooms.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>
        <h3>Активных комнат пока нет</h3>
        <p>Станьте первым, кто создаст комнату!</p>
      </div>
    );
  }

  return (
    <div className="rooms-grid">
      {rooms.map((room) => (
        <RoomCard 
          key={room.id} 
          room={room} 
          onJoin={onJoin}
          currentUser={currentUser} // <-- Передаем дальше
          onDelete={onDelete}       // <-- Передаем дальше
        />
      ))}
    </div>
  );
};

export default RoomList;