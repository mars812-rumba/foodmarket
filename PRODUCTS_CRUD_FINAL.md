# CRUD для управления товарами - Финальная версия

## ✅ Что было реализовано

### Backend (Python/FastAPI):
- Полный CRUD для товаров с моделями данных Pydantic
- API endpoints с авторизацией через Bearer token
- Загрузка и управление фотографиями
- Автоматическая генерация slug из названия
- CORS настроен для production и development

### Frontend (React/TypeScript):
- Страница управления товарами `/admin/products`
- Создание, редактирование, удаление товаров
- Фильтрация по категориям и поиск
- Загрузка фотографий
- Адаптивный дизайн

## 🚀 Запуск для разработки

### Backend (порт 5006):
```bash
cd backend
PORT=5006 python3 web_integration.py
```

### Frontend:
```bash
npm run dev
```

Откройте: http://localhost:5173/admin/products

## 🌐 Production настройки

### Backend должен быть настроен на вашем сервере:
- Запустите на нужном порту (5005, 5006, или 5007)
- Настройте nginx для проксирования API запросов
- Убедитесь что CORS разрешает ваш домен

### Frontend:
- Соберите проект: `npm run build`
- Разверните содержимое папки `dist` на вашем сервере

## 📁 Структура файлов

```
backend/
├── web_integration.py      # API endpoints и модели
├── data/
│   └── inventory.json     # База данных товаров
└── media/                 # Загруженные фото

src/
├── pages/
│   └── admin/
│       ├── ProductsPage.tsx  # Страница управления
│       └── LoginPage.tsx     # Страница входа (опционально)
└── main.tsx                  # Маршруты
```

## 🔧 Решение проблем

### CORS ошибки:
1. Убедитесь что backend запущен
2. Проверьте что порт в frontend совпадает с портом backend
3. Для production добавьте ваш домен в CORS настройки

### Авторизация:
- Временно используется фиксированный токен
- Для production настройте полноценную авторизацию

## 📝 API Endpoints

- `GET /api/admin/products` - список товаров
- `GET /api/admin/products/{id}` - получить товар
- `POST /api/admin/products` - создать товар
- `PUT /api/admin/products/{id}` - обновить товар
- `DELETE /api/admin/products/{id}` - удалить товар
- `POST /api/admin/products/{id}/upload-photo` - загрузить фото
- `DELETE /api/admin/products/{id}/photo` - удалить фото

Все endpoints требуют заголовок: `Authorization: Bearer secret-auth-token-for-sunny-rentals`