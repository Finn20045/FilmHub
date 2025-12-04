import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast'; // <--- Новые уведомления
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

  const storedUser = localStorage.getItem('username');
  const isGuest = !storedUser;
  const username = storedUser || 'Аноним';

  // Проверка: является ли текущий юзер владельцем
  // room.owner_name приходит с бэкенда
  const isOwner = room && room.owner_name === username;

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
                avatar: null 
            }));
            setMessages(formattedMessages);
        } catch (err) { console.error("Ошибка чата:", err); }

      } catch (err) {
        toast.error('Комната не найдена или удалена');
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
      
      // === НОВАЯ ЛОГИКА: ОБРАБОТКА КИКА ===
      if (data.type === 'user_kicked') {
          if (data.kicked_username === username) {
              // Если кикнули МЕНЯ
              ws.close();
              navigate('/rooms');
              toast.error('⛔ Вас выгнали из комнаты');
          } else {
              // Если кикнули КОГО-ТО ДРУГОГО
              toast(`${data.kicked_username} был изгнан`, { icon: '👢' });
          }
          return;
      }
      // ====================================

      if (data.type === 'chat_message') {
        setMessages((prev) => [...prev, data]);
      } 
      else if (data.type === 'system') {
          // Вместо текста в чате показываем красивый Toast
          toast(data.message, {
              icon: '🔔',
              style: { borderRadius: '10px', background: '#333', color: '#fff' },
          });
      }
      else if (data.type === 'video_event') {
        handleRemoteVideoEvent(data);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [roomName, username, navigate]);

  // === ФУНКЦИЯ КИКА (ВЫЗЫВАЕТСЯ ПРИ КЛИКЕ НА ИМЯ) ===
  const handleUserClick = (targetUser) => {
      // Можно кикнуть только если:
      // 1. Я владелец
      // 2. Цель - не я сам
      if (isOwner && targetUser !== username) {
          if (window.confirm(`Выгнать пользователя ${targetUser}?`)) {
              wsRef.current.send(JSON.stringify({
                  type: 'kick_user',
                  username: targetUser
              }));
          }
      }
  };

  // ... (applySyncData, handleRemoteVideoEvent, handleVideoLoadedMetadata, sendVideoEvent) ...
  // Оставь эти функции как были в прошлом варианте
  const applySyncData = (data) => {
      if (!videoRef.current) return;
      const diff = Math.abs(videoRef.current.currentTime - data.currentTime);
      if (diff > 0.5 || videoRef.current.currentTime === 0) {
          videoRef.current.currentTime = data.currentTime;
      }
      if (data.paused) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
      hasSyncedInitial.current = true;
      pendingSync.current = null;
      videoRef.current.muted = false;
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
    if (data.action === 'play') videoRef.current.play().catch(() => {});
    else if (data.action === 'pause') videoRef.current.pause();
    else if (data.action === 'seek') {
        if (Math.abs(videoRef.current.currentTime - data.data.currentTime) > 1) {
            videoRef.current.currentTime = data.data.currentTime;
        }
    }
    setTimeout(() => { isRemoteUpdate.current = false; }, 500);
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

  if (loading) return <div className="loading">Загрузка...</div>;
  
  let videoSrc = null;
  if (movie) {
      if (movie.video) videoSrc = movie.video;
      else if (movie.video_url) videoSrc = movie.video_url;
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
                        muted={!hasSyncedInitial.current}
                    >
                        <source src={videoSrc} type="video/mp4" />
                    </video>
                ) : (
                    <div className="no-video-placeholder"><h3>🎬 Фильм не выбран</h3></div>
                )}
            </div>
            
            <div className="video-info">
                <h1>{room?.name}</h1>
                <p className="movie-title">
                   Фильм: <span>{movie?.title || 'Загрузка...'}</span>
                   {isConnected ? <span style={{color:'#00b894', marginLeft:'15px'}}>● Онлайн</span> : null}
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
                                {/* === ИМЯ СТАЛО КЛИКАБЕЛЬНЫМ === */}
                                <span 
                                    className="msg-user" 
                                    style={isOwner && !isMyMsg ? {cursor: 'pointer', textDecoration: 'underline'} : {}}
                                    onClick={() => handleUserClick(msg.username)}
                                    title={isOwner && !isMyMsg ? "Нажмите, чтобы выгнать" : ""}
                                >
                                    {msg.username}
                                </span>
                                {/* ============================== */}
                                <span className="msg-text">{msg.message}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="chat-input-area">
                {isGuest ? (
                    <div style={{padding: '10px', color: '#777', textAlign: 'center'}}>
                        <span onClick={() => navigate('/login')} style={{cursor:'pointer', textDecoration:'underline'}}>Войдите</span>
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