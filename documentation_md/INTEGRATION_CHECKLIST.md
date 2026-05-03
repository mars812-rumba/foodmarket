# ✅ Чек-лист интеграции Menu System

## 📋 Что нужно сделать для полной интеграции

### Шаг 1: Подключить menu_api.py к web_integration.py

**Файл:** `backend/web_integration.py`

**Найди строку где создаётся FastAPI приложение:**
```python
app = FastAPI(title="...", version="...")
```

**Добавь в начало файла (после других импортов):**
```python
from menu_api import create_menu_router
```

**Добавь после создания app и CORS middleware:**
```python
# ============ MENU ROUTER ============
menu_router = create_menu_router(data_path="./data/ar")
app.include_router(menu_router)
```

**Полный пример:**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from menu_api import create_menu_router  # ← ДОБАВЬ ЭТО

app = FastAPI(title="Sunny Rentals API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ MENU ROUTER ============
menu_router = create_menu_router(data_path="./data/ar")
app.include_router(menu_router)

# Остальной код...
```

---

### Шаг 2: Проверить структуру папок

**Убедись что существуют:**
```
backend/
├─ menu_api.py ✅
├─ web_integration.py ✅
└─ data/ar/restaurants/
   └─ pizzeria_1/
      ├─ config.json ✅
      ├─ menu.json ✅
      └─ images/ (будет создана автоматически)
```

---

### Шаг 3: Запустить бекенд

```bash
cd backend
python web_integration.py
```

**Проверь вывод:**
```
INFO:     Uvicorn running on http://127.0.0.1:5003
```

**Проверь что endpoints доступны:**
```bash
curl http://localhost:5003/api/restaurants
```

**Должен вернуть:**
```json
{
  "restaurants": [
    {
      "id": "pizzeria_1",
      "name": "PIZZA LOFT",
      "logo": "logo_pizza_loft.png"
    }
  ]
}
```

---

### Шаг 4: Запустить фронтенд

В новом терминале:
```bash
npm run dev
```

**Проверь вывод:**
```
Local: http://localhost:5173
```

---

### Шаг 5: Открыть админку

Перейди на: **http://localhost:5173/admin/menu**

**Должно быть:**
- ✅ Выпадающее меню с ресторанами
- ✅ Сетка блюд (8 блюд из menu.json)
- ✅ Кнопка "+ Блюдо"
- ✅ Поиск и фильтр по категориям

---

### Шаг 6: Тестировать функции

#### Добавить блюдо
1. Нажми "+ Блюдо"
2. Заполни форму:
   - Название: "Четыре сыра"
   - Категория: "Пицца"
   - Цена: 700
   - Вес: 400г
   - Описание: "Четыре вида сыра"
3. Нажми "СОХРАНИТЬ"
4. Проверь что блюдо появилось в сетке

#### Редактировать блюдо
1. Нажми на карточку блюда (иконка редактирования)
2. Измени название на "Четыре сыра Премиум"
3. Измени цену на 800
4. Нажми "СОХРАНИТЬ"
5. Проверь что изменения сохранились

#### Загрузить фото
1. Нажми на блюдо (редактирование)
2. Перейди на вкладку "ФОТО"
3. Нажми "Загрузить фото"
4. Выбери изображение (PNG или JPG)
5. Проверь что фото загрузилось

#### Удалить блюдо
1. Наведи на карточку блюда
2. Нажми иконку удаления (X)
3. Подтверди удаление
4. Проверь что блюдо исчезло

#### Переключить видимость
1. Наведи на карточку блюда
2. Нажми на переключатель (switch)
3. Проверь что статус изменился

---

### Шаг 7: Проверить API endpoints

#### Получить меню
```bash
curl http://localhost:5003/api/restaurants/pizzeria_1/menu
```

#### Получить конфиг
```bash
curl http://localhost:5003/api/restaurants/pizzeria_1/config
```

#### Получить список ресторанов
```bash
curl http://localhost:5003/api/restaurants
```

#### Добавить блюдо
```bash
curl -X POST http://localhost:5003/api/restaurants/pizzeria_1/menu \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test_pizza",
    "name": "Test Pizza",
    "slug": "test_pizza",
    "category": "pizza",
    "price": 500,
    "weight": "350g",
    "image": "images/test.jpg",
    "available": true,
    "notes": "Test",
    "ingredients": [],
    "photos": {"main": "", "gallery": []}
  }'
```

#### Удалить блюдо
```bash
curl -X DELETE http://localhost:5003/api/restaurants/pizzeria_1/menu/test_pizza
```

---

### Шаг 8: Проверить Swagger UI

Открой: **http://localhost:5003/docs**

Там можно тестировать все endpoints прямо в браузере.

---

## ✅ Финальный чек-лист

- [ ] Добавил импорт menu_api в web_integration.py
- [ ] Добавил router в app
- [ ] Проверил что menu_api.py находится в папке backend/
- [ ] Проверил что структура папок существует
- [ ] Запустил бекенд (`python backend/web_integration.py`)
- [ ] Запустил фронтенд (`npm run dev`)
- [ ] Открыл http://localhost:5173/admin/menu
- [ ] Выбрал ресторан "PIZZA LOFT"
- [ ] Увидел 8 блюд в сетке
- [ ] Добавил новое блюдо
- [ ] Отредактировал блюдо
- [ ] Загрузил фото
- [ ] Удалил блюдо
- [ ] Переключил видимость
- [ ] Протестировал API endpoints
- [ ] Открыл Swagger UI (http://localhost:5003/docs)
- [ ] Все работает! 🎉

---

## 🐛 Решение проблем

### Ошибка: "ModuleNotFoundError: No module named 'menu_api'"

**Причина:** menu_api.py не находится в папке backend/

**Решение:**
1. Проверь что menu_api.py находится в `backend/menu_api.py`
2. Убедись что ты в папке backend/ когда запускаешь `python web_integration.py`

### Ошибка: "404 Not Found" при открытии /admin/menu

**Причина:** Маршрут не добавлен в main.tsx

**Решение:**
1. Открой `src/main.tsx`
2. Проверь что есть импорт: `import MenuManager from './pages/admin/MenuManager'`
3. Проверь что есть маршрут: `<Route path="/admin/menu" element={<MenuManager />} />`

### Ошибка: "Cannot GET /api/restaurants"

**Причина:** menu_router не подключен в web_integration.py

**Решение:**
1. Открой `backend/web_integration.py`
2. Добавь импорт: `from menu_api import create_menu_router`
3. Добавь router: `app.include_router(create_menu_router(data_path="./data/ar"))`
4. Перезапусти бекенд

### Ошибка: "Блюдо с таким ID уже существует"

**Причина:** ID генерируется из названия, и блюдо с таким названием уже есть

**Решение:**
1. Измени название блюда
2. Или удали существующее блюдо с таким названием

### Фото не загружается

**Причина:** Название блюда не заполнено или файл слишком большой

**Решение:**
1. Заполни название блюда
2. Проверь что файл не больше 5MB
3. Проверь что формат PNG или JPG

### Меню не загружается на фронте

**Причина:** Бекенд не запущен или CORS не включен

**Решение:**
1. Проверь что бекенд запущен на http://localhost:5003
2. Открой DevTools (F12) → Network tab
3. Проверь что запрос к `/api/restaurants/pizzeria_1/menu` возвращает 200
4. Если 404 — проверь что menu_router подключен

---

## 📞 Контакты

Если есть вопросы — пиши! 🚀

**Создано:** 2026-04-19
**Версия:** 1.0.0
**Статус:** ✅ Готово к использованию
