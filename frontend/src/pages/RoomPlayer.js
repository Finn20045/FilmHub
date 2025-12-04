import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../Services/api';
import '../styles/pages/RoomPlayer.css';

function RoomPlayer() {
  const { roomName } = useParams();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState(null);
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef(null); 
  const videoRef = useRef(null); 
  
  const isRemoteUpdate = useRef(false);
  const hasSyncedInitial = useRef(false);
  const pendingSync = useRef(null);

  const storedUser = localStorage.getItem('username');
  const isGuest = !storedUser;
  const username = storedUser || 'Аноним';

  // 1. Загрузка данных
  useEffect(() => {
    const fetchRoomData = async () => {
      try {
        const roomRes = await api.get(`rooms/${roomName}/`);
        setRoom(roomRes.data);

        if (roomRes.data.video) {
            try {
                if (typeof roomRes.data.video === 'number') {
                    const movieRes = await api.get(`movies/${roomRes.data.video}/`);
                    setMovie(movieRes.data);
                } else {
                    setMovie(roomRes.data.video);
                }
            } catch { console.log("Фильм не найден"); }
        }

        try {
            const messagesRes = await api.get(`messages/?room=${roomName}`);
            const formattedMessages = messagesRes.data.map(msg => ({
                username: msg.user_name,
                message: msg.content,
                timestamp: msg.timestamp,
                // Если есть аватарка в истории (надо бы добавить в сериализатор, но пока заглушка)
                avatar: null 
            }));
            setMessages(formattedMessages);
        } catch (err) { console.error("Ошибка чата:", err); }

      } catch (err) {
        console.error(err);
        setError('Комната не найдена или доступ запрещен');
      } finally {
        setLoading(false);
      }
    };
    fetchRoomData();
  }, [roomName]);

  // 2. WebSocket
  useEffect(() => {
    if (!roomName) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/player/${roomName}/`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket подключен');
      setIsConnected(true);
      sendVideoEvent('request_sync');
      
      // === ФИКС ПРОБЛЕМЫ С ЗАВИСАНИЕМ ВИДЕО ===
      // Если мы одни в комнате, нам никто не ответит на request_sync.
      // Через 1.5 секунды считаем, что мы главные и снимаем блокировку.
      setTimeout(() => {
          if (!hasSyncedInitial.current) {
              console.log("⏱️ Таймаут синхронизации: мы одни, разблокируем видео.");
              hasSyncedInitial.current = true;
              // Если видео уже загружено, убираем muted (визуально, в коде ниже)
              // Принудительно обновляем компонент, чтобы убрать muted (хотя ref работает напрямую)
              if (videoRef.current) videoRef.current.muted = false;
          }
      }, 1500);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // === ФИКС УВЕДОМЛЕНИЙ ===
      // Теперь обрабатываем тип 'system'
      if (data.type === 'chat_message' || data.type === 'system') {
        setMessages((prev) => [...prev, data]);
      } 
      else if (data.type === 'video_event') {
        handleRemoteVideoEvent(data);
      }
    };

    ws.onclose = () => {
      console.log('❌ WebSocket отключен');
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [roomName]);

  const applySyncData = (data) => {
      if (!videoRef.current) return;
      const diff = Math.abs(videoRef.current.currentTime - data.currentTime);
      
      if (diff > 0.5 || videoRef.current.currentTime === 0) {
          videoRef.current.currentTime = data.currentTime;
      }
      
      if (data.paused) {
          videoRef.current.pause();
      } else {
          videoRef.current.play().catch(e => console.log("Autoplay blocked:", e));
      }
      
      hasSyncedInitial.current = true;
      pendingSync.current = null;
      videoRef.current.muted = false; // Включаем звук после синхронизации
  };

  const handleRemoteVideoEvent = (data) => {
    if (data.action === 'request_sync') {
        if (videoRef.current && videoRef.current.readyState >= 1) {
            wsRef.current.send(JSON.stringify({
                type: 'response_sync',
                currentTime: videoRef.current.currentTime,
                paused: videoRef.current.paused
            }));
        }
        return;
    }

    if (data.action === 'response_sync') {
        if (!hasSyncedInitial.current) {
            if (videoRef.current && videoRef.current.readyState >= 1) {
                applySyncData(data.data);
            } else {
                pendingSync.current = data.data;
            }
        }
        return;
    }

    if (!videoRef.current) return;
    isRemoteUpdate.current = true;

    if (data.action === 'play') {
        videoRef.current.play().catch(e => console.log("Autoplay blocked:", e));
    } else if (data.action === 'pause') {
        videoRef.current.pause();
    } else if (data.action === 'seek') {
        if (Math.abs(videoRef.current.currentTime - data.data.currentTime) > 1) {
            videoRef.current.currentTime = data.data.currentTime;
        }
    }

    setTimeout(() => {
        isRemoteUpdate.current = false;
    }, 500);
  };

  const handleVideoLoadedMetadata = () => {
      if (pendingSync.current && !hasSyncedInitial.current) {
          applySyncData(pendingSync.current);
      }
  };

  const sendVideoEvent = (action) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || isRemoteUpdate.current) return;
    wsRef.current.send(JSON.stringify({
      type: action, 
      currentTime: videoRef.current ? videoRef.current.currentTime : 0
    }));
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'chat_message',
      message: messageInput,
      username: username
    }));
    setMessageInput('');
  };

  if (loading) return <div className="loading">Загрузка кинозала...</div>;
  if (error) return <div className="error-screen"><h2>❌ {error}</h2><button onClick={() => navigate('/rooms')}>Назад</button></div>;

  // Формируем правильный URL видео
  let videoSrc = null;
  if (movie) {
      if (movie.video) {
          // Если это локальный файл, убедимся, что путь правильный
          // В Docker фронт и бэк на одном домене, поэтому просто /media/... сработает
          videoSrc = movie.video;
      } else if (movie.video_url) {
          videoSrc = movie.video_url;
      }
  }

  return (
    <div className="room-player-page">
      <div className="player-container">
        <div className="video-section">
            <div className="video-wrapper">
                {videoSrc ? (
                    <video 
                        ref={videoRef}
                        controls 
                        className="main-video"
                        poster={movie?.image || movie?.poster_url}
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        onPlay={() => sendVideoEvent('play')}
                        onPause={() => sendVideoEvent('pause')}
                        onSeeked={() => sendVideoEvent('seek')}
                        // Muted убираем программно после синхронизации или таймаута
                        muted={!hasSyncedInitial.current} 
                    >
                        <source src={videoSrc} type="video/mp4" />
                        Ваш браузер не поддерживает видео.
                    </video>
                ) : (
                    <div className="no-video-placeholder">
                        <h3>🎬 Фильм не выбран</h3>
                        <p>Ожидаем выбора фильма...</p>
                    </div>
                )}
            </div>
            
            <div className="video-info">
                <h1>{room?.name}</h1>
                <p className="movie-title">
                   Фильм: <span>{movie?.title || 'Загрузка...'}</span>
                   {isConnected ? <span style={{color:'#00b894', marginLeft:'15px'}}>● Онлайн</span> : <span style={{color:'red', marginLeft:'15px'}}>● Оффлайн</span>}
                </p>
            </div>
        </div>

        <div className="sidebar">
            <div className="sidebar-header">
                <h3>💬 Чат</h3>
                <span className="online-count">Вы: {username}</span>
            </div>
            <div className="chat-messages">
                <div className="system-msg">Добро пожаловать в комнату!</div>
                
                {messages.map((msg, index) => {
                    if (msg.type === 'system') {
                        return (
                            <div key={index} className="system-msg fade-in">
                                {msg.message}
                            </div>
                        );
                    }

                    const isMyMsg = msg.username === username;
                    return (
                        <div key={index} className={`chat-msg ${isMyMsg ? 'my-msg' : ''}`}>
                            <div className="chat-avatar-container">
                                {msg.avatar ? (
                                    <img src={msg.avatar} alt="ava" className="chat-avatar-img" />
                                ) : (
                                    <div className="chat-avatar-placeholder">
                                        {msg.username ? msg.username[0].toUpperCase() : '?'}
                                    </div>
                                )}
                            </div>
                            <div className="chat-content">
                                <span className="msg-user">{msg.username}</span>
                                <span className="msg-text">{msg.message}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="chat-input-area">
                {isGuest ? (
                    <div style={{padding: '10px', color: '#777', textAlign: 'center', width: '100%', fontSize: '0.9rem'}}>
                        <span style={{cursor: 'pointer', textDecoration: 'underline'}} onClick={() => navigate('/login')}>Войдите</span>, чтобы общаться
                    </div>
                ) : (
                    <>
                        <input 
                            type="text" 
                            placeholder="Написать сообщение..." 
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            disabled={!isConnected}
                        />
                        <button onClick={handleSendMessage} disabled={!isConnected}>➤</button>
                    </>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}

export default RoomPlayer;