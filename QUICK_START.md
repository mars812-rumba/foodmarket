# ⚡ QUICK START — Быстрый старт за 5 минут

## 🎯 Что нужно сделать?

### Шаг 1: Подключить API (1 минута)

Открой `backend/web_integration.py` и найди где создаётся `app = FastAPI()`.

**Добавь в начало файла:**
```python
from menu_api import create_menu_router
```

**Добавь после создания app:**
```python
# ============ MENU ROUTER ============
menu_router = create_menu_router(data_path="./data/ar")
app.include_router(menu_router)
```

### Шаг 2: Запустить бекенд (1 минута)

```bash
cd backend
python web_integration.py
```

Проверь что вывод содержит:
```
Uvicorn running on http://127.0.0.1:5003
```

### Шаг 3: Запустить фронтенд (1 минута)

В новом терминале:
```bash
npm run dev
```

Проверь что вывод содержит:
```
Local: http://localhost:5173
```

### Шаг 4: Открыть админку (1 минута)

Перейди на: **http://localhost:5173/admin/menu**

### Шаг 5: Тестировать (1 минута)

1. Выбери ресторан "PIZZA LOFT"
2. Нажми "+ Блюдо"
3. Заполни форму
4. Нажми "СОХРАНИТЬ"
5. Готово! 🎉

---

## 📋 Что было создано?

### Фронтенд
- ✅ `src/pages/admin/MenuManager.tsx` — админка
- ✅ Маршрут `/admin/menu` в `src/main.tsx`

### Бекенд
- ✅ `backend/menu_api.py` — API endpoints
- ✅ Тестовые данные в `backend/data/ar/restaurants/pizzeria_1/`

### Документация
- ✅ `MENU_MANAGER_GUIDE.md` — инструкция админки
- ✅ `BACKEND_INTEGRATION.md` — подключение API
- ✅ `RESTAURANT_MENU_SETUP.md` — полная инструкция
- ✅ `MENU_SYSTEM_SUMMARY.md` — резюме
- ✅ `QUICK_START.md` — этот файл

---

## 🔗 API Endpoints

```
GET    /api/restaurants/{restaurant_id}/menu
GET    /api/restaurants/{restaurant_id}/config
POST   /api/restaurants/{restaurant_id}/menu
POST   /api/restaurants/{restaurant_id}/upload-menu-photos
PUT    /api/restaurants/{restaurant_id}/menu/{menu_id}
DELETE /api/restaurants/{restaurant_id}/menu/{menu_id}
```

---

## 🧪 Тестирование

### Swagger UI
```
http://localhost:5003/docs
```

### Curl
```bash
# Получить меню
curl http://localhost:5003/api/restaurants/pizzeria_1/menu

# Удалить блюдо
curl -X DELETE http://localhost:5003/api/restaurants/pizzeria_1/menu/margarita
```

---

## 📁 Структура

```
src/pages/admin/MenuManager.tsx ← НОВАЯ АДМИНКА
backend/menu_api.py ← НОВЫЙ API
backend/data/ar/restaurants/pizzeria_1/ ← ТЕСТОВЫЕ ДАННЫЕ
```

---

## ✅ Чек-лист

- [ ] Добавил импорт menu_api в web_integration.py
- [ ] Добавил router в app
- [ ] Запустил бекенд
- [ ] Запустил фронтенд
- [ ] Открыл http://localhost:5173/admin/menu
- [ ] Выбрал ресторан
- [ ] Добавил блюдо
- [ ] Сохранил
- [ ] Готово! 🎉

---

## 🚀 Готово!

Система управления меню ресторана работает!

**Дальше:**
1. Добавь больше ресторанов
2. Интегрируй с CRM
3. Добавь оплату
4. Добавь уведомления

---

## 📚 Документация

- **MENU_MANAGER_GUIDE.md** — как использовать админку
- **BACKEND_INTEGRATION.md** — как подключить API
- **RESTAURANT_MENU_SETUP.md** — полная инструкция
- **MENU_SYSTEM_SUMMARY.md** — резюме всего
- **QUICK_START.md** — этот файл

---

**Создано:** 2026-04-19 | **Версия:** 1.0.0 | **Статус:** ✅ Готово
