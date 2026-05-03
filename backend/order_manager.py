#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Order Management — append-only JSONL storage
Status flow: NEW -> PAID -> DONE | CANCELLED
"""

import json
import threading
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
import random
import string


# ── Per-file locks to prevent concurrent write corruption ──────────────
_locks: Dict[str, threading.Lock] = {}
_locks_lock = threading.Lock()


def _get_lock(path: str) -> threading.Lock:
    with _locks_lock:
        if path not in _locks:
            _locks[path] = threading.Lock()
        return _locks[path]


# ── Path helpers ───────────────────────────────────────────────────────

def _orders_file(restaurant_id: str, data_path: str = "./data/ar") -> Path:
    """backend/data/ar/restaurants/{restaurant_id}/orders.jsonl"""
    p = Path(data_path) / "restaurants" / restaurant_id
    p.mkdir(parents=True, exist_ok=True)
    return p / "orders.jsonl"


# ── Core operations ────────────────────────────────────────────────────

def save_order_event(order_data: Dict[str, Any], data_path: str = "./data/ar") -> None:
    """Append one JSON line to the restaurant's orders.jsonl."""
    path = str(_orders_file(order_data["restaurant_id"], data_path))
    lock = _get_lock(path)
    with lock:
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(order_data, ensure_ascii=False) + "\n")


def _read_all_events(restaurant_id: str, data_path: str = "./data/ar") -> List[Dict[str, Any]]:
    """Read every line from orders.jsonl, silently skip bad lines."""
    path = _orders_file(restaurant_id, data_path)
    if not path.exists():
        return []
    events: List[Dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return events


def get_latest_orders(restaurant_id: str, data_path: str = "./data/ar") -> List[Dict[str, Any]]:
    """
    Return the *latest* state for every order_id.
    The last line with a given order_id wins (append-only conflict resolution).
    """
    events = _read_all_events(restaurant_id, data_path)
    by_id: Dict[str, Dict[str, Any]] = {}
    for ev in events:
        by_id[ev["order_id"]] = ev
    return list(by_id.values())


def get_order(restaurant_id: str, order_id: str, data_path: str = "./data/ar") -> Optional[Dict[str, Any]]:
    """Return the latest state of a single order, or None."""
    events = _read_all_events(restaurant_id, data_path)
    latest = None
    for ev in events:
        if ev.get("order_id") == order_id:
            latest = ev
    return latest


# ── High-level helpers ─────────────────────────────────────────────────

def _gen_order_id() -> str:
    """ORD-XXXXX (5 alphanumeric chars)"""
    chars = string.ascii_uppercase + string.digits
    return "ORD-" + "".join(random.choices(chars, k=5))


def create_order(
    restaurant_id: str,
    user_id: str,
    customer_name: str,
    contacts: str,
    items: List[Dict[str, Any]],
    delivery_type: str = "pickup",
    payment_method: str = "qr_prompt_pay",
    data_path: str = "./data/ar",
) -> Dict[str, Any]:
    """
    Create a NEW order and persist it.
    `items` = [{"name": str, "price": number, "qnt": number}, ...]
    `delivery_type` = "pickup" | "delivery"
    `payment_method` = "qr_prompt_pay" | "cash"
    Returns the full order dict.
    """
    total = sum(it.get("price", 0) * it.get("qnt", 0) for it in items)
    now = datetime.now().isoformat()
    order = {
        "order_id": _gen_order_id(),
        "restaurant_id": restaurant_id,
        "user_id": user_id,
        "customer_name": customer_name,
        "contacts": contacts,
        "items": items,
        "total": round(total, 2),
        "delivery_type": delivery_type,
        "payment_method": payment_method,
        "status": "NEW",
        "created_at": now,
        "updated_at": now,
    }
    save_order_event(order, data_path)
    return order


VALID_STATUSES = {"NEW", "CONFIRMED", "PAID", "DONE", "CANCELLED"}


def delete_orders(
    restaurant_id: str,
    order_ids: List[str],
    data_path: str = "./data/ar",
) -> int:
    """
    Remove orders by order_ids from the JSONL file.
    Rewrites the file keeping only events whose order_id is NOT in order_ids.
    Returns the number of events removed.
    """
    path = _orders_file(restaurant_id, data_path)
    if not path.exists():
        return 0

    ids_set = set(order_ids)
    lock = _get_lock(str(path))
    with lock:
        kept: List[str] = []
        removed = 0
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                raw = line.strip()
                if not raw:
                    continue
                try:
                    ev = json.loads(raw)
                    if ev.get("order_id") in ids_set:
                        removed += 1
                    else:
                        kept.append(raw)
                except json.JSONDecodeError:
                    kept.append(raw)  # keep malformed lines as-is

        with open(path, "w", encoding="utf-8") as f:
            for line in kept:
                f.write(line + "\n")

    return removed


def update_status(
    restaurant_id: str,
    order_id: str,
    new_status: str,
    data_path: str = "./data/ar",
) -> Dict[str, Any]:
    """
    Transition an order to `new_status`.
    Reads the latest state, validates, appends a new line.
    Returns the updated order dict.
    Raises ValueError if order not found or status invalid.
    """
    new_status = new_status.upper()
    if new_status not in VALID_STATUSES:
        raise ValueError(f"Invalid status '{new_status}'. Must be one of {VALID_STATUSES}")

    current = get_order(restaurant_id, order_id, data_path)
    if current is None:
        raise ValueError(f"Order {order_id} not found")

    updated = {**current, "status": new_status, "updated_at": datetime.now().isoformat()}
    save_order_event(updated, data_path)
    return updated
