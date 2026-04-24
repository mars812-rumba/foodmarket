# CRUD для управления товарами

## Что было сделано

1. **Модели данных** в `backend/web_integration.py`:
   - `ProductBase` - базовая модель товара
   - `ProductCreate` - модель для создания товара
   - `ProductUpdate` - модель для обновления товара
   - `Product` - полная модель товара с ID и датами

2. **API endpoints** в `backend/web_integration.py`:
   - `GET /api/admin/products` - получить список товаров (с фильтрацией)
   - `GET /api/admin/products/{product_id}` - получить один товар
   - `POST /api/admin/products` - создать новый товар
   - `PUT /api/admin/products/{product_id}` - обновить товар
   - `DELETE /api/admin/products/{product_id}` - удалить товар
   - `POST /api/admin/products/{product_id}/upload-photo` - загрузить фото
   - `DELETE /api/admin/products/{product_id}/photo` - удалить фото

3. **Frontend компоненты**:
   - `src/pages/admin/ProductsPage.tsx` - страница управления товарами
   - `src/pages/admin/LoginPage.tsx` - страница входа в админку

4. **Маршруты**:
   - `/admin/login` - страница входа
   - `/admin/products` - страница управления товарами

## Как протестировать

### 1. Backend уже запущен на порту 5006:
```bash
cd backend && PORT=5006 python3 web_integration.py
```

### 2. Frontend уже запущен:
```bash
npm run dev
```

### 3. Откройте страницу управления товарами:
- Перейдите на http://localhost:5173/admin/products
- Авторизация временно отключена для тестирования
- Backend API работает на http://localhost:5006

### Примечание:
- Backend запущен на порту 5006 (не 5000!)
- Если нужно перезапустить backend, используйте команду выше с PORT=5006

### Функционал для тестирования:

1. **Создание товара**:
   - Нажмите кнопку "Добавить товар"
   - Заполните форму (название, категория, цена, количество)
   - Нажмите "Создать"

2. **Редактирование товара**:
   - Нажмите кнопку "Изменить" на карточке товара
   - Измените нужные поля
   - Нажмите "Сохранить"

3. **Удаление товара**:
   - Нажмите кнопку с иконкой корзины на карточке товара
   - Подтвердите удаление

4. **Фильтрация**:
   - Используйте поиск по названию
   - Фильтруйте по категориям

5. **Загрузка фото** (доступна только при редактировании):
   - Откройте товар для редактирования
   - Загрузите главное фото или фото для галереи

## Структура данных товара

```json
{
  "id": "prod_1234567890",
  "name": "Мангал Classic 800",
  "slug": "mangal-classic-800",
  "category": "grill",
  "description": "Описание товара",
  "price": 15000,
  "stock": 5,
  "available": true,
  "photos": {
    "main": "products/prod_1234567890/main.jpg",
    "gallery": ["products/prod_1234567890/1.jpg", "products/prod_1234567890/2.jpg"]
  },
  "attributes": {
    "thickness_steel": "3мм",
    "chimney_height": "50см"
  },
  "created_at": "2024-01-01T00:00:00",
  "updated_at": "2024-01-01T00:00:00"
}
```

## Категории товаров

- `grill` - Мангалы
- `dog_cage` - Вольеры
- `garden_furniture` - Садовая мебель
- `table_base` - Подстолья
- `shelf` - Стеллажи
- `stove` - Печи под казан
- `computer_table` - Компьютерные столы

## Примечания

- Все API endpoints требуют авторизацию (Bearer token)
- Фотографии сохраняются в `public/images_web/products/{product_id}/`
- Данные товаров хранятся в `backend/data/inventory.json`
- При создании товара автоматически генерируется slug из названия