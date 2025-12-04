import axios from 'axios';

// Базовый URL теперь включает /api/
const API_BASE_URL = 'http://127.0.0.1:8000/api/';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // ОБЯЗАТЕЛЬНО: Разрешает передачу кук (сессии)
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