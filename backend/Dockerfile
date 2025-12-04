# Используем Python
FROM python:3.11-slim

# Рабочая папка
WORKDIR /app

# Ставим зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Ставим daphne отдельно (иногда не попадает в requirements)
RUN pip install daphne

# Копируем код
COPY . .

# Собираем статику (для админки)
# RUN python manage.py collectstatic --noinput

# Запускаем через Daphne (нужен для WebSockets!)
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]