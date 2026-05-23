# Руководство по эксплуатации — Интеграция Авито с CRM

## Содержание

1. [Обзор системы](#обзор-системы)
2. [Архитектура](#архитектура)
3. [Установка и настройка](#установка-и-настройка)
4. [Запуск системы](#запуск-системы)
5. [Управление ботом Авито](#управление-ботом-авито)
6. [Работа с CRM](#работа-с-crm)
7. [Мониторинг и логи](#мониторинг-и-логи)
8. [Решение проблем](#решение-проблем)
9. [API Reference](#api-reference)

---

## Обзор системы

Интеграция Авито с CRM позволяет:

- **Получать сообщения** из чатов Авито в реальном времени
- **Автоматически отвечать** через Claude AI (отдельный промпт `avito_prompt` из prompts.yaml)
- **Запускать Claude с приветствием** — при нажатии START в CRM, Claude поздоровается и начнёт диалог
- **Управлять ботом** — включать/выключать/ставить на паузу для каждого клиента отдельно
- **Видеть все диалоги** в единой CRM (Telegram + Авито)
- **Получать уведомления** о новых сообщениях в Telegram группу менеджеров
- **Отвечать вручную** через CRM UI когда бот выключен
- **Отправлять сообщения через Claude** из CRM чата для Авито пользователей

### Поток данных

```
Клиент Авито
    ↓
Авито Messenger API (вебхук → порт 5005)
    ↓
Python Backend /api/avito/webhook
    ↓
AvitoCRMIntegration.handle_webhook()
    ├─→ _find_or_create_avito_user() → лид status=NEW, source=avito
    ├─→ _log_chat_message() → chat_logs.jsonl (формат text + content.text)
    ├─→ _log_crm_event() → crm_history.jsonl (события)
    ├─→ update_dialog_status() → user_data.json (статус диалога)
    ├─→ Claude AI (генерация ответа, если бот ACTIVE)
    ├─→ Avito API (отправка ответа)
    └─→ Telegram группа (уведомление менеджеру)
```

```
Менеджер в CRM UI — отправка сообщения
    ↓
POST /api/crm/send_message {user_id: "avito_123456789", text: "..."}
    ↓
web_integration.send_message_to_user()
    ├─→ is_avito=True → AvitoCRMIntegration.send_manager_message()
    │     ├─→ Avito API (отправка в чат Авито)
    │     ├─→ _log_chat_message(role="manager") → chat_logs.jsonl
    │     ├─→ _log_crm_event() → crm_history.jsonl
    │     └─→ update_dialog_status() → user_data.json
    └─→ is_avito=False → Telegram bot /internal/send_message
```

```
Менеджер в CRM UI — запуск Claude (кнопка START)
    ↓
POST /api/avito/dialog/avito_XXX/bot/start
    ↓
avito_bot_control() → start_with_greeting()
    ├─→ _update_dialog_status_func()(claude_status="active")
    ├─→ _generate_ai_response(greeting_prompt) → Claude генерирует приветствие
    ├─→ avito.send_message(chat_id, greeting) → отправка в Авито
    ├─→ _log_chat_message(role="assistant") → chat_logs.jsonl
    ├─→ _log_crm_event("claude_started") → crm_history.jsonl
    └─→ return {status: "ok", greeting_text: "..."} → CRM показывает в чате
```

```
Менеджер в CRM UI — отправка через Claude (из чата CRM)
    ↓
POST /api/avito/claude/send_message {user_id: "avito_XXX", message: "..."}
    ↓
AvitoCRMIntegration.send_claude_message()
    ├─→ Проверка claude_status == "active"
    ├─→ _generate_ai_response(user_id, message) → Claude генерирует ответ
    ├─→ avito.send_message(chat_id, response) → отправка в Авито
    ├─→ _log_chat_message(role="assistant") → chat_logs.jsonl
    ├─→ _log_crm_event("claude_message_sent") → crm_history.jsonl
    └─→ return {status: "success", response_text: "..."} → CRM показывает в чате
```

> **Примечание:** Вебхуки от Авито приходят **напрямую** на порт 5005 Python backend. Токен Авито обновляется автоматически каждые 23 часа фоновой задачей. n8n **не используется**. При отправке сообщения менеджером через CRM — логирование выполняется только один раз (в `send_manager_message` для Avito или в `web_integration` для Telegram), дублирование исключено.

---

## Архитектура

### Компоненты

| Компонент | Файл | Назначение |
|-----------|------|------------|
| Avito Client | `backend/avito_client.py` | Работа с Avito Messenger API |
| Avito Integration | `backend/avito_integration.py` | Связь Авито ↔ CRM |
| CRM Backend | `backend/web_integration.py` | API endpoints, логирование, статусы, фоновое обновление токена |
| CRM UI | `src/pages/admin/CRMPage.tsx` | Визуальный интерфейс |

### Источники пользователей

| Источник | Префикс user_id | Бейдж в CRM |
|----------|-----------------|-------------|
| Telegram | число (например `6451825371`) | `TG` (синий) |
| Авито | `avito_123456789` | `AV` (зелёный) |
| Web | `web_79001234567` | `WEB` (фиолетовый) |

### Автоматические процессы

| Процесс | Интервал | Описание |
|---------|----------|----------|
| Обновление токена Авито | Каждые 23 часа | Фоновая задача `asyncio` в `web_integration.py` |
| Приём вебхуков | Реальное время | Авито → `POST /api/avito/webhook` (порт 5005) |

---

## Установка и настройка

### 1. Зависимости Python

```bash
cd backend
pip install -r requirements.txt
```

Ключевые пакеты: `anthropic`, `redis`, `fastapi`, `uvicorn`, `pyTelegramBotAPI`, `pyyaml`

### 2. Redis (для хранения токена Авито)

```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Проверка
redis-cli ping
# Должен вернуть: PONG
```

### 3. Переменные окружения

Файл: `backend/.env`

```env
# === Avito Integration ===
AVITO_CLIENT_ID=your_client_id
AVITO_CLIENT_SECRET=your_client_secret
AVITO_ACCOUNT_ID=your_account_id

# === Backend URL (для формирования webhook URL) ===
BACKEND_URL=https://weldwood.sunny-rentals.online

# === Redis ===
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=  # если нужен пароль

# === Claude AI (общий для Telegram и Авито) ===
ANTHROPIC_API_KEY=sk-ant-api03-...
CLAUDE_MODEL=claude-sonnet-4-20250514

# === Telegram (уведомления менеджеру) ===
ACTIVE_DIALOGS_CHAT_ID=-100xxxxx
```

### 4. Получение учётных данных Авито

1. Зайти на https://www.avito.ru/profile/developer
2. Создать приложение
3. Получить `client_id` и `client_secret`
4. `account_id` — это ваш ID пользователя Авито (виден в URL профиля)

---

## Запуск системы

### 1. Запуск Python Backend

```bash
cd backend
python web_integration.py
```

Сервер запустится на `http://localhost:5005`

При старте автоматически:
- Инициализируется `AvitoCRMIntegration`
- Получается первый access_token Авито
- Запускается фоновая задача обновления токена (каждые 23 часа)

### 2. Регистрация вебхука в Авито

После запуска сервера зарегистрируйте вебхук, чтобы Авито начал отправлять уведомления:

```bash
curl -X POST http://localhost:5005/api/avito/register-webhook
```

Или через браузер/Postman: `POST https://weldwood.sunny-rentals.online/api/avito/register-webhook`

Это зарегистрирует URL `{BACKEND_URL}/api/avito/webhook` в Авито через API `https://api.avito.ru/messenger/v3/webhook`.

> ⚠️ **Важно:** Регистрацию вебхука нужно выполнять каждый раз при изменении `BACKEND_URL` или пересоздании приложения Авито.

### 3. Проверка работоспособности

Отправьте тестовое сообщение в чат Авито и проверьте:

1. В логах Python backend: `📩 Avito webhook received`
2. В CRM UI: новый пользователь с бейджем `AV`
3. В Telegram группе: уведомление о новом сообщении

---

## Управление ботом Авито

### Через CRM UI

1. Откройте CRM: `https://weldwood.sunny-rentals.online/admin/crm`
2. Найдите пользователя с бейджем `AV`
3. Кликните на карточку — откроется панель деталей
4. Внизу панели — кнопки управления ботом:

| Кнопка | Действие | Результат |
|--------|----------|-----------|
| **START** | Включить бота с приветствием | Claude AI поздоровается и начнёт автоматически отвечать |
| **PAUSE** | Пауза | Бот не отвечает, менеджер должен ответить вручную |
| **RESUME** | Возобновить | Бот снова начинает отвечать |
| **STOP** | Остановить | Бот полностью отключён, история очищена |

### Статус бота

В панели деталей отображается индикатор:

- 🟢 **ACTIVE** (зелёный, пульсирует) — бот отвечает автоматически
- 🟡 **PAUSED** (жёлтый) — бот на паузе, ждёт ручного ответа
- 🔴 **STOPPED/OFF** (красный) — бот выключен

### Поведение при новых сообщениях

| Статус бота | Новое сообщение от клиента | Действие системы |
|-------------|--------------------------|------------------|
| **ACTIVE** | Приходит | Claude AI генерирует ответ → отправляет в Авито |
| **PAUSED** | Приходит | Уведомление менеджеру: "Бот на паузе — ответьте вручную" |
| **STOPPED** | Приходит | Уведомление менеджеру: "Бот выключен — ответьте вручную или включите бота" |

> 💡 **Совет:** По умолчанию бот для новых пользователей Авито **выключен**. Менеджер должен вручную включить его через START.

---

## Работа с CRM

### Фильтр по источнику

В верхней панели фильтров есть кнопки:

| Кнопка | Фильтр |
|--------|--------|
| **Все** | Показать все диалоги (Telegram + Авито + Web) |
| **TG** | Только Telegram пользователи |
| **AV** | Только Авито пользователи |

### Карточка пользователя

Каждая карточка содержит:

- **Бейдж источника** — `TG`, `AV` или `WEB`
- **Имя/username** — для Авито: `Avito #{user_id}`
- **Статус** — NEW, WORK, PBOOK, BOOK, ARCHIVE
- **Индикатор новых сообщений** — красная точка
- **Статус AI** — активен/пауза/выключен

### Чат с клиентом

В панели деталей на вкладке **Чат**:

- Все сообщения логируются (и от клиента, и от бота, и от менеджера)
- Сообщения от бота (Claude AI) помечены как `assistant`
- Сообщения от клиента помечены как `user`
- Сообщения от менеджера помечены как `manager`
- Менеджер может написать вручную — сообщение отправится через Авито API (для Avito) или Telegram bot (для TG)
- Отправка сообщения менеджером логируется **один раз** — без дублирования в CRM чате

### Создание лида

При первом сообщении от клиента Авито автоматически создаётся лид в CRM:

| Поле | Значение |
|------|----------|
| `user_id` | `avito_{avito_user_id}` |
| `source` | `avito` |
| `status` | `new` |
| `dialog.claude_status` | `stopped` (бот выключен по умолчанию) |

Лид отображается в CRMPage со статусом **NEW** и бейджем **AV** (зелёный).

---

## Мониторинг и логи

### Логи Python Backend

Логи выводятся в консоль при запуске `python web_integration.py`:

```
✅ AvitoCRMIntegration initialized
🔑 [Avito Startup] Requesting initial access token...
✅ [Avito Startup] Initial Avito token obtained
✅ [Avito Startup] Background token refresh task started (every 23h)
📩 Avito webhook received: event=message_received
✅ Created new Avito user in CRM: avito_123456789
🤖 Claude response for Avito user avito_123456789: Здравствуйте! ...
✅ AI response sent to Avito chat abc12345
🔄 [Avito Token Refresh] Refreshing Avito access token...
✅ [Avito Token Refresh] Avito token refreshed successfully
```

### Файлы логов

| Файл | Содержание |
|-----------------|
| `backend/data/chat_logs.jsonl` | Все сообщения (Telegram + Авито) |
| `backend/data/crm_history.jsonl` | События CRM (start/stop/pause бота и т.д.) |
| `backend/data/user_data.json` | Данные пользователей CRM |

### Формат записи в chat_logs.jsonl (совместим с CRMPage)

```json
{
  "timestamp": "2026-05-11T18:00:00.000000",
  "user_id": "avito_123456789",
  "role": "user",
  "text": "Здравствуйте, сколько стоит аренда?",
  "content": {"text": "Здравствуйте, сколько стоит аренда?"},
  "source": "avito"
}
```

> **Важно:** Формат содержит поля `text` (на верхнем уровне) и `content.text` — это обеспечивает совместимость с CRMPage, который проверяет оба варианта при рендеринге сообщений. Роли: `user` (клиент), `assistant` (бот Claude), `manager` (менеджер).

### Формат записи в crm_history.jsonl

```json
{
  "timestamp": "2026-05-11T18:00:00.000000",
  "user_id": "avito_123456789",
  "action": "claude_response",
  "data": {"response_preview": "Здравствуйте! ...", "chat_id": "abc12345"},
  "source": "avito"
}
```

### Проверка Redis

```bash
# Проверить наличие токена
redis-cli GET avito_access_token

# Проверить TTL (оставшееся время)
redis-cli TTL avito_access_token

# Установить токен вручную (для теста)
redis-cli SETEX avito_access_token 86400 "your_token_here"
```

---

## Решение проблем

### Вебхук не приходит от Авито

**Симптомы:** Сообщения в Авито не появляются в CRM

**Решение:**
1. Проверьте, что Python backend запущен на порту 5005
2. Перезапустите регистрацию вебхука:
   ```bash
   curl -X POST http://localhost:5005/api/avito/register-webhook
   ```
3. Проверьте информацию о вебхуке:
   ```bash
   curl http://localhost:5005/api/avito/webhook-info
   ```
4. Убедитесь, что `BACKEND_URL` в `.env` указывает на доступный извне URL
5. Убедитесь, что аккаунт Авито не заблокирован

### Токен Авито истёк

**Симптомы:** Ошибка 401 при отправке сообщений

**Решение:**
1. Проверьте Redis: `redis-cli GET avito_access_token`
2. Если пусто — проверьте логи на наличие ошибок обновления токена
3. Токен обновляется автоматически каждые 23 часа. Если не обновляется — проверьте `AVITO_CLIENT_ID` и `AVITO_CLIENT_SECRET` в `.env`
4. Или установите токен вручную через API:
   ```bash
   curl -X POST http://localhost:5005/api/avito/token \
     -H "Content-Type: application/json" \
     -d '{"access_token": "новый_токен", "ttl": 86400}'
   ```

### Claude AI не отвечает

**Симптомы:** Сообщения логируются, но ответ не генерируется

**Решение:**
1. Проверьте `ANTHROPIC_API_KEY` в `.env`
2. Проверьте статус бота — он должен быть **ACTIVE**
3. Проверьте логи на наличие ошибок Claude API
4. Убедитесь, что баланс Anthropic не исчерпан

### Redis недоступен

**Симптомы:** Ошибки подключения к Redis в логах

**Решение:**
1. `sudo systemctl status redis-server`
2. `sudo systemctl restart redis-server`
3. Если Redis не нужен — система переключится на in-memory кэш (работает, но токен не переживёт перезапуск)

### Пользователь Авито не появляется в CRM

**Симптомы:** Сообщения приходят, но карточки нет

**Решение:**
1. Проверьте `backend/data/user_data.json` — возможно пользователь создан, но не отображается
2. Убедитесь, что фильтр в CRM UI не скрывает Авито пользователей
3. Нажмите кнопку **"Все"** в фильтре источников

---

## API Reference

### Вебхук Авито

```
POST /api/avito/webhook
```

Принимает данные напрямую от Авито (вебхук зарегистрирован на этот URL).

**Response:**
```json
{
  "status": "ok",
  "action": "ai_responded",
  "response_preview": "Здравствуйте! ..."
}
```

### Регистрация вебхука

```
POST /api/avito/register-webhook
```

Регистрирует текущий URL (`{BACKEND_URL}/api/avito/webhook`) в Авито для получения уведомлений о новых сообщениях.

**Response:**
```json
{
  "status": "ok",
  "webhook_url": "https://weldwood.sunny-rentals.online/api/avito/webhook",
  "result": {}
}
```

### Информация о вебхуке

```
GET /api/avito/webhook-info
```

**Response:**
```json
{
  "status": "ok",
  "data": {"url": "https://weldwood.sunny-rentals.online/api/avito/webhook"}
}
```

### Удаление вебхука

```
POST /api/avito/delete-webhook
```

Удаляет зарегистрированный вебхук из Авито.

**Response:**
```json
{
  "status": "ok",
  "result": {}
}
```

### Отправка сообщения менеджером (унифицированный эндпоинт)

```
POST /api/crm/send_message
Body: {"user_id": "avito_123456789", "text": "Здравствуйте! ...", "role": "manager", "timestamp": "..."}
```

Маршрутизация:
- Если `user_id` начинается с `avito_` → отправка через **Avito API** (`send_manager_message`)
- Иначе → отправка через **Telegram bot** (`/internal/send_message`)

> **Важно:** Логирование выполняется **один раз** — для Avito внутри `send_manager_message()`, для TG в `web_integration.py`. Дублирование в CRM чате исключено.

**Response (Avito):**
```json
{"status": "ok", "message": "Message sent successfully via Avito", "logged_to_history": true, "sent_via_avito": true}
```

**Response (Telegram):**
```json
{"status": "ok", "message": "Message sent successfully", "logged_to_history": true, "sent_via_bot": true}
```

### Отправка сообщения менеджером (прямой Avito эндпоинт)

```
POST /api/avito/send_message
Body: {"user_id": "avito_123456789", "text": "Здравствуйте! ..."}
```

> Используется редко. Предпочтительный способ — через унифицированный `/api/crm/send_message`.

**Response:**
```json
{"status": "ok", "action": "message_sent"}
```

### Статус диалога

```
GET /api/avito/dialog/avito_123456789/status
```

**Response:**
```json
{
  "status": "ok",
  "data": {
    "user_id": "avito_123456789",
    "source": "avito",
    "avito_chat_id": "uuid-chat-id",
    "dialog": {
      "active": true,
      "has_new_messages": true,
      "claude_status": "active",
      "message_count": 5
    }
  }
}
```

### Управление ботом

```
POST /api/avito/dialog/avito_123456789/bot/start
POST /api/avito/dialog/avito_123456789/bot/stop
POST /api/avito/dialog/avito_123456789/bot/pause
POST /api/avito/dialog/avito_123456789/bot/resume
```

> **Важно:** При `action=start` вызывается `start_with_greeting()` — Claude генерирует приветственное сообщение и отправляет его в чат Авито. Приветствие также возвращается в ответе (`greeting_text`) для отображения в CRM чате.

**Response (start):**
```json
{
  "status": "ok",
  "claude_status": "active",
  "greeting_sent": true,
  "greeting_text": "Здравствуйте! Вижу, вы заинтересовались нашим объявлением...",
  "greeting_preview": "Здравствуйте! Вижу, вы заинтересовались..."
}
```

**Response (stop/pause/resume):**
```json
{"status": "ok", "claude_status": "stopped", "action": "stop"}
```

### Отправка сообщения через Claude (Авито)

```
POST /api/avito/claude/send_message
Body: {"user_id": "avito_123456789", "message": "Подскажи по мангалам"}
```

Отправляет сообщение через Claude AI для пользователя Авито. Ответ Claude отправляется в чат Авито и возвращается в CRM.

> **Требование:** Бот должен быть в статусе `active` (после нажатия START).

**Response:**
```json
{
  "status": "success",
  "response_text": "Конечно! У нас есть мангалы от 3мм до 6мм толщины стали...",
  "delivered": true
}
```

### Список диалогов Авито

```
GET /api/avito/dialogs
```

**Response:**
```json
{
  "status": "ok",
  "dialogs": [
    {
      "user_id": "avito_123456789",
      "username": "Avito #123456789",
      "avito_chat_id": "uuid-chat-id",
      "has_new_messages": true,
      "claude_status": "active"
    }
  ],
  "total": 1
}
```

### Установка токена (вручную)

```
POST /api/avito/token
Body: {"access_token": "xxx", "ttl": 86400}
```

**Response:**
```json
{"status": "ok", "message": "Token updated"}
```

---

## Структура файлов

```
backend/
├── avito_client.py          # Клиент Avito Messenger API
├── avito_integration.py     # Интеграция Авито ↔ CRM + Claude AI (start_with_greeting, send_claude_message)
├── web_integration.py       # Основной backend (FastAPI) + фоновое обновление токена
├── ar_telegram_bot.py       # Telegram бот
├── crm_adapter.py           # Адаптер заказов → CRM
├── prompts.yaml             # Промпты: avito_prompt (Авито) + main_prompt (Telegram)
├── requirements.txt         # Python зависимости
├── .env                     # Переменные окружения
└── data/
    ├── user_data.json       # Данные пользователей CRM
    ├── chat_logs.jsonl       # Логи всех сообщений
    ├── crm_history.jsonl    # История событий CRM
    ├── inventory.json       # Каталог товаров (для контекста Claude)
    └── ar/                  # Данные ресторанов
```

### Промпты Claude AI

Система использует **раздельные промпты** для Авито и Telegram:

| Ключ в `prompts.yaml` | Источник | Описание |
|----------------------|----------|----------|
| `avito_prompt` | Авито | Промпт для магазина металлической мебели «Avarage Roaster» |
| `main_prompt` | Telegram | Промпт для аренды авто на Пхукете |

Приоритет загрузки в `avito_integration.py`:
1. `avito_prompt` (если есть в prompts.yaml)
2. `main_prompt` (fallback)
3. `_default_prompt()` (hardcoded fallback)

Контекст товаров (`inventory.json`) автоматически добавляется к системному промпту через `_get_inventory_context()`.

---

## Часто задаваемые вопросы

**Q: Можно ли использовать разный промпт для Авито и Telegram?**
A: Да! Теперь используется `avito_prompt` из `prompts.yaml` для Авито и `main_prompt` для Telegram. Они полностью независимы.

**Q: Что происходит при нажатии START в CRM для Авито?**
A: Вызывается `start_with_greeting()` — Claude генерирует приветственное сообщение, отправляет его в чат Авито, и приветствие также отображается в CRM чате. Это аналогично запуску Claude в Telegram.

**Q: Как отправить сообщение через Claude из CRM чата для Авито?**
A: Используйте эндпоинт `POST /api/avito/claude/send_message` с `user_id` и `message`. Бот должен быть в статусе `active`. Ответ Claude отправится в Авито и вернётся в CRM.

**Q: Что происходит при блокировке аккаунта Авито?**
A: API вернёт ошибку 403. Система запишет ошибку в логи. Нужно разблокировать аккаунт через поддержку Авито.

**Q: Можно ли добавить WhatsApp или VK?**
A: Да, архитектура поддерживает расширение. Нужно создать `whatsapp_client.py` и `whatsapp_integration.py` по аналогии с Авито.

**Q: Сколько сообщений хранится в истории диалога?**
A: Claude AI получает последние 20 сообщений для контекста. Все сообщения логируются в `chat_logs.jsonl` без ограничений.

**Q: Как очистить историю диалога?**
A: Нажмите **STOP** в CRM UI — это очистит контекст диалога. Полная история в `chat_logs.jsonl` сохраняется.

**Q: Что если сервер перезапустится?**
A: При старте сервера автоматически получается новый токен Авито и запускается фоновое обновление. Если Redis доступен — токен сохраняется и переживает перезапуск. Если Redis недоступен — используется in-memory кэш.

**Q: Как часто обновляется токен?**
A: Каждые 23 часа фоновой задачей `asyncio` в `web_integration.py`. Первый токен получается при старте сервера.

**Q: Какой статус у нового лида из Авито?**
A: При первом сообщении от клиента Авито автоматически создаётся лид со статусом **NEW** и `source=avito`. Бот по умолчанию выключен (`claude_status=stopped`).

**Q: Почему сообщения не дублируются в CRM чате?**
A: При отправке сообщения менеджером через CRM UI (`/api/crm/send_message`), логирование выполняется ровно один раз: для Avito — внутри `send_manager_message()`, для Telegram — в `web_integration.py`. Входящие сообщения от клиента логируются в `handle_webhook()`, а подтверждения наших исходящих — пропускаются (они уже залогированы при отправке).
