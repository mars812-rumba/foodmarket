# Роадмап: Подключение второго аккаунта Авито к CRM

## Контекст проекта

Проект — CRM система для аренды авто на Пхукете с интеграцией Авито и Telegram.
Бэкенд: Python (FastAPI) на порту 5005. Фронтенд: React (CRMPage.tsx).
Авито интеграция работает **напрямую** (без n8n) — вебхуки приходят на `/api/avito/webhook`.

### Текущая архитектура (один аккаунт Авито)

```
Авито API ──вебхук──→ POST /api/avito/webhook (порт 5005)
                          │
                          ▼
                   AvitoCRMIntegration (один экземпляр)
                          │
                     AvitoClient (один экземпляр)
                     ├── client_id = AVITO_CLIENT_ID
                     ├── client_secret = AVITO_CLIENT_SECRET
                     └── account_id = AVITO_ACCOUNT_ID (135590675)
                          │
                   ┌──────┴──────┐
                   │  CRM логика │
                   │  user_data  │
                   │  chat_logs  │
                   │  crm_history│
                   └─────────────┘
```

### Ключевые файлы

| Файл | Назначение | Строк |
|------|-----------|-------|
| `backend/avito_client.py` | Клиент Avito Messenger API | ~497 |
| `backend/avito_integration.py` | Связь Авито ↔ CRM | ~1312 |
| `backend/web_integration.py` | API endpoints, инициализация | ~6870 |
| `backend/.env` | Переменные окружения | ~28 |
| `backend/data/.env` | Дополнительные переменные | ~27 |
| `backend/prompts.yaml` | Промпты для AI (main_prompt, avito_prompt) | ~437 |
| `src/pages/admin/CRMPage.tsx` | CRM UI | большой |

### Проблема

Сейчас система жёстко привязана к **одному** аккаунту Авито:
- Один набор `AVITO_CLIENT_ID` / `AVITO_CLIENT_SECRET` / `AVITO_ACCOUNT_ID` в `.env`
- Один экземпляр `AvitoClient` в `AvitoCRMIntegration.__init__`
- Один Redis-ключ `avito_access_token` для токена
- Один экземпляр `AvitoCRMIntegration` в `web_integration.py`
- Одна фоновая задача обновления токена
- Нет различия аккаунтов в CRM UI

---

## Целевая архитектура (мульти-аккаунт)

```
Авито API (аккаунт 1) ──вебхук──→ POST /api/avito/webhook
Авито API (аккаунт 2) ──вебхук──→ POST /api/avito/webhook
                                          │
                                    Маршрутизатор по account_id
                                          │
                              ┌───────────┴───────────┐
                              ▼                       ▼
                   AvitoCRMIntegration[1]   AvitoCRMIntegration[2]
                              │                       │
                        AvitoClient[1]          AvitoClient[2]
                        Redis: avito_token_1     Redis: avito_token_2
                              │                       │
                              └───────┬───────────────┘
                                      ▼
                              Единая CRM (user_data.json)
                              + поле avito_account_id
```

---

## Подзадачи (пошаговый план внедрения)

### Подзадача 1: Конфигурация мульти-аккаунта в `.env`

**Файлы:** `backend/.env`, `backend/data/.env`

**Что делаем:**
Переходим от трёх одиночных переменных к JSON-массиву аккаунтов.

**Текущий формат (.env):**
```env
AVITO_CLIENT_ID=J_bMkFyy4soZi-4-Wxn5
AVITO_CLIENT_SECRET=BUoolpaP5S0t8TOjhkJggSmAJeIHVk04Uzvs-TJM
AVITO_ACCOUNT_ID=135590675
```

**Новый формат (.env):**
```env
# Аккаунт 1 (существующий)
AVITO_CLIENT_ID=J_bMkFyy4soZi-4-Wxn5
AVITO_CLIENT_SECRET=BUoolpaP5S0t8TOjhkJggSmAJeIHVk04Uzvs-TJM
AVITO_ACCOUNT_ID=135590675

# Аккаунт 2 (новый)
AVITO_CLIENT_ID_2=<client_id_второго_аккаунта>
AVITO_CLIENT_SECRET_2=<client_secret_второго_аккаунта>
AVITO_ACCOUNT_ID_2=<account_id_второго_аккаунта>

# Опционально: метки аккаунтов для отображения в CRM
AVITO_ACCOUNT_LABEL_1=Мебель
AVITO_ACCOUNT_LABEL_2=Авто
```

**Альтернатива (JSON-формат):**
```env
AVITO_ACCOUNTS=[{"client_id":"...","client_secret":"...","account_id":"135590675","label":"Мебель"},{"client_id":"...","client_secret":"...","account_id":"999999","label":"Авто"}]
```

**Рекомендация:** Использовать нумерованный формат (`_1`, `_2`) — проще парсить, проще добавлять аккаунты, не ломает обратную совместимость. Старые переменные без суффикса работают как аккаунт по умолчанию.

**Критерии готовности:**
- [ ] В `.env` добавлены переменные для второго аккаунта
- [ ] Обратная совместимость: если `_2` переменных нет, система работает как раньше с одним аккаунтом

---

### Подзадача 2: Рефакторинг `AvitoClient` — параметризация `account_id`

**Файл:** `backend/avito_client.py` (497 строк)

**Что делаем:**
Делаем `account_id` явным параметром конструктора вместо чтения из `os.getenv`. Добавляем префикс аккаунта к Redis-ключам.

**Текущий код (строка 73-84):**
```python
def __init__(self, client_id=None, client_secret=None, redis_host=None, ...):
    self.client_id = client_id or os.getenv("AVITO_CLIENT_ID", "")
    self.client_secret = client_secret or os.getenv("AVITO_CLIENT_SECRET", "")
    self.account_id = os.getenv("AVITO_ACCOUNT_ID", "")  # ← ЖЁСТКО из env
```

**Новый код:**
```python
def __init__(self, client_id=None, client_secret=None, account_id=None, redis_host=None, ...):
    self.client_id = client_id or os.getenv("AVITO_CLIENT_ID", "")
    self.client_secret = client_secret or os.getenv("AVITO_CLIENT_SECRET", "")
    self.account_id = account_id or os.getenv("AVITO_ACCOUNT_ID", "")  # ← Явный параметр
```

**Изменения в Redis-ключах (строка 70-71):**
```python
# Было:
REDIS_TOKEN_KEY = "avito_access_token"

# Стало (динамический ключ с account_id):
def _get_redis_token_key(self):
    return f"avito_access_token_{self.account_id}"
```

**Изменения в `parse_webhook_payload` (строка 422-469):**
Статический метод `parse_webhook_payload` использует `os.getenv("AVITO_ACCOUNT_ID")` для определения `is_our_message`. Нужно передавать `account_id` как параметр:

```python
# Было (строка 456):
is_our_message = str(author_id) == str(os.getenv("AVITO_ACCOUNT_ID", ""))

# Стало:
@staticmethod
def parse_webhook_payload(data: dict, account_id: str = "") -> Dict[str, Any]:
    ...
    # Если account_id не передан — fallback на env
    effective_account_id = account_id or os.getenv("AVITO_ACCOUNT_ID", "")
    is_our_message = str(author_id) == str(effective_account_id)
```

**Изменения в `make_avito_chat_crm_id` (строка 477-485):**
Добавить опциональный префикс аккаунта для уникальности CRM ID:

```python
# Было:
@staticmethod
def make_avito_chat_crm_id(chat_id: str) -> str:
    safe_chat_id = chat_id.replace(" ", "_").replace("/", "_")
    return f"avito_chat_{safe_chat_id}"

# Стало:
@staticmethod
def make_avito_chat_crm_id(chat_id: str, account_id: str = "") -> str:
    safe_chat_id = chat_id.replace(" ", "_").replace("/", "_")
    if account_id:
        return f"avito_{account_id}_chat_{safe_chat_id}"
    return f"avito_chat_{safe_chat_id}"
```

> **Важно:** Формат CRM ID меняется. Нужно обеспечить обратную совместимость — старые лиды с `avito_chat_xxx` должны находиться. Для этого `is_avito_user_id` и `is_avito_chat_crm_id` остаются без изменений, а поиск лида должен проверять оба формата.

**Критерии готовности:**
- [ ] `AvitoClient.__init__` принимает `account_id` как явный параметр
- [ ] Redis-ключи уникальны per account_id
- [ ] `parse_webhook_payload` принимает `account_id` параметр
- [ ] `make_avito_chat_crm_id` поддерживает префикс аккаунта
- [ ] Обратная совместимость: старый код без `account_id` работает как раньше

---

### Подзадача 3: Рефакторинг `AvitoCRMIntegration` — поддержка нескольких `AvitoClient`

**Файл:** `backend/avito_integration.py` (1312 строк)

**Что делаем:**
Заменяем один `self.avito` на словарь `self.avito_clients: Dict[str, AvitoClient]` с ключом `account_id`. Добавляем маршрутизацию по аккаунту.

**Текущий код (строка 90-104):**
```python
class AvitoCRMIntegration:
    def __init__(self, data_path="./data"):
        ...
        # Один клиент
        self.avito = AvitoClient(
            redis_host=os.getenv("REDIS_HOST"),
            redis_port=int(os.getenv("REDIS_PORT", "6379")),
            redis_password=os.getenv("REDIS_PASSWORD"),
        )
```

**Новый код:**
```python
class AvitoCRMIntegration:
    def __init__(self, data_path="./data", accounts_config: list = None):
        ...
        # Словарь клиентов по account_id
        self.avito_clients: Dict[str, AvitoClient] = {}
        self._init_avito_clients(accounts_config)

    def _init_avito_clients(self, accounts_config: list = None):
        """Инициализировать AvitoClient для каждого аккаунта"""
        if accounts_config is None:
            accounts_config = self._load_accounts_from_env()

        for acc in accounts_config:
            client = AvitoClient(
                client_id=acc["client_id"],
                client_secret=acc["client_secret"],
                account_id=acc["account_id"],
                redis_host=os.getenv("REDIS_HOST"),
                redis_port=int(os.getenv("REDIS_PORT", "6379")),
                redis_password=os.getenv("REDIS_PASSWORD"),
            )
            self.avito_clients[acc["account_id"]] = client
            logger.info(f"✅ AvitoClient initialized for account {acc['account_id']} (label={acc.get('label', '')})")

    @staticmethod
    def _load_accounts_from_env() -> list:
        """Загрузить конфигурацию аккаунтов из .env"""
        accounts = []
        # Аккаунт 1 (по умолчанию)
        client_id_1 = os.getenv("AVITO_CLIENT_ID", "")
        client_secret_1 = os.getenv("AVITO_CLIENT_SECRET", "")
        account_id_1 = os.getenv("AVITO_ACCOUNT_ID", "")
        if client_id_1 and client_secret_1 and account_id_1:
            accounts.append({
                "client_id": client_id_1,
                "client_secret": client_secret_1,
                "account_id": account_id_1,
                "label": os.getenv("AVITO_ACCOUNT_LABEL_1", f"Avito {account_id_1}"),
            })

        # Аккаунт 2
        client_id_2 = os.getenv("AVITO_CLIENT_ID_2", "")
        client_secret_2 = os.getenv("AVITO_CLIENT_SECRET_2", "")
        account_id_2 = os.getenv("AVITO_ACCOUNT_ID_2", "")
        if client_id_2 and client_secret_2 and account_id_2:
            accounts.append({
                "client_id": client_id_2,
                "client_secret": client_secret_2,
                "account_id": account_id_2,
                "label": os.getenv("AVITO_ACCOUNT_LABEL_2", f"Avito {account_id_2}"),
            })

        # Аккаунт 3, 4... (если понадобятся)
        for i in range(3, 11):
            cid = os.getenv(f"AVITO_CLIENT_ID_{i}", "")
            cs = os.getenv(f"AVITO_CLIENT_SECRET_{i}", "")
            aid = os.getenv(f"AVITO_ACCOUNT_ID_{i}", "")
            if cid and cs and aid:
                accounts.append({
                    "client_id": cid,
                    "client_secret": cs,
                    "account_id": aid,
                    "label": os.getenv(f"AVITO_ACCOUNT_LABEL_{i}", f"Avito {aid}"),
                })

        if not accounts:
            logger.warning("⚠️ No Avito accounts configured")
        return accounts

    def get_avito_client(self, account_id: str) -> AvitoClient:
        """Получить AvitoClient по account_id"""
        client = self.avito_clients.get(str(account_id))
        if not client:
            raise AvitoClientError(f"No AvitoClient for account_id={account_id}")
        return client

    @property
    def avito(self):
        """Обратная совместимость — возвращает первый клиент"""
        if self.avito_clients:
            return next(iter(self.avito_clients.values()))
        return None
```

**Изменения в `handle_webhook` (строка 322-477):**

Нужно определить, какому аккаунту принадлежит вебхук. В payload Авито есть поле `value.user_id` — это ID владельца аккаунта (наш account_id).

```python
async def handle_webhook(self, webhook_data: dict, account_id: str = None) -> dict:
    # Парсим payload, передавая account_id для определения is_our_message
    parsed = AvitoClient.parse_webhook_payload(webhook_data, account_id=account_id or "")

    # Определяем аккаунт из payload если не передан
    if not account_id:
        account_id = str(parsed.get("user_id", ""))

    # Получаем клиент для этого аккаунта
    avito_client = self.get_avito_client(account_id)

    # Дальше — вся логика использует avito_client вместо self.avito
    ...
```

**Изменения в `_find_or_create_avito_lead` (строка 242-301):**

Добавить `account_id` в данные лида:

```python
new_user = {
    "user_id": crm_user_id,
    "username": username or f"Avito chat {chat_id[:12]}",
    "source": "avito",
    "avito_account_id": account_id,  # ← НОВОЕ ПОЛЕ
    "avito_chat_id": chat_id,
    "avito_author_id": author_id,
    "avito_item_id": item_id,
    ...
}
```

**Изменения в `send_manager_message` (строка 827-878):**

Определять нужный AvitoClient по `avito_account_id` из данных пользователя:

```python
async def send_manager_message(self, avito_user_id: str, text: str) -> dict:
    users = self._load_users()
    user = ...
    chat_id = user.get("avito_chat_id", "")
    account_id = user.get("avito_account_id", "")  # ← НОВОЕ

    # Выбираем клиент по аккаунту
    avito_client = self.get_avito_client(account_id) if account_id else self.avito
    await avito_client.send_message(chat_id, text)
```

**Аналогичные изменения в методах:**
- `start_with_greeting` (строка 593-688) — выбор клиента по `avito_account_id`
- `send_claude_message` (строка 692-767) — выбор клиента по `avito_account_id`
- `sync_chats` (строка 997-1244) — синхронизация для каждого аккаунта отдельно
- `get_all_avito_dialogs` (строка 1288-1311) — добавить `avito_account_id` в ответ

**Критерии готовности:**
- [ ] `AvitoCRMIntegration` хранит словарь `avito_clients` по `account_id`
- [ ] `handle_webhook` маршрутизирует запрос к нужному клиенту
- [ ] Все методы, отправляющие сообщения, выбирают клиент по `avito_account_id`
- [ ] В данных лида (`user_data.json`) сохраняется `avito_account_id`
- [ ] Свойство `avito` (без аргумента) работает для обратной совместимости

---

### Подзадача 4: Рефакторинг `web_integration.py` — мульти-аккаунт инициализация и API

**Файл:** `backend/web_integration.py` (строки 5827-6235 — Avito-секция)

**Что делаем:**
1. Инициализировать `AvitoCRMIntegration` с конфигом всех аккаунтов
2. Запускать фоновое обновление токенов для каждого аккаунта
3. Обновить API endpoints для работы с конкретными аккаунтами

**Текущий код (строка 5827-5841):**
```python
_avito_integration = None

def get_avito_integration():
    global _avito_integration
    if _avito_integration is None:
        from avito_integration import AvitoCRMIntegration
        _avito_integration = AvitoCRMIntegration(data_path=str(DATA))
    return _avito_integration
```

**Новый код:**
```python
_avito_integration = None

def get_avito_integration():
    global _avito_integration
    if _avito_integration is None:
        from avito_integration import AvitoCRMIntegration
        _avito_integration = AvitoCRMIntegration(
            data_path=str(DATA),
            accounts_config=None,  # Автозагрузка из .env
        )
    return _avito_integration
```

**Фоновое обновление токенов (строка 5844-5865):**

```python
async def _avito_token_refresh_loop():
    """Обновляет токены для ВСЕХ аккаунтов каждые 23 часа"""
    REFRESH_INTERVAL = 23 * 3600
    while True:
        try:
            await asyncio.sleep(REFRESH_INTERVAL)
            integration = get_avito_integration()
            if integration is None:
                continue

            for account_id, client in integration.avito_clients.items():
                try:
                    print(f"🔄 [Avito Token Refresh] Account {account_id}...")
                    token = await client.get_access_token()
                    if token:
                        print(f"✅ [Avito Token Refresh] Account {account_id} — OK")
                    else:
                        print(f"❌ [Avito Token Refresh] Account {account_id} — FAILED")
                except Exception as e:
                    print(f"❌ [Avito Token Refresh] Account {account_id} — Error: {e}")
        except Exception as e:
            print(f"❌ [Avito Token Refresh] Loop error: {e}")
```

**Вебхук endpoint (строка 5868-5903):**

Определяем аккаунт из payload и передаём в обработчик:

```python
@app.post("/api/avito/webhook")
async def avito_webhook(request: Request):
    body = await request.json()

    # Определяем account_id из payload (value.user_id = ID владельца)
    payload = body.get("payload", {})
    value = payload.get("value", {})
    account_id = str(value.get("user_id", ""))

    integration = get_avito_integration()
    if integration is None:
        return JSONResponse(status_code=503, content={"status": "error", "message": "Avito integration not configured"})

    # Передаём account_id для маршрутизации
    asyncio.create_task(integration.handle_webhook(body, account_id=account_id))
    return JSONResponse(content={"status": "ok", "action": "accepted"})
```

**Регистрация вебхуков для каждого аккаунта:**

```python
@app.post("/api/avito/register-webhook")
async def avito_register_webhook():
    integration = get_avito_integration()
    if integration is None:
        raise HTTPException(503, "Avito integration not configured")

    backend_url = os.getenv("BACKEND_URL", "http://localhost:5005").rstrip("/")
    webhook_url = f"{backend_url}/api/avito/webhook"

    results = {}
    for account_id, client in integration.avito_clients.items():
        try:
            result = await client.register_webhook(webhook_url)
            results[account_id] = {"status": "ok", "result": result}
        except Exception as e:
            results[account_id] = {"status": "error", "message": str(e)}

    return JSONResponse(content={"status": "ok", "accounts": results})
```

**Новый endpoint — список аккаунтов:**

```python
@app.get("/api/avito/accounts")
async def avito_accounts():
    """Список подключённых аккаунтов Авито"""
    integration = get_avito_integration()
    if integration is None:
        raise HTTPException(503, "Avito integration not configured")

    accounts = []
    for account_id, client in integration.avito_clients.items():
        accounts.append({
            "account_id": account_id,
            "label": ...,  # из конфига
        })
    return {"status": "ok", "accounts": accounts}
```

**Startup event (строка 6214-6239):**

Инициализация токенов для всех аккаунтов:

```python
@app.on_event("startup")
async def startup_event():
    ...
    # Avito: инициализация всех аккаунтов
    integration = get_avito_integration()
    if integration is not None:
        for account_id, client in integration.avito_clients.items():
            try:
                token = await client.get_access_token()
                if token:
                    print(f"✅ [Avito Startup] Account {account_id} — token obtained")
            except Exception as e:
                print(f"⚠️ [Avito Startup] Account {account_id} — error: {e}")

        # Одна фоновая задача обновляет токены всех аккаунтов
        global _avito_token_refresh_task
        _avito_token_refresh_task = asyncio.create_task(_avito_token_refresh_loop())
```

**Критерии готовности:**
- [ ] `get_avito_integration()` инициализирует интеграцию со всеми аккаунтами из `.env`
- [ ] `_avito_token_refresh_loop` обновляет токены для каждого аккаунта
- [ ] `/api/avito/webhook` определяет `account_id` из payload и маршрутизирует
- [ ] `/api/avito/register-webhook` регистрирует вебхук для каждого аккаунта
- [ ] `/api/avito/accounts` — новый endpoint для списка аккаунтов
- [ ] Startup event получает токены для всех аккаунтов

---

### Подзадача 5: Обновление CRM UI — отображение аккаунта Авито

**Файл:** `src/pages/admin/CRMPage.tsx`

**Что делаем:**
1. Добавить метку аккаунта в список диалогов
2. Добавить фильтр по аккаунту Авито
3. Показывать аккаунт в карточке пользователя

**Текущий код — определение источника (строка 252-255):**
```tsx
const getUserSource = (user: User): 'telegram' | 'avito' | 'web' => {
    if (user.source) return user.source as 'telegram' | 'avito' | 'web';
    if (String(user.user_id).startsWith('avito_')) return 'avito';
    if (String(user.user_id).startsWith('web_')) return 'web';
    return 'telegram';
};
```

**Изменения:**

1. **Тип User** — добавить поле `avito_account_id` и `avito_account_label`:
```tsx
interface User {
  ...
  avito_account_id?: string;
  avito_account_label?: string;
}
```

2. **Бейдж аккаунта** — рядом с иконкой Авито показывать метку:
```tsx
// В списке диалогов, рядом с авито-иконкой:
{user.source === 'avito' && user.avito_account_label && (
  <span className="text-[8px] bg-green-100 text-green-700 px-1 rounded ml-0.5">
    {user.avito_account_label}
  </span>
)}
```

3. **Фильтр по аккаунту** — добавить выпадающий список рядом с фильтром источника:
```tsx
const [avitoAccountFilter, setAvitoAccountFilter] = useState<string>('all');

// Загрузка списка аккаунтов
const [avitoAccounts, setAvitoAccounts] = useState<{account_id: string, label: string}[]>([]);

useEffect(() => {
  fetch('/api/avito/accounts')
    .then(r => r.json())
    .then(data => setAvitoAccounts(data.accounts || []))
    .catch(() => {});
}, []);
```

4. **В карточке пользователя** — показывать аккаунт Авито:
```tsx
{user.avito_account_id && (
  <div className="text-xs text-gray-500">
    Аккаунт: {user.avito_account_label || user.avito_account_id}
  </div>
)}
```

**Критерии готовности:**
- [ ] В типе `User` есть `avito_account_id` и `avito_account_label`
- [ ] Список аккаунтов загружается с `/api/avito/accounts`
- [ ] Фильтр по аккаунту Авито работает в CRM
- [ ] Бейдж аккаунта отображается рядом с иконкой Авито
- [ ] В карточке пользователя показан аккаунт Авито

---

### Подзадача 6: Обновление промптов — разные промпты для разных аккаунтов

**Файл:** `backend/prompts.yaml`, `backend/avito_integration.py`

**Что делаем:**
Позволяем каждому аккаунту Авито иметь свой промпт. Аккаунт «Мебель» использует `avito_prompt`, аккаунт «Авто» — `avito_auto_prompt` (или общий `main_prompt`).

**Текущий код (avito_integration.py, строка 139-160):**
```python
def _load_prompt(self) -> str:
    import yaml
    prompt_file = Path(__file__).parent / "prompts.yaml"
    with open(prompt_file, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
        prompt = data.get("avito_prompt", "")
        ...
```

**Новый подход:**
- В конфигурацию аккаунта добавить поле `prompt_key` (имя ключа в prompts.yaml)
- При генерации ответа выбирать промпт по аккаунту

```python
# В _load_accounts_from_env:
accounts.append({
    ...
    "prompt_key": os.getenv(f"AVITO_PROMPT_KEY_{i}", "avito_prompt"),
})

# В AvitoCRMIntegration:
def _load_prompt_for_account(self, account_id: str) -> str:
    """Загрузить промпт для конкретного аккаунта"""
    # Найти prompt_key в конфиге аккаунта
    prompt_key = self._get_account_config(account_id).get("prompt_key", "avito_prompt")
    ...
    data = yaml.safe_load(f)
    prompt = data.get(prompt_key, "")
    if not prompt:
        prompt = data.get("avito_prompt", "")  # fallback
    ...
```

**В prompts.yaml добавить:**
```yaml
avito_auto_prompt: |
  Ты — AI помощник по аренде авто и байков на Пхукете.
  Клиент написал тебе в чат Авито по объявлению об аренде.
  ...
```

**Критерии готовности:**
- [ ] Конфигурация аккаунта содержит `prompt_key`
- [ ] `_generate_ai_response` использует промпт конкретного аккаунта
- [ ] В `prompts.yaml` добавлен промпт для второго аккаунта
- [ ] Fallback на `avito_prompt` если ключ не найден

---

### Подзадача 7: Миграция данных — обратная совместимость существующих лидов

**Файлы:** `backend/data/ar/user_data.json`, `backend/avito_integration.py`

**Что делаем:**
Обеспечиваем, что существующие лиды Авито (без `avito_account_id`) корректно обрабатываются после обновления.

**Проблема:**
- Существующие лиды имеют `user_id: "avito_chat_xxx"` без указания аккаунта
- Новый формат: `user_id: "avito_135590675_chat_xxx"` (с account_id)
- Нужно, чтобы старые лиды находились и работали

**Решение:**
1. При поиске лида сначала искать по новому формату, затем по старому
2. При нахождении старого лида — добавить `avito_account_id` к записи
3. Не менять `user_id` у существующих лидов (это сломает связи с chat_logs)

```python
def _find_or_create_avito_lead(self, chat_id, author_id, item_id, username, account_id=""):
    # Пробуем новый формат CRM ID
    crm_user_id_new = AvitoClient.make_avito_chat_crm_id(chat_id, account_id)
    # Пробуем старый формат CRM ID (без аккаунта)
    crm_user_id_old = AvitoClient.make_avito_chat_crm_id(chat_id)

    users = self._load_users()

    # Ищем сначала по новому формату, потом по старому
    for user in users:
        uid = str(user.get("user_id"))
        if uid == crm_user_id_new:
            return user
        if uid == crm_user_id_old:
            # Мигрируем: добавляем account_id если его нет
            if not user.get("avito_account_id") and account_id:
                user["avito_account_id"] = account_id
                self._save_users(users)
            return user

    # Создаём новый лид с новым форматом ID
    ...
```

**Критерии готовности:**
- [ ] Существующие лиды находятся по старому формату `avito_chat_xxx`
- [ ] При нахождении старого лида добавляется `avito_account_id`
- [ ] Новые лиды создаются с новым форматом `avito_{account_id}_chat_xxx`
- [ ] `chat_logs.jsonl` и `crm_history.jsonl` корректно связываются с лидами

---

### Подзадача 8: Регистрация вебхуков для второго аккаунта

**Что делаем:**
После развёртывания кода нужно зарегистрировать вебхук для второго аккаунта Авито.

**Шаги:**
1. Убедиться что сервер запущен и доступен извне
2. Вызвать `POST /api/avito/register-webhook` — зарегистрирует вебхук для ВСЕХ аккаунтов
3. Проверить через `GET /api/avito/webhook-info` что оба аккаунта имеют подписку
4. Протестировать: написать в чат Авито со второго аккаунта и убедиться что вебхук приходит

**Альтернатива — ручная регистрация через curl:**
```bash
# Получить токен для второго аккаунта
curl -X POST https://api.avito.ru/token \
  -d "grant_type=client_credentials&client_id=CLIENT_ID_2&client_secret=CLIENT_SECRET_2"

# Зарегистрировать вебхук
curl -X POST https://api.avito.ru/messenger/v3/webhook \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://weldwood.sunny-rentals.online/api/avito/webhook"}'
```

**Критерии готовности:**
- [ ] Вебхук зарегистрирован для обоих аккаунтов
- [ ] `GET /api/avito/webhook-info` показывает подписки обоих аккаунтов
- [ ] Тестовое сообщение со второго аккаунта приходит в CRM

---

## Порядок внедрения

| Шаг | Подзадача | Зависимости | Риск |
|-----|-----------|-------------|------|
| 1 | Конфигурация `.env` (Подзадача 1) | Нет | Низкий |
| 2 | Рефакторинг `AvitoClient` (Подзадача 2) | Нет | Средний (обратная совместимость) |
| 3 | Рефакторинг `AvitoCRMIntegration` (Подзадача 3) | Шаг 2 | Высокий (ядро логики) |
| 4 | Рефакторинг `web_integration.py` (Подзадача 4) | Шаг 3 | Средний |
| 5 | Миграция данных (Подзадача 7) | Шаг 3 | Средний (потеря данных) |
| 6 | Промпты (Подзадача 6) | Шаг 3 | Низкий |
| 7 | CRM UI (Подзадача 5) | Шаг 4 | Низкий |
| 8 | Регистрация вебхуков (Подзадача 8) | Все шаги | Низкий |

**Рекомендация:** Внедрять шаги 1-5 одним коммитом, затем шаги 6-7, затем шаг 8 (деплой + регистрация).

---

## Риски и ограничения

1. **Один вебхук URL для всех аккаунтов** — Авито отправляет вебхуки на один URL. Маршрутизация по `user_id` в payload. Это работает, т.к. `value.user_id` = ID владельца аккаунта.

2. **Redis-ключи** — нужно убедиться что ключи `avito_access_token_{account_id}` не конфликтуют. При отсутствии Redis используется in-memory кэш — он тоже должен быть per-client (уже так, т.к. каждый `AvitoClient` имеет свой `_token_cache`).

3. **Обратная совместимость CRM ID** — старые лиды с `avito_chat_xxx` должны находиться. Подробно описано в Подзадаче 7.

4. **Лимиты Авито API** — каждый аккаунт имеет свои лимиты. Несколько аккаунтов = несколько независимых лимитов, что лучше.

5. **Один Claude API ключ** — общий для всех аккаунтов. Если нужны разные модели/лимиты — это отдельная задача.

6. **Telegram уведомления** — можно добавить метку аккаунта в уведомление менеджеру, чтобы было понятно откуда сообщение.

---

## Сводка изменений по файлам

| Файл | Тип изменения | Объём |
|------|--------------|-------|
| `backend/.env` | Добавление переменных | ~5 строк |
| `backend/avito_client.py` | Рефакторинг: account_id параметр, динамические Redis-ключи | ~30 строк |
| `backend/avito_integration.py` | Рефакторинг: мульти-клиент, маршрутизация, account_id в лиды | ~100 строк |
| `backend/web_integration.py` | Рефакторинг: мульти-инициализация, маршрутизация вебхуков, новый endpoint | ~60 строк |
| `backend/prompts.yaml` | Добавление промпта для второго аккаунта | ~50 строк |
| `src/pages/admin/CRMPage.tsx` | Добавление фильтра и бейджа аккаунта | ~40 строк |
| **Итого** | | **~285 строк** |
