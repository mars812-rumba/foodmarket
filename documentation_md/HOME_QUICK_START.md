# 🚀 Home.tsx Quick Start Guide

## Что изменилось?

**Home.tsx** теперь загружает меню из API вместо hardcoded данных.

## 🔧 Как это работает?

### 1️⃣ При загрузке страницы

```
┌─────────────────────────────────────┐
│ Home.tsx монтируется                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ fetchRestaurants()                  │
│ GET /api/restaurants                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Выбирается первый ресторан          │
│ setSelectedRestaurant(id)            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ fetchMenuItems()                    │
│ GET /api/restaurants/{id}/menu      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Строятся категории и герои          │
│ Показывается меню                   │
└─────────────────────────────────────┘
```

### 2️⃣ Структура данных

```typescript
// Ресторан
{
  id: "pizzeria_1",
  name: "Pizza Loft",
  logo?: "path/to/logo.png"
}

// Блюдо
{
  id: "margarita",
  name: "Маргарита",
  category: "pizza",
  price: 500,
  weight: "350г",
  image: "restaurants/pizzeria_1/margarita.jpg",
  ingredients: [
    { id: "cheese", name: "Доп. сыр", price: 100 }
  ],
  available: true,
  notes: "Помидоры, моцарелла, базилик"
}

// Категория (строится автоматически)
{
  id: "pizza",
  label: "Пицца",
  icon: "🍕",
  image: hero_pizza
}

// Герой (строится из первого блюда категории)
{
  id: "pizza",
  image: hero_pizza,
  name: "Пицца",
  price: 500
}
```

## 📡 API Endpoints

### Получить ресторан
```bash
GET /api/restaurants

Response:
{
  "restaurants": [
    { "id": "pizzeria_1", "name": "Pizza Loft", "logo": "..." }
  ]
}
```

### Получить меню
```bash
GET /api/restaurants/pizzeria_1/menu?t=1713607200000

Response:
{
  "restaurant_id": "pizzeria_1",
  "categories": ["pizza", "burger", "drinks"],
  "items": [
    {
      "id": "margarita",
      "name": "Маргарита",
      "category": "pizza",
      "price": 500,
      "weight": "350г",
      "image": "restaurants/pizzeria_1/margarita.jpg",
      "ingredients": [...],
      "available": true,
      "notes": "..."
    }
  ]
}
```

## 🎯 Основные функции

### `fetchRestaurants()`
Загружает список ресторанов при монтировании компонента.

```typescript
useEffect(() => {
  fetchRestaurants();
}, []);
```

### `fetchMenuItems()`
Загружает меню выбранного ресторана и строит категории/героев.

```typescript
useEffect(() => {
  if (selectedRestaurant) {
    fetchMenuItems();
  }
}, [selectedRestaurant]);
```

### `getImageUrl(path, timestamp)`
Преобразует путь к фото для правильной загрузки с кэшированием.

```typescript
// Входит: "restaurants/pizzeria_1/margarita.jpg"
// Выходит: "/images_web/restaurants/pizzeria_1/margarita.jpg?t=1713607200000"

<img src={getImageUrl(item.image, photoTimestamp)} />
```

## 🎨 Как выглядит?

```
┌─────────────────────────────────────┐
│ HEADER (Logo + Burger Menu)         │
├─────────────────────────────────────┤
│ VALUE PROPS (⚡ 🚀 ⏱ 📦)            │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │  HERO CAROUSEL              │   │
│  │  (Пицца, Бургеры, Суши...)  │   │
│  │  Свайп → Открыть меню       │   │
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│ BOTTOM NAV (🍕 🍔 🥩 🍝 🍣 🥤 🍗)  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ BOTTOM SHEET (при клике на категорию)
│                                     │
│ Пицца                           ✕   │
│ ┌─────────────────────────────┐    │
│ │ [Фото] Маргарита      500 ฿  │    │
│ │        ☑ Доп. сыр +100 ฿    │    │
│ │        ☐ Томаты +50 ฿       │    │
│ │        [В корзину · 500 ฿]   │    │
│ └─────────────────────────────┘    │
│ ┌─────────────────────────────┐    │
│ │ [Фото] Пепперони     650 ฿  │    │
│ │        ☑ Доп. сыр +100 ฿    │    │
│ │        [В корзину · 650 ฿]   │    │
│ └─────────────────────────────┘    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ SIDE PANEL (Корзина)                │
│                                     │
│ Корзина                         ✕   │
│ ┌─────────────────────────────┐    │
│ │ Маргарита              500 ฿ │    │
│ │ + Доп. сыр                  │    │
│ │                         [✕]  │    │
│ └─────────────────────────────┘    │
│                                     │
│ Итого: 500 ฿                       │
│ [Оформить заказ]                   │
└─────────────────────────────────────┘
```

## 🔄 Жизненный цикл

```
1. Монтирование
   ↓
2. Загрузка ресторанов
   ↓
3. Выбор первого ресторана
   ↓
4. Загрузка меню
   ↓
5. Построение категорий и героев
   ↓
6. Отображение меню
   ↓
7. Пользователь кликает на категорию
   ↓
8. Открывается BottomSheet с блюдами
   ↓
9. Пользователь выбирает ингредиенты
   ↓
10. Добавляет в корзину
    ↓
11. Корзина обновляется
```

## 🎯 State

```typescript
// API State
restaurants        // Список ресторанов
selectedRestaurant // ID выбранного ресторана
items              // Блюда из меню
categories         // Категории (строятся из меню)
heroes             // Герои карусели (строятся из меню)
loading            // Загружается ли меню?
photoTimestamp     // Timestamp для кэширования фото

// UI State
cart               // Товары в корзине
openCategory       // Открытая категория (BottomSheet)
sideOpen           // Открыта ли боковая панель?
showMoreCats       // Показать ещё категории?
```

## 🚨 Обработка ошибок

```typescript
// Если ресторан не загружается
try {
  const res = await fetch(`${API_URL}/api/restaurants`);
  // ...
} catch (e) {
  console.error("Ошибка загрузки ресторанов", e);
  setLoading(false);
}

// Если меню не загружается
try {
  const res = await fetch(`${API_URL}/api/restaurants/${selectedRestaurant}/menu`);
  // ...
} catch (e) {
  console.error("Ошибка загрузки меню", e);
  setItems([]);
  setCategories([]);
  setHeroes([]);
}

// Если фото не загружается
<img 
  src={getImageUrl(item.image, photoTimestamp)}
  onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
/>
```

## 💡 Советы

1. **Timestamp** используется для кэширования фото
   - Каждый раз при загрузке меню обновляется `photoTimestamp`
   - Это заставляет браузер перезагружать фото

2. **Categories** сортируются в фиксированном порядке
   - pizza → burger → steak → pasta → sushi → drinks → potato_chicken

3. **Heroes** генерируются из первого блюда каждой категории
   - Если категория пуста, цена будет 0

4. **Fallback** на placeholder.svg
   - Если фото не загружается, показывается placeholder

5. **API_URL** из переменной окружения
   - `VITE_API_URL` или дефолт `https://weldwood.sunny-rentals.online`

## 🔗 Связанные файлы

- [`src/pages/Home.tsx`](src/pages/Home.tsx) — Главная страница
- [`src/pages/admin/MenuManager.tsx`](src/pages/admin/MenuManager.tsx) — Админка меню
- [`backend/menu_api.py`](backend/menu_api.py) — API endpoints
- [`HOME_MENU_INTEGRATION.md`](HOME_MENU_INTEGRATION.md) — Подробная документация

## ✅ Чек-лист

- [x] Home.tsx загружает ресторан из API
- [x] Home.tsx загружает меню из API
- [x] Категории строятся динамически
- [x] Герои строятся из первого блюда
- [x] BottomSheet работает с API данными
- [x] Фото загружаются с кэшированием
- [x] Корзина работает как раньше
- [x] Loading state при загрузке
- [x] Error handling для всех запросов
- [x] Fallback на placeholder.svg

---

**Версия**: 1.0  
**Дата**: 2026-04-19  
**Статус**: ✅ Готово
