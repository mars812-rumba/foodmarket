# 🍕 Полная инструкция: Система управления меню ресторана

## 📋 Что было создано?

### Фронтенд
- ✅ **MenuManager.tsx** — админка для управления меню ресторана
- ✅ **Маршрут** `/admin/menu` в main.tsx
- ✅ **Структура папок** для героев и меню в assets/

### Бекенд
- ✅ **menu_api.py** — FastAPI endpoints для меню
- ✅ **Тестовые данные** для pizzeria_1
- ✅ **Структура папок** для ресторанов

### Документация
- ✅ **MENU_MANAGER_GUIDE.md** — инструкция по админке
- ✅ **BACKEND_INTEGRATION.md** — как подключить API
- ✅ **RESTAURANT_MENU_SETUP.md** — этот файл

---

## 🚀 Быстрый старт

### 1️⃣ Подключить API к FastAPI

Открой `backend/web_integration.py` и найди где создаётся `app = FastAPI()`.

Добавь в начало файла:
```python
from menu_api import create_menu_router
```

Затем после создания app добавь:
```python
# ============ MENU ROUTER ============
menu_router = create_menu_router(data_path="./data/ar")
app.include_router(menu_router)
```

### 2️⃣ Запустить бекенд

```bash
cd backend
python web_integration.py
```

Проверь что сервер запустился на `http://localhost:5003`

### 3️⃣ Запустить фронтенд

```bash
npm run dev
```

Проверь что приложение запустилось на `http://localhost:5173`

### 4️⃣ Открыть админку

Перейди на: `http://localhost:5173/admin/menu`

---

## 📁 Структура проекта

```
simple-ar/
├─ src/
│  ├─ pages/
│  │  ├─ Home.tsx (витрина ресторана)
│  │  ├─ admin/
│  │  │  ├─ MenuManager.tsx ← НОВАЯ АДМИНКА
│  │  │  ├─ RestManager.tsx (управление ресторанами)
│  │  │  └─ ...
│  │
│  ├─ assets/
│  │  ├─ heroes/
│  │  │  ├─ hero_pizza.png
│  │  │  └─ hero_burger.png
│  │  │
│  │  └─ menu/
│  │     ├─ potato_chicken_menu.png
│  │     ├─ sushi_menu.png
│  │     ├─ steak_menu.png
│  │     ├─ carbonara_menu.png
│  │     └─ drinks_menu.png
│  │
│  └─ main.tsx (маршруты)
│
├─ backend/
│  ├─ web_integration.py (основной FastAPI файл)
│  ├─ menu_api.py ← НОВЫЙ API
│  │
│  └─ data/ar/restaurants/
│     ├─ pizzeria_1/
│     │  ├─ config.json ← ТЕСТОВЫЕ ДАННЫЕ
│     │  ├─ menu.json ← ТЕСТОВЫЕ ДАННЫЕ
│     │  └─ images/ (фото блюд)
│     │
│     └─ burger_1/ (можно добавить ещё ресторанов)
│
├─ MENU_MANAGER_GUIDE.md (инструкция админки)
├─ BACKEND_INTEGRATION.md (как подключить API)
└─ RESTAURANT_MENU_SETUP.md (этот файл)
```

---

## 🎯 Как это работает?

### Поток данных

```
Админ открывает MenuManager.tsx
    ↓
Выбирает ресторан из выпадающего меню
    ↓
GET /api/restaurants/{restaurant_id}/menu
    ↓
Загружается menu.json из backend/data/ar/restaurants/{restaurant_id}/
    ↓
Админ видит список блюд в сетке
    ↓
Админ нажимает "+ Блюдо"
    ↓
Открывается форма редактирования
    ↓
Админ заполняет:
  - Название
  - Категорию
  - Цену
  - Вес/размер
  - Описание
  - Ингредиенты (опционально)
  - Фото
    ↓
Админ нажимает "СОХРАНИТЬ"
    ↓
POST /api/restaurants/{restaurant_id}/menu
    ↓
Блюдо добавляется в menu.json
    ↓
Админ видит новое блюдо в сетке
```

### На фронте (Home.tsx)

```
Клиент открывает витрину
    ↓
GET /api/restaurants/{restaurant_id}/menu
    ↓
Загружается меню
    ↓
Показываются 2 ГЕРОЯ (пицца и бургер)
    ↓
Показывается дропсобой меню с иконками категорий
    ↓
Клиент нажимает на категорию
    ↓
Выезжает Bottom Sheet с блюдами этой категории
    ↓
Клиент выбирает ингредиенты
    ↓
Нажимает "В корзину"
    ↓
Блюдо добавляется в корзину
```

---

## 📊 API Endpoints

### GET endpoints

#### Получить меню ресторана
```
GET /api/restaurants/{restaurant_id}/menu
```

**Пример:**
```bash
curl http://localhost:5003/api/restaurants/pizzeria_1/menu
```

**Ответ:**
```json
{
  "restaurant_id": "pizzeria_1",
  "categories": ["pizza", "burger", "steak"],
  "items": [
    {
      "id": "margarita",
      "name": "Маргарита",
      "category": "pizza",
      "price": 500,
      "weight": "350г",
      "image": "images/margarita.jpg",
      "available": true,
      "ingredients": [...]
    }
  ]
}
```

#### Получить конфиг ресторана
```
GET /api/restaurants/{restaurant_id}/config
```

---

### POST endpoints

#### Добавить блюдо
```
POST /api/restaurants/{restaurant_id}/menu
Content-Type: application/json

{
  "id": "margarita",
  "name": "Маргарита",
  "slug": "margarita",
  "category": "pizza",
  "price": 500,
  "weight": "350г",
  "image": "images/margarita.jpg",
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
    "main": "images/margarita.jpg",
    "gallery": []
  }
}
```

#### Загрузить фото
```
POST /api/restaurants/{restaurant_id}/upload-menu-photos
Content-Type: multipart/form-data

menu_id: margarita
photos: [file1.jpg, file2.jpg]
```

---

### PUT endpoints

#### Обновить блюдо
```
PUT /api/restaurants/{restaurant_id}/menu/{menu_id}
Content-Type: application/json

{
  "id": "margarita",
  "name": "Маргарита Премиум",
  "price": 600,
  ...
}
```

---

### DELETE endpoints

#### Удалить блюдо
```
DELETE /api/restaurants/{restaurant_id}/menu/{menu_id}
```

---

## 🧪 Тестирование

### 1. Swagger UI

После запуска FastAPI, открой:
```
http://localhost:5003/docs
```

Там можно тестировать все endpoints прямо в браузере.

### 2. Curl команды

```bash
# Получить меню
curl http://localhost:5003/api/restaurants/pizzeria_1/menu

# Добавить блюдо
curl -X POST http://localhost:5003/api/restaurants/pizzeria_1/menu \
  -H "Content-Type: application/json" \
  -d '{"id":"test","name":"Test","category":"pizza","price":500,"weight":"300g","image":"","available":true,"notes":"","ingredients":[],"photos":{}}'

# Удалить блюдо
curl -X DELETE http://localhost:5003/api/restaurants/pizzeria_1/menu/test
```

### 3. Фронтенд

1. Открой `http://localhost:5173/admin/menu`
2. Выбери ресторан "PIZZA LOFT"
3. Нажми "+ Блюдо"
4. Заполни форму
5. Нажми "СОХРАНИТЬ"
6. Проверь что блюдо появилось в сетке

---

## 🎨 Категории блюд

| ID | Название | Иконка |
|----|----------|--------|
| pizza | Пицца | 🍕 |
| burger | Бургеры | 🍔 |
| steak | Стейки | 🥩 |
| pasta | Паста | 🍝 |
| sushi | Суши | 🍣 |
| drinks | Напитки | 🥤 |
| potato_chicken | Курица | 🍗 |

---

## 📝 Типы данных

### MenuItem
```typescript
{
  id: string,                    // уникальный ID
  name: string,                  // название блюда
  slug: string,                  // URL-friendly версия
  category: string,              // категория
  price: number,                 // цена в батах
  weight: string,                // вес/размер (350г, 500мл)
  image: string,                 // путь к фото
  ingredients?: Ingredient[],    // опциональные добавки
  available: boolean,            // видимо ли в меню
  notes: string,                 // описание/состав
  photos: {
    main?: string,               // основное фото
    gallery?: string[]           // галерея
  },
  updated_at?: string            // дата обновления
}
```

### Ingredient
```typescript
{
  id: string,                    // уникальный ID
  name: string,                  // название (Доп. сыр, Бекон)
  price: number                  // цена добавки
}
```

---

## 🔧 Конфигурация

### Переменные окружения

В `backend/.env`:
```
DATA_PATH=./data/ar
BOT_TOKEN=your_token_here
```

### Порты

- **Фронтенд**: http://localhost:5173
- **Бекенд**: http://localhost:5003
- **Swagger UI**: http://localhost:5003/docs

---

## ✅ Чек-лист

- [ ] Подключил menu_api.py в web_integration.py
- [ ] Запустил бекенд (`python backend/web_integration.py`)
- [ ] Запустил фронтенд (`npm run dev`)
- [ ] Открыл http://localhost:5173/admin/menu
- [ ] Выбрал ресторан "PIZZA LOFT"
- [ ] Добавил новое блюдо
- [ ] Загрузил фото
- [ ] Сохранил блюдо
- [ ] Проверил что блюдо появилось в сетке
- [ ] Открыл http://localhost:5173 и проверил витрину
- [ ] Нажал на категорию и увидел блюдо в Bottom Sheet

---

## 🐛 Решение проблем

### Ошибка: "Модуль menu_api не найден"
```
ModuleNotFoundError: No module named 'menu_api'
```

**Решение:** Убедись что menu_api.py находится в папке `backend/` рядом с web_integration.py

### Ошибка: "Блюдо с таким ID уже существует"
```
{"detail": "Блюдо с таким ID уже существует"}
```

**Решение:** ID генерируется автоматически из названия. Если добавляешь блюдо с тем же названием, система не позволит. Измени название.

### Ошибка: "Ошибка сохранения"
```
{"detail": "Ошибка сохранения: ..."}
```

**Решение:** Проверь что папка `backend/data/ar/restaurants/` существует и имеет права на запись.

### Фото не загружается
**Решение:** 
1. Проверь что название блюда заполнено
2. Проверь что файл не больше 5MB
3. Проверь что формат PNG или JPG

### Меню не загружается на фронте
**Решение:**
1. Проверь что бекенд запущен на http://localhost:5003
2. Проверь что CORS включен в web_integration.py
3. Открой DevTools (F12) и посмотри Network tab

---

## 📚 Дополнительные ресурсы

- [FastAPI документация](https://fastapi.tiangolo.com/)
- [React документация](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

---

## 🎉 Готово!

Система управления меню ресторана полностью готова к использованию!

### Что дальше?

1. **Добавить больше ресторанов** — создай папки burger_1, sushi_1 и т.д.
2. **Интегрировать с CRM** — сохранять заказы в базу данных
3. **Добавить оплату** — интегрировать платежные системы
4. **Добавить уведомления** — отправлять SMS/Telegram при заказе
5. **Добавить аналитику** — отслеживать популярные блюда

---

## 💬 Контакты

Если есть вопросы или проблемы — пиши! 🚀

**Создано:** 2026-04-19
**Версия:** 1.0.0
