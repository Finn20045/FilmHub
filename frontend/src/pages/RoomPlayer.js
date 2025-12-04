import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../Services/api';
import '../styles/pages/RoomPlayer.css';

function RoomPlayer() {
  const { roomName } = useParams();
  const navigate = useNavigate();
  
  // Данные API
  const [room, setRoom] = useState(null);
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Данные Чата и Сокетов
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef(null); 
  const videoRef = useRef(null); 
  
  // Флаги
  const isRemoteUpdate = useRef(false);
  const hasSyncedInitial = useRef(false);
  const pendingSync = useRef(null);

  // === ИСПРАВЛЕНИЕ ЗДЕСЬ ===
  // Получаем имя из хранилища
  const storedUser = localStorage.getItem('username');
  // Если имени нет - считаем пользователя гостем
  const isGuest = !storedUser;
  // Имя для отображения (если гость, то 'Аноним')
  const username = storedUser || 'Аноним';
  // ==========================

  // 1. Загрузка данных (HTTP)
  useEffect(() => {
    const fetchRoomData = async () => {
      try {
        const roomRes = await api.get(`rooms/${roomName}/`);
        setRoom(roomRes.data);

        if (roomRes.data.video) {
            try {
                // Если video пришло как ID
                if (typeof roomRes.data.video === 'number') {
                    const movieRes = await api.get(`movies/${roomRes.data.video}/`);
                    setMovie(movieRes.data);
                } else {
                    // Если video пришло как объект (зависит от сериализатора)
                    setMovie(roomRes.data.video);
                }
            } catch { console.log("Фильм не найден"); }
        }

        try {
            const messagesRes = await api.get(`messages/?room=${roomName}`);
            const formattedMessages = messagesRes.data.map(msg => ({
                username: msg.user_name,
                message: msg.content,
                timestamp: msg.timestamp
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

  // 2. Подключение к WebSocket
  useEffect(() => {
    if (!roomName) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl;
    if (process.env.NODE_ENV === 'production') {
        // В докере: ws://domain.com/ws/...
        wsUrl = `${protocol}//${window.location.host}/ws/player/${roomName}/`;
    } else {
        // Локально: ws://192.168.X.X:8000/ws/...
        // Тут тоже лучше использовать IP
        const LOCAL_IP = '192.168.1.116'; // Или твой реальный IP
        wsUrl = `ws://${LOCAL_IP}:8000/ws/player/${roomName}/`;
    }
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket подключен');
      setIsConnected(true);
      sendVideoEvent('request_sync');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat_message') {
        setMessages((prev) => [...prev, data]);
      } else if (data.type === 'video_event') {
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

  // === ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ПРИМЕНЕНИЯ СИНХРОНИЗАЦИИ ===
  const applySyncData = (data) => {
      if (!videoRef.current) return;
      
      const diff = Math.abs(videoRef.current.currentTime - data.currentTime);
      
      if (diff > 0.5 || videoRef.current.currentTime === 0) {
          videoRef.current.currentTime = data.currentTime;
      }
      
      if (data.paused) {
          videoRef.current.pause();
      } else {
          videoRef.current.play().catch(e => {
              console.log("Autoplay blocked:", e);
          });
      }
      
      hasSyncedInitial.current = true;
      pendingSync.current = null;
  };

  // --- ЛОГИКА ВИДЕО ---
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

  // --- ЛОГИКА ЧАТА ---
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

  const videoSrc = movie?.video || movie?.video_url;

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
                {messages.map((msg, index) => (
                    <div key={index} className={`chat-msg ${msg.username === username ? 'my-msg' : ''}`}>
                        <span className="msg-user">{msg.username}:</span>
                        <span className="msg-text">{msg.message}</span>
                    </div>
                ))}
            </div>
            <div className="chat-input-area">
                {/* Здесь мы используем isGuest */}
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