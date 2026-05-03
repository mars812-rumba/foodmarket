# 📸 Исправление загрузки фотографий

## ✅ Что было сделано

### 1. Изменён endpoint загрузки фото

**Файл:** `backend/menu_api.py`

**Было:** Фото сохранялись в `backend/data/ar/restaurants/pizzeria_1/images/`
**Стало:** Фото сохраняются в `public/images_web/restaurants/pizzeria_1/`

```python
# Теперь используем правильный путь
images_path = root_path / "public" / "images_web" / "restaurants" / restaurant_id
```

### 2. Обновлена функция getImageUrl

**Файл:** `src/pages/admin/MenuManager.tsx`

Добавлена поддержка путей `restaurants/...`:
```typescript
if (path.startsWith("restaurants/")) {
  return `/images_web/${path}?t=${ts}`;
}
```

### 3. Создана папка для изображений

```bash
public/images_web/restaurants/pizzeria_1/
```

---

## 🚀 Что нужно сделать

### 1. Перезапустить бекенд

```bash
cd backend
# Остановить текущий процесс (Ctrl+C)
# Запустить заново
python web_integration.py
```

### 2. Перезапустить фронтенд (если запущен)

```bash
# Остановить текущий процесс (Ctrl+C)
# Запустить заново
npm run dev
```

### 3. Проверить загрузку фото

1. Открой http://localhost:5173/admin/menu
2. Выбери ресторан "PIZZA LOFT"
3. Нажми "+ Блюдо"
4. Заполни название
5. Перейди на вкладку "ФОТО"
6. Загрузи фото
7. Проверь что фото появилось

---

## 📁 Структура после загрузки

```
public/images_web/
├─ restaurants/
│  └─ pizzeria_1/
│     ├─ margarita_0.jpg  ← Загруженное фото
│     ├─ margarita_1.jpg
│     └─ ...
│
└─ ... (другие изображения)
```

---

## 🔗 Как работает

### Загрузка фото
```
Клиент выбирает файл
    ↓
MenuManager.tsx отправляет POST запрос
    ↓
menu_api.py получает файл
    ↓
Сохраняет в public/images_web/restaurants/pizzeria_1/
    ↓
Возвращает путь "restaurants/pizzeria_1/margarita_0.jpg"
    ↓
MenuManager обновляет menu.json с этим путём
```

### Отображение фото
```
MenuManager запрашивает menu.json
    ↓
Получает путь "restaurants/pizzeria_1/margarita_0.jpg"
    ↓
getImageUrl() преобразует в "/images_web/restaurants/pizzeria_1/margarita_0.jpg"
    ↓
Веб-сервер отдаёт файл из public/images_web/
    ↓
Браузер показывает фото
```

---

## 🧪 Тестирование

### 1. Проверить что папка существует
```bash
ls -la public/images_web/restaurants/pizzeria_1/
```

### 2. Проверить что endpoint работает
```bash
curl -X POST http://localhost:5003/api/restaurants/pizzeria_1/upload-menu-photos \
  -F "menu_id=test" \
  -F "photos=@/path/to/image.jpg"
```

### 3. Проверить что файл доступен
```bash
curl http://localhost:5003/images_web/restaurants/pizzeria_1/test_0.jpg
```

---

## 🐛 Если фото не загружается

### Проверь права на папку
```bash
chmod 755 public/images_web/restaurants/pizzeria_1/
```

### Проверь что папка существует
```bash
mkdir -p public/images_web/restaurants/pizzeria_1/
```

### Проверь логи бекенда
```bash
python backend/web_integration.py
# Смотри вывод в терминале
```

---

## ✅ Чек-лист

- [ ] Перезапустил бекенд
- [ ] Перезапустил фронтенд
- [ ] Открыл http://localhost:5173/admin/menu
- [ ] Выбрал ресторан
- [ ] Создал новое блюдо
- [ ] Загрузил фото
- [ ] Фото сохранилось в public/images_web/restaurants/
- [ ] Фото отображается в карточке блюда
- [ ] Все работает! 🎉

---

**Создано:** 2026-04-19 | **Версия:** 1.0.1 | **Статус:** ✅ Исправлено
