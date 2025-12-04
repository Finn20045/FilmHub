import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { api } from '../Services/api';
import RoomList from '../components/Rooms/RoomList';
import '../styles/pages/RoomsPage.css';

function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const username = localStorage.getItem('username');
  
  // Модальные окна
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Состояние для файла
  const [videoFile, setVideoFile] = useState(null);
  
  // Данные для создания комнаты
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    max_participants: 10,
    password: '',
    movie_id: ''
  });

  const handleDeleteRoom = async (roomName) => {
      try {
          await api.delete(`rooms/${roomName}/`);
          // Обновляем список сразу
          setRooms(prev => prev.filter(r => r.name !== roomName));
      } catch (err) {
          alert("Ошибка при удалении. Возможно, вы не владелец.");
      }
  };

  // Данные для входа
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [joinPassword, setJoinPassword] = useState('');
  const [joinError, setJoinError] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    loadRoomsAndMovies();
    const interval = setInterval(() => {
        api.get('rooms/')
           .then(res => setRooms(res.data))
           .catch(err => console.log("Silent update error", err));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadRoomsAndMovies = async () => {
    try {
      setLoading(true);
      const [roomsRes, moviesRes] = await Promise.all([
        api.get('rooms/'),
        api.get('movies/')
      ]);
      setRooms(roomsRes.data);
      setMovies(moviesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Не удалось загрузить список комнат.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    //setError(null);
    
    const loadingToast = toast.loading('Создаем комнату...');

    const formData = new FormData();
    formData.append('name', createFormData.name);
    formData.append('description', createFormData.description);
    formData.append('max_participants', createFormData.max_participants);
    
    if (createFormData.password) {
        formData.append('password', createFormData.password);
    }
    
    if (videoFile) {
        formData.append('video_file', videoFile);
    } else if (createFormData.movie_id) {
        formData.append('video', createFormData.movie_id);
    }

    try {
      const response = await api.post('rooms/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.dismiss(loadingToast); // Убираем спиннер
      toast.success('Комната успешно создана!'); // Показываем успех
      setShowCreateModal(false);
      setCreateFormData({ name: '', description: '', max_participants: 10, password: '', movie_id: '' });
      setVideoFile(null);
      navigate(`/player/${response.data.name}`);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Ошибка создания. Возможно, имя занято.'); // Показываем ошибку
    }
  };

  const handleJoinClick = (roomName) => {
    const room = rooms.find(r => r.name === roomName);
    if (room.is_protected) {
        setSelectedRoom(roomName);
        setJoinPassword('');
        setJoinError('');
        setShowPasswordModal(true);
    } else {
        navigate(`/player/${roomName}`);
    }
  };

  const submitJoinPassword = async (e) => {
    e.preventDefault();
    setJoinError('');
    try {
        await api.post(`rooms/${selectedRoom}/verify_password/`, {
            password: joinPassword
        });
        setShowPasswordModal(false);
        navigate(`/player/${selectedRoom}`);
    } catch (err) {
        setJoinError('Неверный пароль');
    }
  };

  const handleCreateChange = (e) => {
    setCreateFormData({ ...createFormData, [e.target.name]: e.target.value });
  };

  if (loading) return <div className="loading">Загрузка комнат...</div>;

  return (
    <div className="rooms-page">
      <div className="rooms-header">
        <h1>🎪 Комнаты для просмотра</h1>
        <p>Присоединяйтесь к существующим комнатам или создайте свою</p>
        {username && (
            <button 
              className="btn-primary large"
              onClick={() => setShowCreateModal(true)}
            >
              ➕ Создать комнату
            </button>
        )}
      </div>
        
      {error && <div style={{ color: 'red', textAlign: 'center', marginBottom: '20px' }}>{error}</div>}

      {/* Передаем новые пропсы в RoomList */}
      <RoomList 
          rooms={rooms} 
          onJoin={handleJoinClick} 
          currentUser={username} 
          onDelete={handleDeleteRoom}
      />
      {/* === МОДАЛКА 1: СОЗДАНИЕ === */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>🎬 Создать новую комнату</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleCreateRoom} className="create-room-form">
              <div className="form-group">
                <label>Название комнаты *</label>
                <input type="text" name="name" value={createFormData.name} onChange={handleCreateChange} required />
              </div>
              
              <div className="form-group">
                <label>Пароль (опционально)</label>
                <input type="password" name="password" value={createFormData.password} onChange={handleCreateChange} placeholder="Оставьте пустым для открытой комнаты" />
              </div>
              
              <div className="form-group">
                <label>Описание</label>
                <textarea name="description" value={createFormData.description} onChange={handleCreateChange} rows="2" />
              </div>

              {/* === ВЫБОР ФИЛЬМА ИЛИ ЗАГРУЗКА (ВНУТРИ ФОРМЫ) === */}
              <div className="form-group">
                <label>Выберите фильм из каталога...</label>
                <select
                  name="movie_id"
                  value={createFormData.movie_id}
                  onChange={(e) => {
                      handleCreateChange(e);
                      setVideoFile(null);
                  }}
                  disabled={!!videoFile}
                >
                  <option value="">-- Не выбрано --</option>
                  {movies.map(movie => (<option key={movie.id} value={movie.id}>{movie.title}</option>))}
                </select>
              </div>

              <div style={{textAlign: 'center', margin: '10px 0', color: '#aaa'}}>- ИЛИ -</div>

              <div className="form-group">
                <label>...загрузите свой файл</label>
                <input 
                    type="file" 
                    accept="video/mp4,video/webm"
                    onChange={(e) => {
                        setVideoFile(e.target.files[0]);
                        setCreateFormData({...createFormData, movie_id: ''});
                    }}
                    disabled={!!createFormData.movie_id}
                />
              </div>
              {/* ================================================== */}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Отмена</button>
                <button type="submit" className="btn-primary">🚀 Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === МОДАЛКА 2: ВВОД ПАРОЛЯ === */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px'}}>
            <div className="modal-header">
              <h2>🔒 Комната защищена</h2>
              <button className="close-btn" onClick={() => setShowPasswordModal(false)}>×</button>
            </div>
            <form onSubmit={submitJoinPassword}>
                <p style={{marginBottom: '15px', color: '#ccc'}}>Введите пароль для входа в <b>{selectedRoom}</b>:</p>
                <div className="form-group">
                    <input 
                        type="password" 
                        value={joinPassword} 
                        onChange={(e) => setJoinPassword(e.target.value)}
                        placeholder="Пароль"
                        autoFocus
                    />
                </div>
                {joinError && <div style={{color: 'red', marginBottom: '10px'}}>{joinError}</div>}
                <div className="form-actions">
                    <button type="submit" className="btn-primary" style={{width: '100%'}}>Войти</button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Rooms;