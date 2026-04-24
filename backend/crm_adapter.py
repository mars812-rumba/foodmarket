#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
CRM Adapter — bridges food orders (orders.jsonl) with the existing CRM data model.

The CRM (CRMPage.tsx + web_integration.py) is user-centric:
  - user_data.json  → list of user records with status, markers, notes
  - bookings.json   → list of booking records per user

This adapter:
  1. Reads orders.jsonl from all restaurants
  2. Creates/updates user records in user_data.json
  3. Creates/updates booking records in bookings.json
  4. Maps order statuses to CRM statuses

Status mapping:
  Order NEW       → CRM user "pre_booking", booking "pre_booking"  (PBOOK — waiting restaurant confirmation)
  Order PAID      → CRM user "confirmed",   booking "confirmed"    (BOOK  — restaurant confirmed)
  Order DONE      → CRM user "confirmed",   booking "confirmed"    (BOOK  — completed)
  Order CANCELLED → CRM user "archive",     booking "cancelled"    (ARCHIVE)
"""

import json
import threading
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

# ── Thread lock for safe concurrent writes ──────────────────────────────
_lock = threading.RLock()  # Reentrant lock — allows nested acquisition from same thread


# ── Status mapping ──────────────────────────────────────────────────────

ORDER_TO_CRM_USER_STATUS = {
    "NEW": "pre_booking",    # PBOOK — waiting restaurant confirmation
    "CONFIRMED": "confirmed",  # BOOK — manager confirmed the order
    "PAID": "confirmed",     # BOOK  — payment received
    "DONE": "confirmed",     # BOOK  — completed
    "CANCELLED": "archive",  # ARCHIVE
}

ORDER_TO_CRM_BOOKING_STATUS = {
    "NEW": "pre_booking",    # PBOOK — waiting restaurant confirmation
    "CONFIRMED": "confirmed",  # BOOK — manager confirmed the order
    "PAID": "confirmed",     # BOOK  — payment received
    "DONE": "confirmed",     # BOOK  — completed
    "CANCELLED": "cancelled",
}


# ── Path helpers ────────────────────────────────────────────────────────

def _get_data_dir(data_path: str = "./data") -> Path:
    """Resolve the data directory (same as web_integration.DATA)."""
    p = Path(data_path)
    if not p.is_absolute():
        p = Path(__file__).parent / p
    return p


def _user_data_file(data_path: str = "./data") -> Path:
    return _get_data_dir(data_path) / "user_data.json"


def _bookings_file(data_path: str = "./data") -> Path:
    return _get_data_dir(data_path) / "bookings.json"


def _restaurants_dir(data_path: str = "./data") -> Path:
    """Restaurants live under data/ar/restaurants/"""
    return _get_data_dir(data_path) / "ar" / "restaurants"


# ── JSON helpers ────────────────────────────────────────────────────────

def _load_json_list(path: Path) -> List[Dict[str, Any]]:
    """Load a JSON file as a list. Returns [] if file missing or invalid."""
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, IOError):
        return []


def _save_json(path: Path, data: Any) -> None:
    """Atomically save JSON with utf-8 encoding."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with _lock:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


# ── Order reading ───────────────────────────────────────────────────────

def _read_all_orders(data_path: str = "./data") -> List[Dict[str, Any]]:
    """
    Scan all restaurants/*/orders.jsonl and return the latest state for each order_id.
    """
    rest_dir = _restaurants_dir(data_path)
    if not rest_dir.exists():
        return []

    by_id: Dict[str, Dict[str, Any]] = {}

    for restaurant_path in sorted(rest_dir.iterdir()):
        if not restaurant_path.is_dir():
            continue
        orders_file = restaurant_path / "orders.jsonl"
        if not orders_file.exists():
            continue

        with open(orders_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                    order_id = event.get("order_id")
                    if order_id:
                        by_id[order_id] = event  # last event wins
                except json.JSONDecodeError:
                    continue

    return list(by_id.values())


# ── User ID resolution ─────────────────────────────────────────────────

def _resolve_user_id(order: Dict[str, Any]) -> str:
    """
    Determine the CRM user_id for an order.
    - If order.user_id is a non-empty numeric string → use it as Telegram chat_id
      (enables CRM chat with the user via bot)
    - Otherwise → synthesize: "web_{phone}" for web-source users
    - Last resort → "web_{order_id}"
    """
    uid = order.get("user_id", "")
    if uid and str(uid).strip():
        uid_str = str(uid).strip()
        # If it's a numeric Telegram user_id / chat_id, use it directly
        try:
            int(uid_str)
            return uid_str
        except ValueError:
            pass

    # Web-source user — try phone number
    contacts = order.get("contacts", "")
    if contacts and str(contacts).strip():
        phone = str(contacts).strip().replace("+", "").replace(" ", "").replace("-", "")
        return f"web_{phone}"

    # Fallback to order_id
    return f"web_{order['order_id']}"


# ── Build items summary ────────────────────────────────────────────────

def _build_items_summary(items: List[Dict[str, Any]]) -> str:
    """Create a summary string: 'Pizza (x2), Coke (x1)'"""
    parts = []
    for item in items:
        name = item.get("name", "?")
        qnt = item.get("qnt", 1)
        parts.append(f"{name} (x{qnt})")
    return ", ".join(parts)


# ── Order → CRM Booking ────────────────────────────────────────────────

def _order_to_booking(order: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert a food order to a CRM booking record.
    The booking format is compatible with the existing CRMPage.tsx expectations.
    """
    items = order.get("items", [])
    order_status = order.get("status", "NEW").upper()
    user_id = _resolve_user_id(order)

    return {
        "booking_id": order["order_id"],
        "user_id": user_id,
        "status": ORDER_TO_CRM_BOOKING_STATUS.get(order_status, "new"),
        "order_type": "food",  # ← Key flag for frontend detection
        "created_at": order.get("created_at", datetime.now().isoformat()),
        "updated_at": order.get("updated_at", datetime.now().isoformat()),
        "form_data": {
            # Reuse "car" field for order number — CRM card header shows this
            "car": {
                "name": f"Заказ #{order['order_id']}",
                "id": None,
            },
            "dates": {
                "start": order.get("created_at", ""),
                "end": None,
            },
            "contact": {
                "name": order.get("customer_name", ""),
                "value": order.get("contacts", ""),
            },
            "pricing": {
                "totalRental": order.get("total", 0),
                "deposit": 0,
                "delivery": 0,
            },
            # Food-specific fields
            "items": items,
            "delivery_type": order.get("delivery_type", "pickup"),
            "payment_method": order.get("payment_method", "qr_prompt_pay"),
            "restaurant_id": order.get("restaurant_id", ""),
        },
    }


# ── Order → CRM User ───────────────────────────────────────────────────

def _order_to_user(order: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert a food order to a CRM user record.
    Minimal fields needed for CRMPage.tsx card rendering.
    """
    order_status = order.get("status", "NEW").upper()
    user_id = _resolve_user_id(order)
    now = datetime.now().isoformat()

    return {
        "user_id": user_id,
        "username": order.get("customer_name", ""),
        "status": ORDER_TO_CRM_USER_STATUS.get(order_status, "pre_booking"),
        "order_type": "food",
        "car_interested": f"Заказ #{order['order_id']}",
        "created_at": order.get("created_at", now),
        "updated_at": order.get("updated_at", now),
        "pickup_location": order.get("delivery_type", "pickup"),
        "marker": None,
        "notes": [],
        "last_note": None,
        "has_active_booking": order_status in ("NEW", "PAID"),
        "archived": False,
    }


# ── Public API ──────────────────────────────────────────────────────────

def sync_order_to_crm(order: Dict[str, Any], data_path: str = "./data") -> Dict[str, Any]:
    """
    Synchronize a single order to CRM data (user_data.json + bookings.json).

    Called when:
      - A new order is created (order_api.create_order)
      - An order status is updated (order_api.update_status)

    Returns: {"user_id": str, "booking_id": str, "status": str}
    """
    user_data_path = _user_data_file(data_path)
    bookings_path = _bookings_file(data_path)

    user_id = _resolve_user_id(order)
    booking_id = order["order_id"]
    order_status = order.get("status", "NEW").upper()

    # Build CRM records
    new_booking = _order_to_booking(order)
    new_user_data = _order_to_user(order)

    with _lock:
        # ── Update bookings.json ──
        bookings = _load_json_list(bookings_path)

        # Replace existing booking or append new
        found_booking = False
        for i, b in enumerate(bookings):
            if b.get("booking_id") == booking_id:
                bookings[i] = new_booking
                found_booking = True
                break
        if not found_booking:
            bookings.append(new_booking)

        _save_json(bookings_path, bookings)

        # ── Update user_data.json ──
        users = _load_json_list(user_data_path)

        found_user = False
        for i, u in enumerate(users):
            if str(u.get("user_id")) == str(user_id):
                # Update existing user — preserve notes, markers, dialog_status
                preserved_fields = {
                    "notes": u.get("notes", []),
                    "last_note": u.get("last_note"),
                    "marker": u.get("marker"),
                    "history_notes": u.get("history_notes", []),
                    "dialog_status": u.get("dialog_status"),
                    "dialog": u.get("dialog"),
                }
                users[i] = {**new_user_data, **preserved_fields}
                found_user = True
                break

        if not found_user:
            users.append(new_user_data)

        _save_json(user_data_path, users)

    return {
        "user_id": user_id,
        "booking_id": booking_id,
        "crm_status": ORDER_TO_CRM_USER_STATUS.get(order_status, "new"),
    }


def get_all_food_orders_as_bookings(data_path: str = "./data") -> List[Dict[str, Any]]:
    """
    GET /api/crm/bookings adapter:
    Scan all orders.jsonl and return bookings in CRM format.
    Used by the CRM frontend to display food orders.
    """
    orders = _read_all_orders(data_path)
    return [_order_to_booking(order) for order in orders]


def get_all_food_orders_as_users(data_path: str = "./data") -> List[Dict[str, Any]]:
    """
    Return food order users in CRM format.
    Merges with existing user_data.json to avoid duplicates.
    """
    orders = _read_all_orders(data_path)
    result = []
    seen_ids = set()

    for order in orders:
        user_id = _resolve_user_id(order)
        if user_id not in seen_ids:
            result.append(_order_to_user(order))
            seen_ids.add(user_id)

    return result


def get_food_bookings_for_user(user_id: str, data_path: str = "./data") -> List[Dict[str, Any]]:
    """
    Get all food order bookings for a specific user.
    """
    orders = _read_all_orders(data_path)
    bookings = []
    for order in orders:
        order_user_id = _resolve_user_id(order)
        if str(order_user_id) == str(user_id):
            bookings.append(_order_to_booking(order))
    return bookings


def update_crm_user_status(user_id: str, new_crm_status: str, data_path: str = "./data") -> bool:
    """
    Update a user's CRM status in user_data.json.
    Called when order status changes to keep CRM in sync.
    """
    user_data_path = _user_data_file(data_path)

    with _lock:
        users = _load_json_list(user_data_path)
        updated = False

        for i, u in enumerate(users):
            if str(u.get("user_id")) == str(user_id):
                users[i]["status"] = new_crm_status
                users[i]["updated_at"] = datetime.now().isoformat()
                updated = True
                break

        if updated:
            _save_json(user_data_path, users)

    return updated
