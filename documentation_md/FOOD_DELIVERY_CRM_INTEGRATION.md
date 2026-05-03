# Food Delivery CRM Integration — Technical Documentation

> Last updated: 2026-04-23  
> Status: ✅ Working, build passes, end-to-end verified

---

## 1. Overview

The system adapts an existing **car rental CRM** into a **multi-vendor food delivery** platform. The CRM remains **user-centric** (cards per user, not per order). Food orders are mapped to the existing CRM data model via a bridge layer (`crm_adapter.py`), preserving all rental logic as a parallel flow.

**Key principle:** `order_type: "food"` flag distinguishes food orders from rental bookings in both backend and frontend.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React/Vite)                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  CRMPage.tsx                                                 │   │
│  │  ┌─────────────────┐  ┌──────────────────────────────────┐   │   │
│  │  │  Card List       │  │  Detail View                     │   │   │
│  │  │  if food:        │  │  if food:                        │   │   │
│  │  │   🛍 ShoppingBag  │  │   Items table                   │   │   │
│  │  │   🍽 заказ badge  │  │   Delivery/Payment badges       │   │   │
│  │  │   🛵 delivery     │  │   Total in ₽                    │   │   │
│  │  │   💳 payment      │  │   No "Create offer" button      │   │   │
│  │  │  if rental:      │  │  if rental:                      │   │   │
│  │  │   🚗 Car icon     │  │   Car info, dates, booking form │   │   │
│  │  │   📅 dates        │  │                                  │   │   │
│  │  └─────────────────┘  └──────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         │ /api/crm/* (via Vite proxy → :5005)                       │
└─────────┼───────────────────────────────────────────────────────────┘
          │
┌─────────┼───────────────────────────────────────────────────────────┐
│         ▼           BACKEND (web_integration.py :5005)              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  /api/crm/users  │  │  /api/crm/stats  │  │  /api/crm/       │  │
│  │  /api/crm/       │  │  /api/crm/       │  │  bookings/{uid}  │  │
│  │  update_status   │  │  send_message    │  │                  │  │
│  └────────┬─────────┘  └──────────────────┘  └──────────────────┘  │
│           │ reads/writes                                        │   │
│  ┌────────▼─────────────────────────────────────────────────────┐  │
│  │  DATA FILES (backend/data/)                                  │  │
│  │  ├── user_data.json    ← CRM users (rental + food)          │  │
│  │  ├── bookings.json     ← CRM bookings (rental + food)       │  │
│  │  ├── archive.json      ← archived users                     │  │
│  │  └── ar/                                                    │  │
│  │      ├── restaurants/                                       │  │
│  │      │   ├── pizza_loft/                                    │  │
│  │      │   │   ├── orders.jsonl  ← food orders (append-only)  │  │
│  │      │   │   ├── config.json                                │  │
│  │      │   │   └── menu.json                                  │  │
│  │      │   └── hello_pizza/                                   │  │
│  │      │       ├── orders.jsonl                               │  │
│  │      │       ├── config.json                                │  │
│  │      │       └── menu.json                                  │  │
│  │      └── crm_files/                                         │  │
│  │          ├── chat_logs.jsonl                                │  │
│  │          └── crm_history.jsonl                              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ORDER ROUTER (order_api.py)                                 │  │
│  │  POST /api/{restaurant_id}/orders          → create + sync   │  │
│  │  POST /api/{restaurant_id}/orders/{id}/status → update+sync  │  │
│  │  GET  /api/{restaurant_id}/orders          → list            │  │
│  │  GET  /api/{restaurant_id}/orders/{id}     → get single      │  │
│  │  GET  /api/crm/bookings                    → all food books  │  │
│  └──────────┬───────────────────────────────────┬───────────────┘  │
│             │ on create/update                   │                   │
│     ┌───────▼────────┐                ┌─────────▼──────────┐       │
│     │  crm_adapter   │                │  HTTP → bot :5003  │       │
│     │  sync_order_   │                │  /botapi/          │       │
│     │  to_crm()      │                │  notify_order      │       │
│     └───────┬────────┘                └─────────┬──────────┘       │
└─────────────┼───────────────────────────────────┼──────────────────┘
              │                                   │
              ▼                                   ▼
     user_data.json +                    ┌──────────────────────┐
     bookings.json                       │  TELEGRAM BOT        │
                                        │  (ar_telegram_bot.py │
                                        │   :5003)             │
                                        │                      │
                                        │  /botapi/notify_order│
                                        │  → sends to admin    │
                                        │    ✅ ОПЛАТИЛ        │
                                        │    💬 ЧАТ С МЕНЕДЖ.  │
                                        │                      │
                                        │  callback:           │
                                        │  order_paid:→PAID    │
                                        │  order_chat:→notify  │
                                        └──────────────────────┘
```

---

## 3. Port Allocation

| Port | Service | Process | Notes |
|------|---------|---------|-------|
| `5000` | Production rental app | — | **DO NOT TOUCH** |
| `5001` | Production rental bot | — | **DO NOT TOUCH** |
| `5005` | Food delivery backend | `web_integration.py` | CRM + Order API |
| `5003` | Food delivery bot | `ar_telegram_bot.py` | pyTelegramBotAPI + FastAPI |
| `5173` | Vite dev server | `npx vite --host` | Proxy `/api` → `:5005` |

---

## 4. Data Entities & Relationships

### 4.1 Order (source of truth: `orders.jsonl`)

Append-only JSONL. Last event per `order_id` wins.

```json
{
  "order_id": "ORD-WFNXD",
  "restaurant_id": "pizza_loft",
  "user_id": "123456789",          // Telegram chat_id or empty
  "customer_name": "Марсель",
  "contacts": "+79219959164",
  "items": [
    {"name": "Пепперони", "price": 450, "qnt": 1}
  ],
  "total": 450.0,
  "delivery_type": "pickup",       // "pickup" | "delivery"
  "payment_method": "qr_prompt_pay", // "qr_prompt_pay" | "cash"
  "status": "NEW",                 // NEW → PAID → DONE | CANCELLED
  "created_at": "2026-04-23T21:59:21.457266",
  "updated_at": "2026-04-23T21:59:21.457266"
}
```

**Status flow:** `NEW` → `PAID` → `DONE` | `CANCELLED`

### 4.2 CRM User (in `user_data.json`)

One record per unique customer. Food order users are identified by `order_type: "food"`.

```json
{
  "user_id": "123456789",          // Telegram ID (numeric) → chat enabled
                                   // "web_79219959164"    → web-source (no chat)
  "username": "Марсель",
  "status": "in_work",             // CRM status (see mapping below)
  "order_type": "food",            // ← KEY FLAG: "food" or absent (rental)
  "car_interested": "Пепперони (x1), Маргарита (x2)",
  "created_at": "...",
  "updated_at": "...",
  "pickup_location": "pickup",     // delivery_type for food
  "marker": null,                  // CRM marker (preserved on update)
  "notes": [],                     // CRM notes (preserved on update)
  "last_note": null,
  "has_active_booking": true,
  "archived": false,
  "history_notes": [],
  "dialog_status": null,
  "dialog": null
}
```

### 4.3 CRM Booking (in `bookings.json`)

One record per order. Reuses rental booking structure with food-specific fields.

```json
{
  "booking_id": "ORD-WFNXD",       // Same as order_id
  "user_id": "123456789",
  "status": "pre_booking",         // CRM booking status (see mapping)
  "order_type": "food",            // ← KEY FLAG
  "created_at": "...",
  "updated_at": "...",
  "form_data": {
    "car": {
      "name": "Пепперони (x1)",    // Items summary (reuses "car" field)
      "id": null
    },
    "dates": {
      "start": "2026-04-23T...",   // Order created_at
      "end": null
    },
    "contact": {
      "name": "Марсель",
      "value": "+79219959164"
    },
    "pricing": {
      "totalRental": 450.0,        // Order total (reuses "totalRental")
      "deposit": 0,
      "delivery": 0
    },
    "items": [...],                // Full items array
    "delivery_type": "pickup",
    "payment_method": "qr_prompt_pay",
    "restaurant_id": "pizza_loft"
  }
}
```

### 4.4 User ID Resolution Logic

The CRM is user-centric — multiple orders from the same person map to one user card.

| Condition | `user_id` value | Chat in CRM? |
|-----------|-----------------|--------------|
| `order.user_id` is numeric (Telegram ID) | `"123456789"` | ✅ Yes — bot can send messages |
| `order.user_id` empty, `contacts` has phone | `"web_79219959164"` | ❌ No — web-source |
| Both empty | `"web_ORD-WFNXD"` | ❌ No — fallback |

**Important:** Only numeric `user_id` (Telegram chat_id) enables the CRM chat feature. `web_*` prefixed users cannot receive Telegram messages.

---

## 5. Status Mapping

### Order → CRM User Status

| Order Status | CRM User Status | CRM Tab |
|-------------|-----------------|---------|
| `NEW` | `new` | Новые |
| `PAID` | `in_work` | В работе |
| `DONE` | `confirmed` | Подтверждённые |
| `CANCELLED` | `archive` | Архив |

### Order → CRM Booking Status

| Order Status | CRM Booking Status | Display |
|-------------|-------------------|---------|
| `NEW` | `new` | Новый |
| `PAID` | `pre_booking` | Предоплата |
| `DONE` | `confirmed` | Подтверждён |
| `CANCELLED` | `cancelled` | Отменён |

---

## 6. API Endpoints

### 6.1 Order API (order_api.py, mounted at `/api`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/{restaurant_id}/orders` | Create order (NEW) + CRM sync + bot notification |
| `POST` | `/api/{restaurant_id}/orders/{order_id}/status` | Update status + CRM sync |
| `GET` | `/api/{restaurant_id}/orders` | List all orders for restaurant |
| `GET` | `/api/{restaurant_id}/orders/{order_id}` | Get single order |
| `GET` | `/api/crm/bookings` | All food orders as CRM bookings |

**Create Order Request Body:**
```json
{
  "user_id": "123456789",
  "customer_name": "Марсель",
  "contacts": "+79219959164",
  "items": [{"name": "Пепперони", "price": 450, "qnt": 1}],
  "delivery_type": "pickup",
  "payment_method": "qr_prompt_pay"
}
```

**Update Status Request Body:**
```json
{"status": "PAID"}
```

### 6.2 CRM API (web_integration.py, mounted at `/api/crm`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/crm/users` | All CRM users (rental + food) |
| `GET` | `/api/crm/users?status=new` | Filter by status |
| `GET` | `/api/crm/stats` | CRM statistics |
| `GET` | `/api/crm/bookings/{user_id}` | Bookings for user |
| `POST` | `/api/crm/update_status` | Change user status |
| `POST` | `/api/crm/update_marker` | Change user marker |
| `POST` | `/api/crm/send_message` | Send message via bot |
| `POST` | `/api/crm/add_note` | Add note to user |
| `GET` | `/api/crm/chats/{user_id}` | Chat history |
| `GET` | `/api/crm/dialog/{user_id}/status` | Dialog status |
| `POST` | `/api/crm/dialog/{user_id}/mark-read` | Mark dialog read |

### 6.3 Bot API (ar_telegram_bot.py, port 5003)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/botapi/notify_order` | Receive order from order_api, send to admin chat |
| `POST` | `/botapi/notify/webapp-opened` | User opened webapp |
| `POST` | `/botapi/notify/filters-used` | User used filters (warm lead) |
| `POST` | `/botapi/notify/booking-submitted` | Rental booking submitted |

**Bot Callbacks (inline button presses):**

| Callback Data | Handler | Action |
|---------------|---------|--------|
| `order_paid:{order_id}:{restaurant_id}` | `handle_order_paid_callback` | Set status PAID, sync CRM, edit message |
| `order_chat:{order_id}:{restaurant_id}` | `handle_order_chat_callback` | Notify admin about chat request |

---

## 7. Data Flow: End-to-End

### 7.1 New Order Created

```
Customer → POST /api/{restaurant_id}/orders
         → order_manager.create_order() → append to orders.jsonl
         → crm_adapter.sync_order_to_crm()
             → _resolve_user_id() → determine CRM user_id
             → _order_to_booking() → create booking record
             → _order_to_user() → create user record
             → update bookings.json (upsert by booking_id)
             → update user_data.json (upsert by user_id, preserve notes/markers)
         → notify_order_via_bot_api()
             → HTTP POST to bot:5003/botapi/notify_order
             → Bot sends message to admin chat with ✅ ОПЛАТИЛ / 💬 ЧАТ buttons
```

### 7.2 Admin Presses "ОПЛАТИЛ" in Telegram

```
Admin → Telegram callback: order_paid:ORD-WFNXD:pizza_loft
     → handle_order_paid_callback()
         → order_manager.update_status("PAID")
         → crm_adapter.sync_order_to_crm() → user status → "in_work"
         → bot.edit_message_text() → "✅ ЗАКАЗ ОПЛАЧЕН"
```

### 7.3 CRM Page Loads

```
CRMPage.tsx → fetch /api/crm/users
            → web_integration.get_crm_users()
                → load user_data.json
                → filter: allow numeric IDs, web_*, phone_*
                → attach last_booking from bookings.json
                → attach dialog status from crm_history.jsonl
            → Frontend renders cards:
                if user.order_type === 'food' → food card layout
                else → rental card layout
```

---

## 8. Frontend Components

### 8.1 CRMPage.tsx (`src/pages/admin/CRMPage.tsx`)

**Conditional rendering by `order_type`:**

| Element | Food Order (`order_type: "food"`) | Rental (default) |
|---------|-----------------------------------|------------------|
| Card icon | `ShoppingBag` (orange) | `Car` (blue) |
| Card badge | 🍽 заказ | Category badge |
| Card row 2 | `Truck` + delivery_type, `Wallet` + payment_method | `Calendar` + dates |
| Username | Customer name (no @) | @username |
| User ID | `web_` → 🌐 + phone | ID: number |
| Detail bookings tab | Items table, delivery/payment badges, total ₽ | Car info, dates, confirm/reject |
| "Create offer" button | **Hidden** | Shown |
| Chat tab | Available if numeric user_id | Always available |

### 8.2 Key User Interface Fields

```typescript
interface User {
  user_id: number | string;
  username: string;
  status: string;
  order_type?: string;     // 'food' for restaurant orders
  last_booking?: any;      // Last booking data (rental or food order)
  archived?: boolean;
  dialog?: any;
  updated_at?: string;
  // ... other CRM fields
}
```

### 8.3 BookingFormDialog.tsx (`src/components/BookingFormDialog.tsx`)

Currently a **stub** — only shown for rental bookings. Food orders hide the "Create offer" button. Full implementation in `refs/BookingFormDialog.tsx`.

---

## 9. Backend Modules

### 9.1 crm_adapter.py

**Purpose:** Bridge between food orders (orders.jsonl) and CRM data (user_data.json + bookings.json).

| Function | Description |
|----------|-------------|
| `sync_order_to_crm(order, data_path)` | Main entry: upsert user + booking for an order |
| `get_all_food_orders_as_bookings(data_path)` | Scan all orders.jsonl, return as CRM bookings |
| `get_all_food_orders_as_users(data_path)` | Scan all orders.jsonl, return as CRM users |
| `get_food_bookings_for_user(user_id, data_path)` | Get bookings for specific user |
| `update_crm_user_status(user_id, status, data_path)` | Update user status in user_data.json |
| `_resolve_user_id(order)` | Determine CRM user_id from order data |
| `_order_to_booking(order)` | Convert order → CRM booking record |
| `_order_to_user(order)` | Convert order → CRM user record |
| `_read_all_orders(data_path)` | Scan all restaurants/*/orders.jsonl |

**Thread safety:** Uses `threading.RLock()` (reentrant) to prevent deadlock when `_save_json` is called inside `sync_order_to_crm`.

**Path convention:**
- `data_path` parameter = `"./data"` (CRM root)
- Restaurants dir = `data_path / "ar" / "restaurants"`
- User data file = `data_path / "user_data.json"`
- Bookings file = `data_path / "bookings.json"`

### 9.2 order_api.py

**Purpose:** FastAPI router for order CRUD + CRM sync + bot notification.

| Function | Description |
|----------|-------------|
| `create_order_router(data_path)` | Router factory, receives `"./data/ar"` from web_integration |
| `_crm_data_path(data_path)` | Strips `/ar` suffix → `"./data"` for CRM operations |
| `notify_order_via_bot_api(order)` | HTTP POST to bot's `/botapi/notify_order` |

**Key design:** `data_path` for orders is `"./data/ar"` but CRM files live at `"./data/"`. The `_crm_data_path()` helper strips the `/ar` suffix.

### 9.3 order_manager.py

**Purpose:** Low-level JSONL operations for orders.

| Function | Description |
|----------|-------------|
| `create_order(restaurant_id, ...)` | Generate order_id, append to orders.jsonl |
| `update_status(restaurant_id, order_id, new_status)` | Validate transition, append new event |
| `get_latest_orders(restaurant_id)` | All orders, last event per order_id |
| `get_order(restaurant_id, order_id)` | Single order latest state |

**Storage:** Append-only JSONL at `data/ar/restaurants/{restaurant_id}/orders.jsonl`

### 9.4 ar_telegram_bot.py (food delivery additions)

| Addition | Line | Description |
|----------|------|-------------|
| `handle_order_paid_callback` | ~1371 | Processes `order_paid:` callback → PAID + CRM sync |
| `handle_order_chat_callback` | ~1422 | Processes `order_chat:` callback → admin notification |
| `/botapi/notify_order` | ~2094 | Receives order from order_api, sends to admin with buttons |

---

## 10. Environment Variables

### backend/.env

```env
# Bot tokens
BOT_TOKEN=8761576957:AAH7re_F9JsPMQQqCPmVo3r0g-DhtiO73Dc
TELEGRAM_BOT_TOKEN=8149638372:AAENK0ZGDpSo5RFBwcFJpWSzWPOTMDs6zeI

# Bot reads: WEBAPP_BOT_TOKEN > BOT_TOKEN > TELEGRAM_BOT_TOKEN
TG_WEBHOOK_URL=http://localhost:5003

# Admin
ADMIN_ID=<telegram_admin_id>
TELEGRAM_ADMIN_CHAT_ID=<telegram_admin_chat_id>

# Chat groups
HOT_BOOKINGS_CHAT_ID=<group_id>
WARM_LEADS_CHAT_ID=<group_id>
ACTIVE_DIALOGS_CHAT_ID=<group_id>

# API
BOT_API_BASE=http://localhost:5003
```

---

## 11. File Structure (relevant files only)

```
backend/
├── .env                          # Environment variables
├── ar_telegram_bot.py            # Telegram bot (pyTelegramBotAPI + FastAPI :5003)
├── crm_adapter.py                # Order ↔ CRM bridge (NEW)
├── order_api.py                  # Order REST API + CRM sync (MODIFIED)
├── order_manager.py              # JSONL order storage
├── web_integration.py            # Main backend (FastAPI :5005) (MODIFIED)
├── menu_api.py                   # Restaurant menu API
├── data/
│   ├── user_data.json            # CRM users (rental + food)
│   ├── bookings.json             # CRM bookings (rental + food)
│   ├── archive.json              # Archived users
│   ├── partners.json
│   └── ar/
│       ├── restaurants/
│       │   ├── pizza_loft/
│       │   │   ├── orders.jsonl  # Food orders
│       │   │   ├── config.json   # Restaurant config
│       │   │   └── menu.json     # Menu items
│       │   └── hello_pizza/
│       │       ├── orders.jsonl
│       │       ├── config.json
│       │       └── menu.json
│       └── crm_files/
│           ├── chat_logs.jsonl
│           └── crm_history.jsonl

src/
├── pages/admin/
│   └── CRMPage.tsx               # CRM frontend (MODIFIED for food)
├── components/
│   ├── BookingFormDialog.tsx     # Stub (rental only)
│   └── CRMTutorialSheet.tsx      # CRM tutorial
├── data/
│   └── crm.tsx                   # MarkerType + MARKER_CONFIGS
└── ...

vite.config.ts                    # Proxy /api → localhost:5005 (MODIFIED)
```

---

## 12. Known Issues & TODO

### Current Issues

1. **`URL_WEBAPP` env var not set** — Bot shows `Bad Request: can't parse inline keyboard button: Field "url" must be of type String` on `/start` command. Need to set `URL_WEBAPP` in `.env`.

2. **`CARS_JSON` not defined** — `web_integration.py` references `CARS_JSON` which doesn't exist in the food delivery context. Non-critical (just a warning on startup).

3. **`BookingFormDialog` is a stub** — Full rental booking form exists in `refs/BookingFormDialog.tsx` but requires `@/api/api` module which doesn't exist yet.

4. **No `web_session` → food order migration** — If a user starts as `web_session_*` and later connects via Telegram, they remain separate CRM cards. Need a merge strategy.

### Future Enhancements

- [ ] **Restaurant admin panel** — Each restaurant sees only their orders
- [ ] **Order status push to customer** — Notify customer via Telegram when order status changes
- [ ] **Delivery tracking** — Integrate Grab/Google Maps delivery status
- [ ] **Payment integration** — Real QR Prompt Pay / payment gateway
- [ ] **Kitchen display** — Separate view for kitchen staff (order queue)
- [ ] **Multi-restaurant cart** — Allow ordering from multiple restaurants
- [ ] **User merge** — Merge `web_*` users with Telegram users when they connect

---

## 13. Quick Start

```bash
# 1. Start backend
cd backend && python3 web_integration.py  # → port 5005

# 2. Start bot (in separate terminal)
cd backend && python3 ar_telegram_bot.py  # → port 5003

# 3. Start frontend (in separate terminal)
npx vite --host  # → port 5173, proxies /api → 5005

# 4. Test
curl http://localhost:5005/api/crm/users | python3 -m json.tool
curl -X POST http://localhost:5005/api/pizza_loft/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"Test","contacts":"+79990001111","items":[{"name":"Пицца","price":500,"qnt":1}]}'
```

---

## 14. Critical Design Decisions

1. **CRM is user-centric, not order-centric** — Multiple orders from same phone/Telegram ID map to ONE user card. The latest order overwrites the user's `car_interested` and `status`.

2. **`order_type: "food"` is the discriminator** — Frontend checks `user.order_type === 'food'` or `booking.form_data.order_type === 'food'` to switch rendering.

3. **`form_data.car.name` reused for items summary** — The rental CRM shows `car.name` in the card. Food orders put the items summary there (e.g., "Пепперони (x1), Маргарита (x2)").

4. **`form_data.pricing.totalRental` reused for order total** — The rental CRM shows rental price. Food orders put the order total there.

5. **Bot notification via HTTP, not aiogram** — Two bot instances (aiogram vs pyTelegramBotAPI) conflict on the same token. Solution: `order_api.py` sends HTTP POST to bot's FastAPI server instead of creating a second Bot instance.

6. **Append-only JSONL for orders** — Orders are never mutated. Status changes append a new line. The latest line per `order_id` is the current state.

7. **CRM adapter preserves notes/markers** — When `sync_order_to_crm()` updates an existing user, it preserves `notes`, `marker`, `dialog_status`, `dialog`, and `history_notes` from the previous record.
