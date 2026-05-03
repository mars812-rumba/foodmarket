# ✅ Home.tsx — Повторная интеграция с MenuManager завершена

## 📋 Что было сделано

Ты пересобрал верстку Home.tsx, но логика осталась старой (hardcoded HEROES, CATEGORIES, ITEMS). Я повторил интеграцию с API на новой верстке.

## 🔄 Изменения

### 1. **Типы данных обновлены** 📝
```typescript
// Добавлены новые поля для совместимости с MenuManager
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

// Добавлены новые типы
type Category = { id: string; label: string; image: string; icon: string };
type Restaurant = { id: string; name: string; logo?: string };
```

### 2. **API интеграция добавлена** 🔌
```typescript
const API_URL = import.meta.env.VITE_API_URL || "https://weldwood.sunny-rentals.online";

// Функция для преобразования путей к фото
const getImageUrl = (path: string | undefined, timestamp?: number): string => {
  if (!path) return "/placeholder.svg";
  if (path.startsWith("http")) return path;
  const ts = timestamp !== undefined ? timestamp : Date.now();
  
  if (path.startsWith("restaurants/")) {
    return `/images_web/${path}?t=${ts}`;
  }
  
  return `/images_web/${path}?t=${ts}`;
};
```

### 3. **State для API добавлен** 🔄
```typescript
// API State
const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
const [items, setItems] = useState<MenuItem[]>([]);
const [categories, setCategories] = useState<Category[]>([]);
const [heroes, setHeroes] = useState<Hero[]>([]);
const [loading, setLoading] = useState(true);
const [photoTimestamp, setPhotoTimestamp] = useState<number>(Date.now());
```

### 4. **Функции загрузки добавлены** 🛠️
```typescript
// Загрузка ресторанов при монтировании
useEffect(() => {
  fetchRestaurants();
}, []);

// Загрузка меню при выборе ресторана
useEffect(() => {
  if (selectedRestaurant) {
    fetchMenuItems();
  }
}, [selectedRestaurant]);

// Функция загрузки ресторанов
const fetchRestaurants = async () => {
  try {
    const res = await fetch(`${API_URL}/api/restaurants`);
    const data = await res.json();
    const rests = data.restaurants || [];
    setRestaurants(rests);
    if (rests.length > 0) {
      setSelectedRestaurant(rests[0].id);
    }
  } catch (e) {
    console.error("Ошибка загрузки ресторанов", e);
    setLoading(false);
  }
};

// Функция загрузки меню
const fetchMenuItems = async () => {
  setLoading(true);
  try {
    const timestamp = Date.now();
    const res = await fetch(
      `${API_URL}/api/restaurants/${selectedRestaurant}/menu?t=${timestamp}`
    );
    const data = await res.json();
    const menuItems = data.items || [];
    
    setItems(menuItems);
    setPhotoTimestamp(timestamp);

    // Строим категории из меню
    const uniqueCategories = Array.from(
      new Set(menuItems.map((item: MenuItem) => item.category))
    );
    const builtCategories: Category[] = uniqueCategories
      .map((catId: string) => ({
        id: catId,
        label: CATEGORY_ICONS[catId]?.label || catId,
        icon: CATEGORY_ICONS[catId]?.icon || "📦",
        image: HERO_IMAGES[catId] || hero_pizza,
      }))
      .sort((a, b) => {
        const order = ["pizza", "burger", "steak", "pasta", "sushi", "drinks", "potato_chicken"];
        return order.indexOf(a.id) - order.indexOf(b.id);
      });

    setCategories(builtCategories);

    // Строим героев из первого блюда каждой категории
    const builtHeroes: Hero[] = builtCategories.map((cat) => {
      const firstItem = menuItems.find((item: MenuItem) => item.category === cat.id);
      return {
        id: cat.id,
        image: HERO_IMAGES[cat.id] || hero_pizza,
        name: cat.label,
        price: firstItem?.price || 0,
      };
    });

    setHeroes(builtHeroes);
  } catch (e) {
    console.error("Ошибка загрузки меню", e);
    setItems([]);
    setCategories([]);
    setHeroes([]);
  } finally {
    setLoading(false);
  }
};
```

### 5. **Loading state добавлен** ⏳
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

### 6. **Динамические данные в JSX** 🎨
```typescript
// Было:
<HeroCarousel heroes={HEROES} onChoose={(id) => setOpenCategory(id)} />
<BottomSheet
  category={CATEGORIES.find((c) => c.id === openCategory) ?? null}
  items={ITEMS.filter((i) => i.category === openCategory)}
  onClose={() => setOpenCategory(null)}
  onAdd={addToCart}
/>

// Стало:
<HeroCarousel heroes={heroes} onChoose={(id) => setOpenCategory(id)} />
<BottomSheet
  category={categories.find((c) => c.id === openCategory) ?? null}
  items={items.filter((i) => i.category === openCategory)}
  onClose={() => setOpenCategory(null)}
  onAdd={addToCart}
  photoTimestamp={photoTimestamp}
/>
```

### 7. **BottomSheet обновлен** 📋
```typescript
function BottomSheet({
  category,
  items,
  onClose,
  onAdd,
  photoTimestamp,  // ← новое
}: {
  category: Category | null;
  items: MenuItem[];
  onClose: () => void;
  onAdd: (item: MenuItem, ings: Ingredient[]) => void;
  photoTimestamp: number;  // ← новое
}) {
  // ...
  <img 
    src={getImageUrl(item.image, photoTimestamp)}  // ← используем getImageUrl
    alt={item.name} 
    style={S.itemImg} 
    className="lfp-item-img"
    onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
  />
}
```

## 📊 Что изменилось

| Аспект | Было | Стало |
|--------|------|-------|
| **Источник данных** | Hardcoded | API |
| **Категории** | Фиксированные | Динамические из меню |
| **Герои** | Фиксированные | Генерируются из меню |
| **Блюда** | 8 hardcoded | Неограниченно из API |
| **Фото** | Статические | Динамические с кэшем |
| **Loading state** | ❌ Нет | ✅ Есть |
| **Error handling** | ❌ Нет | ✅ Есть |

## ✅ Статус

- ✅ Типы обновлены
- ✅ API интеграция добавлена
- ✅ State для API добавлен
- ✅ Функции загрузки реализованы
- ✅ Loading state добавлен
- ✅ BottomSheet обновлен
- ✅ Фото загружаются с кэшем
- ✅ Build успешен (без ошибок)

## 🚀 Как это работает

1. **Mount** → `fetchRestaurants()` загружает список ресторанов
2. **Auto-select** → Первый ресторан выбирается автоматически
3. **Fetch Menu** → `fetchMenuItems()` загружает меню
4. **Build UI** → Категории и герои генерируются из меню
5. **Display** → Меню показывается с динамическими данными
6. **User Interaction** → BottomSheet показывает блюда с правильными фото
7. **Cart** → Товары добавляются в корзину

## 📚 Документация

Вся документация из предыдущей интеграции остаётся актуальной:
- [`HOME_MENU_INTEGRATION.md`](HOME_MENU_INTEGRATION.md)
- [`HOME_QUICK_START.md`](HOME_QUICK_START.md)
- [`HOME_BEFORE_AFTER.md`](HOME_BEFORE_AFTER.md)

## 🎉 Итог

Home.tsx полностью синхронизирована с MenuManager на новой верстке. Все работает как ожидается!

---

**Версия**: 2.0 (повторная интеграция)  
**Дата**: 2026-04-19  
**Статус**: ✅ Готово к использованию
