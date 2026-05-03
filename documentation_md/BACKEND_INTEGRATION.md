# 🔧 Интеграция Menu API в FastAPI

## Как подключить menu_api.py к web_integration.py?

### Шаг 1: Импортировать router в web_integration.py

В начало файла `backend/web_integration.py` добавь:

```python
from menu_api import create_menu_router
```

### Шаг 2: Создать и подключить router

В функции создания FastAPI приложения (где создаётся `app = FastAPI()`), добавь:

```python
# Создать menu router
menu_router = create_menu_router(data_path="./data/ar")
app.include_router(menu_router)
```

Обычно это выглядит так:

```python
# ============================================
# FASTAPI APP SETUP
# ============================================

app = FastAPI(title="Sunny Rentals API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ INCLUDE ROUTERS ============
# Существующие routers...
# app.include_router(some_router)

# Добавить Menu Router
menu_router = create_menu_router(data_path="./data/ar")
app.include_router(menu_router)
```

### Шаг 3: Проверить endpoints

После запуска FastAPI сервера, endpoints будут доступны:

```
GET    /api/restaurants/{restaurant_id}/menu
GET    /api/restaurants/{restaurant_id}/config
POST   /api/restaurants/{restaurant_id}/menu
POST   /api/restaurants/{restaurant_id}/upload-menu-photos
PUT    /api/restaurants/{restaurant_id}/menu/{menu_id}
DELETE /api/restaurants/{restaurant_id}/menu/{menu_id}
```

## Структура данных на диске

После первого запроса будет создана структура:

```
backend/data/ar/restaurants/
├─ pizzeria_1/
│  ├─ config.json
│  ├─ menu.json
│  └─ images/
│     ├─ margarita_0.jpg
│     ├─ margarita_1.jpg
│     └─ ...
│
└─ burger_1/
   ├─ config.json
   ├─ menu.json
   └─ images/
```

## Примеры API запросов

### 1. Получить меню ресторана

```bash
curl http://localhost:5003/api/restaurants/pizzeria_1/menu
```

**Ответ:**
```json
{
  "restaurant_id": "pizzeria_1",
  "categories": ["pizza", "burger"],
  "items": [
    {
      "id": "margarita",
      "name": "Маргарита",
      "slug": "margarita",
      "category": "pizza",
      "price": 500,
      "weight": "350г",
      "image": "images/margarita_0.jpg",
      "available": true,
      "notes": "Помидоры, моцарелла, базилик",
      "ingredients": [
        {
          "id": "cheese",
          "name": "Доп. сыр",
          "price": 100
        }
      ],
      "photos": {
        "main": "images/margarita_0.jpg",
        "gallery": []
      },
      "updated_at": "2026-04-19T11:55:00"
    }
  ]
}
```

### 2. Добавить блюдо

```bash
curl -X POST http://localhost:5003/api/restaurants/pizzeria_1/menu \
  -H "Content-Type: application/json" \
  -d '{
    "id": "pepperoni",
    "name": "Пепперони",
    "slug": "pepperoni",
    "category": "pizza",
    "price": 650,
    "weight": "400г",
    "image": "images/pepperoni_0.jpg",
    "available": true,
    "notes": "Пепперони, сыр, томаты",
    "ingredients": [
      {
        "id": "cheese",
        "name": "Доп. сыр",
        "price": 100
      }
    ],
    "photos": {
      "main": "images/pepperoni_0.jpg",
      "gallery": []
    }
  }'
```

### 3. Загрузить фото

```bash
curl -X POST http://localhost:5003/api/restaurants/pizzeria_1/upload-menu-photos \
  -F "menu_id=margarita" \
  -F "photos=@/path/to/photo1.jpg" \
  -F "photos=@/path/to/photo2.jpg"
```

**Ответ:**
```json
{
  "status": "ok",
  "uploaded": [
    "images/margarita_0.jpg",
    "images/margarita_1.jpg"
  ]
}
```

### 4. Обновить блюдо

```bash
curl -X PUT http://localhost:5003/api/restaurants/pizzeria_1/menu/margarita \
  -H "Content-Type: application/json" \
  -d '{
    "id": "margarita",
    "name": "Маргарита Премиум",
    "slug": "margarita",
    "category": "pizza",
    "price": 600,
    "weight": "400г",
    "image": "images/margarita_0.jpg",
    "available": true,
    "notes": "Премиум помидоры, моцарелла, базилик",
    "ingredients": [
      {
        "id": "cheese",
        "name": "Доп. сыр",
        "price": 100
      }
    ],
    "photos": {
      "main": "images/margarita_0.jpg",
      "gallery": []
    }
  }'
```

### 5. Удалить блюдо

```bash
curl -X DELETE http://localhost:5003/api/restaurants/pizzeria_1/menu/margarita
```

## Тестирование в Swagger UI

После запуска FastAPI, открой:

```
http://localhost:5003/docs
```

Там будут все endpoints с возможностью тестирования прямо в браузере.

## Обработка ошибок

### 404 - Блюдо не найдено
```json
{
  "detail": "Блюдо не найдено"
}
```

### 400 - Блюдо с таким ID уже существует
```json
{
  "detail": "Блюдо с таким ID уже существует"
}
```

### 500 - Ошибка сервера
```json
{
  "detail": "Ошибка сохранения: ..."
}
```

## Переменные окружения

Если нужно использовать разные пути для разных сред:

```python
# В web_integration.py
import os

DATA_PATH = os.getenv("DATA_PATH", "./data/ar")
menu_router = create_menu_router(data_path=DATA_PATH)
app.include_router(menu_router)
```

Затем в `.env`:
```
DATA_PATH=./data/ar
```

## Логирование

Для отладки добавь логирование в menu_api.py:

```python
import logging

logger = logging.getLogger(__name__)

# В функциях:
logger.info(f"Загружаю меню для {restaurant_id}")
logger.error(f"Ошибка: {e}")
```

## Что дальше?

1. ✅ Создал menu_api.py с endpoints
2. ⏳ Нужно подключить router в web_integration.py
3. ⏳ Нужно создать тестовые данные (menu.json, config.json)
4. ⏳ Нужно протестировать endpoints
5. ⏳ Нужно интегрировать с фронтом (Home.tsx)

## Быстрый старт

1. Скопируй код выше в web_integration.py
2. Запусти FastAPI: `python backend/web_integration.py`
3. Открой http://localhost:5003/docs
4. Тестируй endpoints в Swagger UI
5. Проверь что файлы создаются в `backend/data/ar/restaurants/`

## Контакты

Если есть вопросы — пиши! 🚀
