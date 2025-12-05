import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../Services/api';
import toast from 'react-hot-toast';
import RoomList from '../components/Rooms/RoomList';
import '../styles/pages/RoomsPage.css';

function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]); // <--- Новое состояние
  
  const [loading, setLoading] = useState(true);
  const username = localStorage.getItem('username');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Тип контента: 'movie', 'series', 'file'
  const [contentType, setContentType] = useState('movie'); 
  const [videoFile, setVideoFile] = useState(null);
  
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    max_participants: 10,
    password: '',
    movie_id: '',
    series_id: '' // <--- Новое поле
  });

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [joinPassword, setJoinPassword] = useState('');

  const navigate = useNavigate();

  // Загрузка данных
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
        api.get('rooms/')
           .then(res => setRooms(res.data))
           .catch(err => console.log("Silent update error", err));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [roomsRes, moviesRes, seriesRes] = await Promise.all([
        api.get('rooms/'),
        api.get('movies/'),
        api.get('series/') // <--- Грузим сериалы
      ]);
      setRooms(roomsRes.data);
      setMovies(moviesRes.data);
      setSeries(seriesRes.data);
    } catch (error) {
      console.error(error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  // Создание комнаты
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    const toastId = toast.loading('Создаем комнату...');
    
    const formData = new FormData();
    formData.append('name', createFormData.name);
    formData.append('description', createFormData.description);
    formData.append('max_participants', createFormData.max_participants);
    if (createFormData.password) formData.append('password', createFormData.password);
    
    // Логика выбора контента
    if (contentType === 'file' && videoFile) {
        formData.append('video_file', videoFile);
    } else if (contentType === 'movie' && createFormData.movie_id) {
        formData.append('video', createFormData.movie_id); // video = movie_id
    } else if (contentType === 'series' && createFormData.series_id) {
        formData.append('series_id', createFormData.series_id);
    }

    try {
      const response = await api.post('rooms/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Комната создана!', { id: toastId });
      setShowCreateModal(false);
      resetForm();
      navigate(`/player/${response.data.name}`);
    } catch (error) {
      toast.error('Ошибка создания. Имя занято или неверные данные.', { id: toastId });
    }
  };

  const resetForm = () => {
      setCreateFormData({ name: '', description: '', max_participants: 10, password: '', movie_id: '', series_id: '' });
      setVideoFile(null);
      setContentType('movie');
  };

  // Вход в комнату
  const handleJoinClick = (roomName) => {
    const room = rooms.find(r => r.name === roomName);
    if (room.is_protected) {
        setSelectedRoom(roomName);
        setJoinPassword('');
        setShowPasswordModal(true);
    } else {
        navigate(`/player/${roomName}`);
    }
  };

  const submitJoinPassword = async (e) => {
    e.preventDefault();
    try {
        await api.post(`rooms/${selectedRoom}/verify_password/`, { password: joinPassword });
        setShowPasswordModal(false);
        navigate(`/player/${selectedRoom}`);
    } catch (err) {
        toast.error('Неверный пароль');
    }
  };

  const handleCreateChange = (e) => {
    setCreateFormData({ ...createFormData, [e.target.name]: e.target.value });
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div className="rooms-page">
      <div className="rooms-header">
        <h1>🎪 Комнаты</h1>
        <p>Смотрите фильмы и сериалы вместе</p>
        {username && (
            <button className="btn-primary large" onClick={() => setShowCreateModal(true)}>
              ➕ Создать комнату
            </button>
        )}
      </div>

      <RoomList rooms={rooms} onJoin={handleJoinClick} currentUser={username} onDelete={async (name) => {
          try { await api.delete(`rooms/${name}/`); setRooms(p => p.filter(r => r.name !== name)); toast.success('Удалено'); } 
          catch { toast.error('Ошибка'); }
      }}/>

      {/* === МОДАЛКА СОЗДАНИЯ === */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>🎬 Новая комната</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleCreateRoom} className="create-room-form">
              <div className="form-group">
                <label>Название *</label>
                <input type="text" name="name" value={createFormData.name} onChange={handleCreateChange} required />
              </div>
              
              <div className="form-group">
                <label>Пароль (необязательно)</label>
                <input type="password" name="password" value={createFormData.password} onChange={handleCreateChange} />
              </div>

              {/* === ВЫБОР ТИПА КОНТЕНТА === */}
              <div className="content-type-tabs" style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
                  <button type="button" className={`tab-btn ${contentType === 'movie' ? 'active' : ''}`} onClick={() => setContentType('movie')}>Фильм</button>
                  <button type="button" className={`tab-btn ${contentType === 'series' ? 'active' : ''}`} onClick={() => setContentType('series')}>Сериал</button>
                  <button type="button" className={`tab-btn ${contentType === 'file' ? 'active' : ''}`} onClick={() => setContentType('file')}>Свой файл</button>
              </div>

              {/* Условие отрисовки полей */}
              {contentType === 'movie' && (
                  <div className="form-group">
                    <label>Выберите фильм:</label>
                    <select name="movie_id" value={createFormData.movie_id} onChange={handleCreateChange} required>
                      <option value="">-- Выберите --</option>
                      {movies.map(m => (<option key={m.id} value={m.id}>{m.title}</option>))}
                    </select>
                  </div>
              )}

              {contentType === 'series' && (
                  <div className="form-group">
                    <label>Выберите сериал:</label>
                    <select name="series_id" value={createFormData.series_id} onChange={handleCreateChange} required>
                      <option value="">-- Выберите --</option>
                      {series.map(s => (<option key={s.id} value={s.id}>{s.title}</option>))}
                    </select>
                  </div>
              )}

              {contentType === 'file' && (
                  <div className="form-group">
                    <label>Загрузите видео (MP4/WebM):</label>
                    <input type="file" accept="video/mp4,video/webm" onChange={(e) => setVideoFile(e.target.files[0])} required />
                  </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Отмена</button>
                <button type="submit" className="btn-primary">🚀 Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка пароля (оставляем старую логику или копируем из прошлого файла) */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px'}}>
            <div className="modal-header"><h2>🔒 Пароль</h2><button className="close-btn" onClick={() => setShowPasswordModal(false)}>×</button></div>
            <form onSubmit={submitJoinPassword}>
                <div className="form-group"><input type="password" value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)} placeholder="Введите пароль" autoFocus /></div>
                <div className="form-actions"><button type="submit" className="btn-primary" style={{width: '100%'}}>Войти</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Rooms;