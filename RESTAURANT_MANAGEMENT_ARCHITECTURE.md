# 🏪 Архитектура системы управления ресторанами

## 📋 Обзор

Система позволяет:
1. **Создавать рестораны** через админку (название, адрес, телефон, логотип)
2. **Управлять меню** каждого ресторана (добавлять блюда, ингредиенты, фото)
3. **Отображать витрину** для клиентов с динамической загрузкой меню по restaurant_id

---

## 🗂️ Структура данных

### Папки и файлы

```
backend/data/ar/
├─ restaurants.json                          # Список всех ресторанов
├─ restaurant_logos/
│  ├─ pizza_loft_logo.png
│  └─ burger_house_logo.jpg
└─ restaurants/
   ├─ pizza_loft/
   │  ├─ config.json                        # Конфиг ресторана
   │  ├─ menu.json                          # Меню (блюда, категории)
   │  └─ images/                            # Фото блюд (опционально)
   │
   └─ burger_house/
      ├─ config.json
      ├─ menu.json
      └─ images/

public/images_web/
└─ restaurants/
   ├─ pizza_loft/
   │  ├─ pizza_001_0.jpg
   │  ├─ pizza_001_1.jpg
   │  └─ burger_002_0.jpg
   │
   └─ burger_house/
      └─ ...
```

### restaurants.json

```json
[
  {
    "restaurant_id": "pizza_loft",
    "name": "PIZZA LOFT",
    "address": "Patong, Gay Bay",
    "phone": "+6678786969",
    "logo": "restaurant_logos/pizza_loft_logo.png",
    "created_at": "2026-04-23T16:50:00.000Z"
  }
]
```

### config.json (для каждого ресторана)

```json
{
  "restaurant_id": "pizza_loft",
  "name": "PIZZA LOFT",
  "address": "Patong, Gay Bay",
  "phone": "+6678786969",
  "logo": "restaurant_logos/pizza_loft_logo.png",
  "created_at": "2026-04-23T16:50:00.000Z"
}
```

### menu.json (для каждого ресторана)

```json
{
  "restaurant_id": "pizza_loft",
  "categories": ["pizza", "burger", "sushi"],
  "items": [
    {
      "id": "margarita",
      "name": "Маргарита",
      "slug": "margarita",
      "category": "pizza",
      "price": 500,
      "weight": "30cm",
      "image": "restaurants/pizza_loft/margarita_0.jpg",
      "ingredients": [
        {
          "id": "cheese",
          "name": "Сыр",
          "price": 100
        }
      ],
      "available": true,
      "notes": "Помидоры, моцарелла, базилик",
      "photos": {
        "main": "restaurants/pizza_loft/margarita_0.jpg",
        "gallery": ["restaurants/pizza_loft/margarita_1.jpg"]
      },
      "updated_at": "2026-04-23T16:50:00.000Z"
    }
  ]
}
```

---

## 🔌 API Endpoints

### Управление ресторанами

#### GET `/api/restaurants`
Получить список всех ресторанов
```json
{
  "restaurants": [
    {
      "id": "pizza_loft",
      "name": "PIZZA LOFT",
      "logo": "restaurant_logos/pizza_loft_logo.png"
    }
  ]
}
```

#### POST `/api/restaurants/upload-logo`
Загрузить логотип ресторана
```
Content-Type: multipart/form-data
- logo: File
- restaurant_id: string
```
Ответ:
```json
{
  "logo_path": "restaurant_logos/pizza_loft_logo.png"
}
```

#### POST `/api/restaurants`
Создать новый ресторан
```
Content-Type: multipart/form-data
- restaurant_id: string
- name: string
- address: string
- phone: string
- logo: string (путь от upload-logo)
```
Ответ:
```json
{
  "status": "ok",
  "restaurant": {
    "restaurant_id": "pizza_loft",
    "name": "PIZZA LOFT",
    "address": "Patong, Gay Bay",
    "phone": "+6678786969",
    "logo": "restaurant_logos/pizza_loft_logo.png",
    "created_at": "2026-04-23T16:50:00.000Z"
  }
}
```

### Управление меню

#### GET `/api/restaurants/{restaurant_id}/menu`
Получить меню ресторана
```json
{
  "restaurant_id": "pizza_loft",
  "categories": ["pizza", "burger"],
  "items": [...]
}
```

#### GET `/api/restaurants/{restaurant_id}/config`
Получить конфиг ресторана
```json
{
  "restaurant_id": "pizza_loft",
  "name": "PIZZA LOFT",
  "address": "Patong, Gay Bay",
  "phone": "+6678786969",
  "logo": "restaurant_logos/pizza_loft_logo.png"
}
```

#### POST `/api/restaurants/{restaurant_id}/menu`
Добавить блюдо в меню
```json
{
  "id": "margarita",
  "name": "Маргарита",
  "slug": "margarita",
  "category": "pizza",
  "price": 500,
  "weight": "30cm",
  "image": "",
  "ingredients": [],
  "available": true,
  "notes": "Помидоры, моцарелла, базилик",
  "photos": {"main": "", "gallery": []}
}
```

#### POST `/api/restaurants/{restaurant_id}/upload-menu-photos`
Загрузить фото для блюда
```
Content-Type: multipart/form-data
- photos: File[] (multiple)
- menu_id: string
- restaurant_id: string
```
Ответ:
```json
{
  "uploaded": [
    "restaurants/pizza_loft/margarita_0.jpg",
    "restaurants/pizza_loft/margarita_1.jpg"
  ],
  "count": 2
}
```

#### PUT `/api/restaurants/{restaurant_id}/menu/{menu_id}`
Обновить блюдо

#### DELETE `/api/restaurants/{restaurant_id}/menu/{menu_id}`
Удалить блюдо

---

## 🎨 Фронтенд компоненты

### MenuManager.tsx
- Выбор ресторана (dropdown)
- Кнопка "+ Ресторан" (открывает CreateRestaurantModal)
- Кнопка "+ Блюдо" (открывает форму добавления блюда)
- Сетка блюд с фильтрацией по категориям

### CreateRestaurantModal.tsx
- Поле: Название ресторана
- Поле: Адрес
- Поле: Телефон
- Загрузка логотипа (с preview)
- Кнопка "Создать"

**Логика:**
1. Генерируется `restaurant_id` из названия (транслитерация)
2. Загружается логотип → получаем путь
3. Создаётся ресторан с логотипом
4. Обновляется список ресторанов в dropdown

### Home.tsx (витрина)
- Загружает меню по `restaurant_id` из URL параметра
- Отображает герои блюд
- Показывает меню по категориям
- Управление корзиной и заказом

---

## 🔄 Флоу создания ресторана

```
1. Админ нажимает "+ Ресторан"
   ↓
2. Открывается CreateRestaurantModal
   ↓
3. Заполняет: название, адрес, телефон, загружает логотип
   ↓
4. Нажимает "Создать"
   ↓
5. Фронт генерирует restaurant_id из названия (slugify)
   ↓
6. POST /api/restaurants/upload-logo
   ← Получает: logo_path
   ↓
7. POST /api/restaurants
   ← Получает: restaurant config
   ↓
8. Создаётся структура:
   - backend/data/ar/restaurants/{restaurant_id}/config.json
   - backend/data/ar/restaurants/{restaurant_id}/menu.json
   - backend/data/ar/restaurant_logos/{restaurant_id}_logo.png
   ↓
9. Обновляется backend/data/ar/restaurants.json
   ↓
10. Модалка закрывается
    ↓
11. Dropdown обновляется (fetchRestaurants)
    ↓
12. Новый ресторан доступен в dropdown
```

---

## 🔄 Флоу добавления блюда

```
1. Админ выбирает ресторан из dropdown
   ↓
2. Нажимает "+ Блюдо"
   ↓
3. Заполняет форму:
   - Название
   - Категория
   - Цена
   - Вес/размер
   - Описание
   - Ингредиенты (опционально)
   ↓
4. Загружает фото
   ↓
5. Нажимает "Сохранить"
   ↓
6. Генерируется menu_id из названия (slugify)
   ↓
7. POST /api/restaurants/{restaurant_id}/menu
   ← Блюдо добавляется в menu.json
   ↓
8. POST /api/restaurants/{restaurant_id}/upload-menu-photos
   ← Фото сохраняются в public/images_web/restaurants/{restaurant_id}/
   ↓
9. Форма закрывается
   ↓
10. Сетка обновляется (fetchMenuItems)
    ↓
11. Блюдо видно в админке
```

---

## 🎯 Флоу отображения на витрине

```
1. Клиент открывает: /home?restaurant=pizza_loft
   ↓
2. Home.tsx загружает:
   - GET /api/restaurants/pizza_loft/config
   - GET /api/restaurants/pizza_loft/menu
   ↓
3. Отображает:
   - Логотип ресторана (из config)
   - Герои блюд (первое блюдо каждой категории)
   - Меню по категориям
   ↓
4. Клиент выбирает блюдо
   ↓
5. Открывается Bottom Sheet с полной информацией
   ↓
6. Выбирает ингредиенты, добавляет в корзину
   ↓
7. Оформляет заказ
   ↓
8. POST /api/orders
   ← Заказ сохраняется в CRM с restaurant_id
```

---

## 📝 Примеры использования

### Создание ресторана через админку

1. Открыть MenuManager
2. Нажать "+ Ресторан"
3. Заполнить:
   - Название: "PIZZA LOFT"
   - Адрес: "Patong, Gay Bay"
   - Телефон: "+6678786969"
   - Логотип: выбрать файл
4. Нажать "Создать"

**Результат:**
- Создана папка `backend/data/ar/restaurants/pizza_loft/`
- Сохранён логотип в `backend/data/ar/restaurant_logos/pizza_loft_logo.png`
- Обновлён `backend/data/ar/restaurants.json`
- Ресторан доступен в dropdown

### Добавление блюда

1. Выбрать ресторан из dropdown
2. Нажать "+ Блюдо"
3. Заполнить:
   - Название: "Маргарита"
   - Категория: "Пицца"
   - Цена: 500
   - Вес: "30cm"
   - Описание: "Помидоры, моцарелла, базилик"
4. Добавить ингредиенты (опционально)
5. Загрузить фото
6. Нажать "Сохранить"

**Результат:**
- Блюдо добавлено в `backend/data/ar/restaurants/pizza_loft/menu.json`
- Фото сохранены в `public/images_web/restaurants/pizza_loft/`
- Блюдо видно в админке и на витрине

---

## 🔐 Безопасность

- Все restaurant_id генерируются автоматом (slugify)
- Логотипы сохраняются в защищённой папке
- Меню загружается только для существующих ресторанов
- Фото валидируются по типу (только image/*)

---

## 📊 Масштабируемость

- Система поддерживает **неограниченное количество ресторанов**
- Каждый ресторан имеет **независимое меню**
- Фото хранятся в **public/images_web** для быстрой доставки
- JSON файлы легко мигрировать на **PostgreSQL** при необходимости

---

## ✅ Чек-лист реализации

- [x] Фронт: CreateRestaurantModal компонент
- [x] Фронт: Кнопка создания ресторана в MenuManager
- [x] Фронт: Dropdown выбора ресторана
- [x] Бекенд: POST /api/restaurants/upload-logo
- [x] Бекенд: POST /api/restaurants
- [x] Бекенд: GET /api/restaurants
- [x] Бекенд: GET /api/restaurants/{id}/menu
- [x] Бекенд: GET /api/restaurants/{id}/config
- [x] Бекенд: POST /api/restaurants/{id}/menu
- [x] Бекенд: POST /api/restaurants/{id}/upload-menu-photos
- [ ] Фронт: Отображение логотипа в админке при выборе ресторана
- [ ] Фронт: Home.tsx интеграция с динамической загрузкой меню
- [ ] Тестирование: Полный флоу создание ресторана → добавление блюд → витрина

---

## 🚀 Следующие шаги

1. **Отображение логотипа в админке**
   - При выборе ресторана показывать его логотип в header

2. **Интеграция Home.tsx**
   - Загружать меню по restaurant_id из URL параметра
   - Отображать логотип ресторана
   - Показывать герои блюд

3. **Тестирование**
   - Создать тестовый ресторан
   - Добавить несколько блюд
   - Проверить витрину

4. **Оптимизация**
   - Кэширование меню
   - Оптимизация загрузки фото
   - Добавить поиск по ресторанам
