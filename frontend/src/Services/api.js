import axios from 'axios';

// === ЛОГИКА ОПРЕДЕЛЕНИЯ АДРЕСА ===
// Если мы в разработке (npm start) - используем локальный IP или localhost
// Если мы в продакшене (Docker/Nginx) - используем относительный путь
const isProduction = process.env.NODE_ENV === 'production';

// ВАЖНО: Если ты запускаешь это локально на Windows, впиши сюда свой IP в локальной сети
// (например 192.168.1.5), чтобы телефон мог подключиться.
// Команда 'ipconfig' в терминале покажет твой IPv4.
const LOCAL_IP = '192.168.1.116'; // Поменяй на 192.168.X.X для теста с телефона без докера

const API_BASE_URL = isProduction 
    ? '/api/' // В Докере Nginx сам перенаправит /api на бэкенд
    : `http://${LOCAL_IP}:8000/api/`;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерцептор для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.log('Пользователь не авторизован');
      // Здесь можно добавить редирект на логин, если нужно
    }
    return Promise.reject(error);
  }
);

export { api };