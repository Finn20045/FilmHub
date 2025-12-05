import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../Services/api';
import '../styles/pages/RoomPlayer.css';

function RoomPlayer() {
  const { roomName } = useParams();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState(null);
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null); 
  const videoRef = useRef(null); 
  
  const isRemoteUpdate = useRef(false);
  const hasSyncedInitial = useRef(false);
  const pendingSync = useRef(null);

  const [activeTab, setActiveTab] = useState('chat');

  const storedUser = localStorage.getItem('username');
  const isGuest = !storedUser;
  const username = storedUser || 'Аноним';

  // === ХЕЛПЕР ДЛЯ URL АВАТАРОК ===
  const getAvatarUrl = (url) => {
      if (!url) return null;
      if (url.includes('default')) return null; // Если заглушка
      return url.replace('http://127.0.0.1:8000', ''); // Убираем порт 8000
  };

  // 1. Загрузка данных
  useEffect(() => {
    const fetchRoomData = async () => {
      try {
        const roomRes = await api.get(`rooms/${roomName}/`);
        setRoom(roomRes.data);
        if (roomRes.data.active_series) setActiveTab('episodes');

        try {
            const messagesRes = await api.get(`messages/?room=${roomName}`);
            const formattedMessages = messagesRes.data.map(msg => ({
                username: msg.user_name,
                message: msg.content,
                timestamp: msg.timestamp,
                avatar: msg.user_avatar // Аватар обрабатываем при рендере
            }));
            setMessages(formattedMessages);
        } catch (err) { console.error("Ошибка чата:", err); }

      } catch (err) {
        toast.error('Комната не найдена');
        navigate('/rooms');
      } finally {
        setLoading(false);
      }
    };
    fetchRoomData();
  }, [roomName, navigate]);

  // 2. WebSocket
  useEffect(() => {
    if (!roomName) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/player/${roomName}/`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ Connected');
      setIsConnected(true);
      sendVideoEvent('request_sync');
      setTimeout(() => {
          if (!hasSyncedInitial.current) {
              hasSyncedInitial.current = true;
              if (videoRef.current) videoRef.current.muted = false;
          }
      }, 1500);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'video_event' && data.action === 'change_video') {
          api.get(`rooms/${roomName}/`).then(res => {
              setRoom(res.data);
              hasSyncedInitial.current = false;
              toast('Включена следующая серия!', { icon: '📺' });
          });
          return;
      }

      if (data.type === 'user_kicked') {
          if (data.kicked_username === username) {
              ws.close();
              navigate('/rooms');
              toast.error('⛔ Вас выгнали');
          } else {
              toast(`${data.kicked_username} был изгнан`, { icon: '👢' });
          }
      }
      else if (data.type === 'chat_message') {
        setMessages((prev) => [...prev, data]);
      } 
      else if (data.type === 'system') {
          toast(data.message, { icon: '🔔', style: { borderRadius: '10px', background: '#333', color: '#fff' } });
      }
      else if (data.type === 'video_event') {
        handleRemoteVideoEvent(data);
      }
    };

    ws.onclose = () => setIsConnected(false);
    return () => ws.close();
  }, [roomName, username, navigate]);

  // === ИСПРАВЛЕННАЯ ФУНКЦИЯ КОПИРОВАНИЯ ===
  const handleCopyLink = () => {
    const url = window.location.href;
    
    // Попытка 1: Современный API
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url)
            .then(() => toast.success('Ссылка скопирована!'))
            .catch(() => fallbackCopy(url));
    } else {
        // Попытка 2: Старый метод (для HTTP)
        fallbackCopy(url);
    }
  };

  const fallbackCopy = (text) => {
      try {
          const textArea = document.createElement("textarea");
          textArea.value = text;
          textArea.style.position = "fixed"; 
          textArea.style.left = "-9999px"; // Скрываем, но оставляем в DOM
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (successful) toast.success('Ссылка скопирована!');
          else toast.error('Не удалось скопировать');
      } catch (err) {
          console.error(err);
          toast.error('Ошибка копирования');
      }
  };

  const handleChangeEpisode = async (episodeId) => {
      if (room?.owner_name !== username) {
          toast.error("Только владелец может переключать серии");
          return;
      }
      try {
          await api.post(`rooms/${roomName}/change_episode/`, { episode_id: episodeId });
          if (wsRef.current) wsRef.current.send(JSON.stringify({ type: 'change_video' }));
          
          const res = await api.get(`rooms/${roomName}/`);
          setRoom(res.data);
          hasSyncedInitial.current = false;
      } catch (err) {
          toast.error("Ошибка при смене серии");
      }
  };

  const applySyncData = (data) => {
      if (!videoRef.current) return;
      const diff = Math.abs(videoRef.current.currentTime - data.currentTime);
      if (diff > 0.5 || videoRef.current.currentTime === 0) videoRef.current.currentTime = data.currentTime;
      if (data.paused) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
      hasSyncedInitial.current = true;
      pendingSync.current = null;
      videoRef.current.muted = false;
  };

  const handleRemoteVideoEvent = (data) => {
    if (data.action === 'request_sync') {
        if (videoRef.current && videoRef.current.readyState >= 1) {
            wsRef.current.send(JSON.stringify({ type: 'response_sync', currentTime: videoRef.current.currentTime, paused: videoRef.current.paused }));
        }
        return;
    }
    if (data.action === 'response_sync') {
        if (!hasSyncedInitial.current) {
            if (videoRef.current && videoRef.current.readyState >= 1) applySyncData(data.data);
            else pendingSync.current = data.data;
        }
        return;
    }
    if (!videoRef.current) return;
    isRemoteUpdate.current = true;
    if (data.action === 'play') videoRef.current.play().catch(() => {});
    else if (data.action === 'pause') videoRef.current.pause();
    else if (data.action === 'seek') {
        if (Math.abs(videoRef.current.currentTime - data.data.currentTime) > 1) videoRef.current.currentTime = data.data.currentTime;
    }
    setTimeout(() => { isRemoteUpdate.current = false; }, 500);
  };

  const handleVideoLoadedMetadata = () => {
      if (pendingSync.current && !hasSyncedInitial.current) applySyncData(pendingSync.current);
  };

  const sendVideoEvent = (action) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || isRemoteUpdate.current) return;
    wsRef.current.send(JSON.stringify({ type: action, currentTime: videoRef.current ? videoRef.current.currentTime : 0 }));
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'chat_message', message: messageInput, username: username }));
    setMessageInput('');
  };

  const handleUserClick = (targetUser) => {
      const isOwner = room?.owner_name === username;
      if (isOwner && targetUser !== username) {
          if (window.confirm(`Выгнать пользователя ${targetUser}?`)) {
              wsRef.current.send(JSON.stringify({ type: 'kick_user', username: targetUser }));
          }
      }
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  const videoSrc = room?.current_video_url;
  const posterSrc = (room?.current_poster_url && !room.current_poster_url.includes('default')) ? room.current_poster_url : null;
  const pageTitle = room?.current_title || room?.name;
  const isOwner = room?.owner_name === username;

  return (
    <div className="room-player-page">
      <div className="player-container">
        <div className="video-section">
            <div className="video-wrapper">
                {videoSrc ? (
                    <video 
                        key={videoSrc}
                        ref={videoRef}
                        controls 
                        className="main-video"
                        poster={posterSrc}
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        onPlay={() => sendVideoEvent('play')}
                        onPause={() => sendVideoEvent('pause')}
                        onSeeked={() => sendVideoEvent('seek')}
                        muted={!hasSyncedInitial.current}
                    >
                        <source src={videoSrc} type="video/mp4" />
                    </video>
                ) : (
                    <div className="no-video-placeholder"><h3>🎬 Ничего не играет</h3></div>
                )}
            </div>
            <div className="video-info">
                <h1>{room?.name}</h1>
                <p className="movie-title">
                   Сейчас: <span>{pageTitle}</span>
                   {isConnected ? <span style={{color:'#00b894', marginLeft:'15px'}}>● Онлайн</span> : null}
                </p>
            </div>
        </div>

        <div className="sidebar">
            <div className="sidebar-tabs">
                <button className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>💬 Чат</button>
                {room?.active_series && <button className={`tab-btn ${activeTab === 'episodes' ? 'active' : ''}`} onClick={() => setActiveTab('episodes')}>📺 Серии</button>}
                <button className="share-icon-btn" onClick={handleCopyLink} title="Ссылка">🔗</button>
            </div>

            {activeTab === 'chat' && (
                <>
                    <div className="chat-messages">
                        {messages.map((msg, index) => {
                            const isMyMsg = msg.username === username;
                            // Обработка аватарки при рендере
                            const cleanAvatar = getAvatarUrl(msg.avatar); 
                            
                            return (
                                <div key={index} className={`chat-msg ${msg.type === 'system' ? 'system-msg' : (isMyMsg ? 'my-msg' : '')}`}>
                                    {msg.type !== 'system' && (
                                        <>
                                            <div className="chat-avatar-container">
                                                {cleanAvatar ? (
                                                    <img src={cleanAvatar} alt="ava" className="chat-avatar-img" />
                                                ) : (
                                                    <div className="chat-avatar-placeholder">
                                                        {msg.username ? msg.username[0].toUpperCase() : '?'}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="chat-content">
                                                <span 
                                                    className="msg-user"
                                                    style={isOwner && !isMyMsg ? {cursor: 'pointer', textDecoration: 'underline'} : {}}
                                                    onClick={() => handleUserClick(msg.username)}
                                                >
                                                    {msg.username}
                                                </span>
                                                <span className="msg-text">{msg.message}</span>
                                            </div>
                                        </>
                                    )}
                                    {msg.type === 'system' && msg.message}
                                </div>
                            );
                        })}
                    </div>
                    <div className="chat-input-area">
                        {isGuest ? (
                            <div style={{color: '#777', padding: '10px'}}>Войдите, чтобы писать</div>
                        ) : (
                            <>
                                <input value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendMessage()} placeholder="Сообщение..." />
                                <button onClick={handleSendMessage}>➤</button>
                            </>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'episodes' && room?.active_series && (
                <div className="episodes-list">
                    <h3 style={{padding: '10px', margin: 0, borderBottom: '1px solid #333'}}>{room.active_series.title}</h3>
                    <div className="episodes-scroll">
                        {room.active_series.episodes.map(ep => (
                            <div 
                                key={ep.id} 
                                className={`episode-item ${room.active_episode?.id === ep.id ? 'active' : ''}`}
                                onClick={() => isOwner ? handleChangeEpisode(ep.id) : toast('Только владелец')}
                                style={{cursor: isOwner ? 'pointer' : 'default'}}
                            >
                                <div className="ep-number">#{ep.number}</div>
                                <div className="ep-title">{ep.title || `Серия ${ep.number}`}</div>
                                {room.active_episode?.id === ep.id && <span>▶</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default RoomPlayer;