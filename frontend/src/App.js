import './styles/global.css';
import './App.css';
import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Movies from './pages/Movies';
import Header from './components/Layout/Header';
import Home from './pages/Home';
import Rooms from './pages/Rooms';
import RoomPlayer from './pages/RoomPlayer';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Profile from './components/User/Profile';
import { api } from './Services/api';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('username'));
  const [user, setUser] = useState(localStorage.getItem('username'));

  useEffect(() => {
    // Этот код сработает, если мы вручную почистим storage, но оставим вкладку открытой
    const storedUser = localStorage.getItem('username');
    if (storedUser) {
        setIsLoggedIn(true);
        setUser(storedUser);
    } else {
        setIsLoggedIn(false);
        setUser(null);
    }
  }, []);

  const handleLogin = (username) => {
    setIsLoggedIn(true);
    setUser(username);
  };

  const handleLogout = async () => {
    try {
        await api.post('auth/logout/'); // Сообщаем серверу
    } catch (e) {
        console.error("Logout error", e);
    }
    
    // Чистим клиент
    setIsLoggedIn(false);
    setUser(null);
    localStorage.removeItem('username');
  };

  const handleRegister = (username) => {
    setIsLoggedIn(true);
    setUser(username);
  };

  return (
    <Router>
      <div className="App">
        <Toaster 
            position="top-center" 
            toastOptions={{
                style: {
                    background: '#333',
                    color: '#fff',
                },
                success: {
                    iconTheme: {
                        primary: '#6c5ce7',
                        secondary: '#fff',
                    },
                },
            }}
        />
        <Header 
          currentPage={currentPage} 
          onNavigate={setCurrentPage}
          isLoggedIn={isLoggedIn}
          user={user}
          onLogout={handleLogout}
        />
        
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home onNavigate={setCurrentPage} />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/login" element={
              isLoggedIn ? <Navigate to="/" /> : <Login onLogin={handleLogin} />
            } />
            <Route path="/register" element={
              isLoggedIn ? <Navigate to="/" /> : <Register onRegister={handleRegister} />
            } />
            <Route path="/player/:roomName" element={<RoomPlayer />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>&copy; 2024 FilmHub. Совместный просмотр фильмов в реальном времени</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;