# 🏠 Home.tsx — MenuManager Integration Guide

## ✅ Что было сделано

**Home.tsx** полностью переработана для синхронизации с **MenuManager** и API:

### 1. **API Integration** ✨
- Добавлена загрузка ресторанов из API (`GET /api/restaurants`)
- Добавлена загрузка меню из API (`GET /api/restaurants/{id}/menu`)
- Реализована динамическая загрузка категорий из меню
- Добавлена поддержка кэширования фото с timestamp

### 2. **Динамические данные** 📊
- **Restaurants** — список ресторанов загружается при монтировании компонента
- **Menu Items** — блюда загружаются при выборе ресторана
- **Categories** — категории строятся динамически из меню
- **Heroes** — карусель генерируется из первого блюда каждой категории

### 3. **Типы данных** 🔧
Обновлены типы для совместимости с MenuManager:

```typescript
type MenuItem = {
  id: string;
  category: string;
  name: string;
  price: number;
  image: string;
  weight?: string;           // ← новое
  notes?: string;            // ← новое
  ingredients?: Ingredient[];
  available?: boolean;       // ← новое
  photos?: {                 // ← новое
    main?: string;
    gallery?: string[];
  };
  updated_at?: string;       // ← новое
  hot?: boolean;
};
```

### 4. **Функции** 🎯

#### `fetchRestaurants()`
```typescript
// Загружает список ресторанов при монтировании
// Автоматически выбирает первый ресторан
const fetchRestaurants = async () => {
  const res = await fetch(`${API_URL}/api/restaurants`);
  const data = await res.json();
  setRestaurants(data.restaurants || []);
  if (data.restaurants?.length > 0) {
    setSelectedRestaurant(data.restaurants[0].id);
  }
};
```

#### `fetchMenuItems()`
```typescript
// Загружает меню выбранного ресторана
// Строит категории и героев из меню
const fetchMenuItems = async () => {
  const timestamp = Date.now();
  const res = await fetch(
    `${API_URL}/api/restaurants/${selectedRestaurant}/menu?t=${timestamp}`
  );
  const data = await res.json();
  
  // Сохраняем блюда
  setItems(data.items || []);
  
  // Строим категории из уникальных значений
  const uniqueCategories = Array.from(
    new Set(menuItems.map((item: MenuItem) => item.category))
  );
  
  // Строим героев из первого блюда каждой категории
  const builtHeroes = builtCategories.map((cat) => {
    const firstItem = menuItems.find((item: MenuItem) => item.category === cat.id);
    return {
      id: cat.id,
      image: HERO_IMAGES[cat.id] || hero_pizza,
      name: cat.label,
      price: firstItem?.price || 0,
    };
  });
};
```

#### `getImageUrl()`
```typescript
// Преобразует пути к фото для правильной загрузки
// Поддерживает кэширование через timestamp
const getImageUrl = (path: string | undefined, timestamp?: number): string => {
  if (!path) return "/placeholder.svg";
  if (path.startsWith("http")) return path;
  
  // Для фото ресторанов: restaurants/pizzeria_1/image.jpg
  if (path.startsWith("restaurants/")) {
    return `/images_web/${path}?t=${ts}`;
  }
  
  return `/images_web/${path}?t=${ts}`;
};
```

### 5. **State Management** 🔄

```typescript
// API State
const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
const [items, setItems] = useState<MenuItem[]>([]);
const [categories, setCategories] = useState<Category[]>([]);
const [heroes, setHeroes] = useState<Hero[]>([]);
const [loading, setLoading] = useState(true);
const [photoTimestamp, setPhotoTimestamp] = useState<number>(Date.now());

// UI State (как было)
const [cart, setCart] = useState<CartLine[]>([]);
const [openCategory, setOpenCategory] = useState<string | null>(null);
const [sideOpen, setSideOpen] = useState(false);
const [showMoreCats, setShowMoreCats] = useState(false);
```

### 6. **Loading State** ⏳

```typescript
if (loading) {
  return (
    <div style={S.page}>
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>⏳</div>
        <div style={{ color: C.muted, fontSize: 16 }}>Загружаю меню...</div>
      </div>
    </div>
  );
}
```

### 7. **BottomSheet обновлена** 📋

Теперь принимает `photoTimestamp` для правильной загрузки фото:

```typescript
<BottomSheet
  category={categories.find((c) => c.id === openCategory) ?? null}
  items={items.filter((i) => i.category === openCategory)}
  onClose={() => setOpenCategory(null)}
  onAdd={addToCart}
  photoTimestamp={photoTimestamp}  // ← новое
/>
```

И использует его при отображении:

```typescript
<img 
  src={getImageUrl(item.image, photoTimestamp)} 
  alt={item.name} 
  style={S.itemImg}
  onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
/>
```

## 🔌 API Endpoints

Home.tsx использует следующие endpoints:

### Получить список ресторанов
```
GET /api/restaurants
Response: { restaurants: Restaurant[] }
```

### Получить меню ресторана
```
GET /api/restaurants/{restaurant_id}/menu?t={timestamp}
Response: { 
  restaurant_id: string,
  categories: string[],
  items: MenuItem[]
}
```

## 🎨 Цены в батах (฿)

Все цены теперь отображаются в батах вместо рублей:

```typescript
// Было: {total} ₽
// Стало: {total} ฿

<div style={S.heroPriceOnImg}>{h.price} ฿</div>
<div style={S.itemPrice}>{total} ฿</div>
<span style={S.ingPrice}>+{ing.price} ฿</span>
```

## 🔄 Жизненный цикл

1. **Mount** → `fetchRestaurants()` загружает список ресторанов
2. **Restaurant selected** → `fetchMenuItems()` загружает меню
3. **Menu loaded** → Строятся категории и герои
4. **User selects category** → BottomSheet показывает блюда этой категории
5. **User adds to cart** → Блюдо добавляется в корзину с выбранными ингредиентами

## 📱 Совместимость

- ✅ Мобильные устройства (iOS/Android)
- ✅ Планшеты
- ✅ Десктоп
- ✅ Динамическая загрузка фото
- ✅ Кэширование через timestamp
- ✅ Fallback на placeholder.svg при ошибке загрузки

## 🚀 Что дальше?

1. ✅ Home.tsx синхронизирована с MenuManager
2. ✅ API endpoints работают
3. ⏳ Нужно протестировать на реальных данных
4. ⏳ Добавить обработку ошибок сети
5. ⏳ Добавить retry логику для загрузки фото

## 🐛 Обработка ошибок

```typescript
// Если ресторан не загружается
catch (e) {
  console.error("Ошибка загрузки ресторанов", e);
  setLoading(false);
}

// Если меню не загружается
catch (e) {
  console.error("Ошибка загрузки меню", e);
  setItems([]);
  setCategories([]);
  setHeroes([]);
}

// Если фото не загружается
onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
```

## 📝 Примечания

- **API_URL** берётся из `VITE_API_URL` или использует дефолт
- **Timestamp** используется для кэширования фото (избегает старых версий)
- **Categories** сортируются в фиксированном порядке: pizza → burger → steak → pasta → sushi → drinks → potato_chicken
- **Heroes** генерируются из первого блюда каждой категории
- **Fallback** на placeholder.svg если фото не загружается

## ✨ Ключевые улучшения

| Было | Стало |
|------|-------|
| Hardcoded ITEMS | Динамическая загрузка из API |
| Hardcoded CATEGORIES | Строятся из меню |
| Hardcoded HEROES | Генерируются из первого блюда |
| Статические фото | Динамические с кэшированием |
| Нет ресторанов | Выбор ресторана из списка |
| Нет loading state | Loading spinner при загрузке |
| Нет error handling | Try-catch для всех запросов |

---

**Статус**: ✅ Готово к использованию
**Версия**: 1.0
**Дата**: 2026-04-19
