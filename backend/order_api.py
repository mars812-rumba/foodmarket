#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Order API — FastAPI router
Endpoints: POST create, POST update-status, GET list, GET single
+ CRM adapter integration (sync orders to CRM data)
+ Telegram notification via HTTP to ar_telegram_bot (no aiogram conflict)
"""

import os
import json
import asyncio
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from order_manager import create_order, update_status, get_latest_orders, get_order, save_order_event, VALID_STATUSES
from crm_adapter import sync_order_to_crm, get_all_food_orders_as_bookings, ORDER_TO_CRM_USER_STATUS

logger = logging.getLogger(__name__)


# ── Pydantic models ────────────────────────────────────────────────────

class OrderItem(BaseModel):
    name: str
    price: float
    qnt: int

class CreateOrderRequest(BaseModel):
    user_id: str = ""
    customer_name: str = ""
    contacts: str = ""
    items: List[OrderItem]
    delivery_type: str = "pickup"      # "pickup" | "delivery"
    payment_method: str = "qr_prompt_pay"  # "qr_prompt_pay" | "cash"

class UpdateStatusRequest(BaseModel):
    status: str

class PaymentSentRequest(BaseModel):
    payment_sent: bool = True


# ── Telegram notification via HTTP ──────────────────────────────────────
# Instead of creating a separate aiogram Bot instance (which conflicts with
# the running ar_telegram_bot.py), we send an HTTP request to the bot's
# FastAPI server on port 5001.

BOT_API_BASE = os.getenv("BOT_API_BASE", "http://localhost:5003")


async def notify_order_via_bot_api(order: Dict[str, Any]) -> None:
    """
    Send order notification by calling the ar_telegram_bot's HTTP endpoint.
    The bot will then send the message with inline buttons to the admin chat.
    Failures are logged, not raised.
    """
    try:
        import httpx

        payload = {
            "order_id": order["order_id"],
            "restaurant_id": order.get("restaurant_id", ""),
            "items": order.get("items", []),
            "total": order.get("total", 0),
            "delivery_type": order.get("delivery_type", "pickup"),
            "payment_method": order.get("payment_method", "qr_prompt_pay"),
            "customer_name": order.get("customer_name", ""),
            "contacts": order.get("contacts", ""),
            "user_id": order.get("user_id", ""),
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{BOT_API_BASE}/botapi/notify_order",
                json=payload,
            )
            if resp.status_code == 200:
                logger.info(f"✅ Order notification sent via bot API: {order['order_id']}")
            else:
                logger.warning(f"⚠️ Bot API notification failed ({resp.status_code}): {resp.text}")

    except ImportError:
        # httpx not available — fall back to requests (synchronous, but in thread)
        try:
            import requests
            payload = {
                "order_id": order["order_id"],
                "restaurant_id": order.get("restaurant_id", ""),
                "items": order.get("items", []),
                "total": order.get("total", 0),
                "delivery_type": order.get("delivery_type", "pickup"),
                "payment_method": order.get("payment_method", "qr_prompt_pay"),
                "customer_name": order.get("customer_name", ""),
                "contacts": order.get("contacts", ""),
                "user_id": order.get("user_id", ""),
            }
            resp = requests.post(
                f"{BOT_API_BASE}/botapi/notify_order",
                json=payload,
                timeout=10,
            )
            if resp.status_code == 200:
                logger.info(f"✅ Order notification sent via bot API (requests): {order['order_id']}")
            else:
                logger.warning(f"⚠️ Bot API notification failed ({resp.status_code})")
        except Exception as e:
            logger.warning(f"⚠️ Failed to send Telegram notification: {e}")

    except Exception as e:
        logger.warning(f"⚠️ Failed to send Telegram notification: {e}")


# ── Router factory ─────────────────────────────────────────────────────

def _crm_data_path(data_path: str) -> str:
    """
    Derive the CRM data root from the order data_path.
    Order data lives under ./data/ar/... but CRM files (user_data.json, bookings.json)
    live at ./data/... — so we strip the trailing /ar if present.
    """
    if data_path.rstrip("/").endswith("/ar"):
        return data_path.rstrip("/")[:-3]  # strip "/ar"
    return data_path


def create_order_router(data_path: str = "./data/ar") -> APIRouter:
    router = APIRouter(prefix="/api", tags=["orders"])
    crm_path = _crm_data_path(data_path)

    @router.post("/{restaurant_id}/orders")
    async def api_create_order(restaurant_id: str, body: CreateOrderRequest):
        """Create a new order (status=NEW) and sync to CRM."""
        try:
            items_dicts = [it.dict() for it in body.items]
            order = create_order(
                restaurant_id=restaurant_id,
                user_id=body.user_id,
                customer_name=body.customer_name,
                contacts=body.contacts,
                items=items_dicts,
                delivery_type=body.delivery_type,
                payment_method=body.payment_method,
                data_path=data_path,
            )

            # Sync order to CRM (user_data.json + bookings.json)
            try:
                crm_result = sync_order_to_crm(order, crm_path)
                logger.info(f"✅ Order synced to CRM: user={crm_result['user_id']}, booking={crm_result['booking_id']}")
            except Exception as crm_err:
                logger.warning(f"⚠️ CRM sync failed for order {order['order_id']}: {crm_err}")

            # Fire-and-forget Telegram notification via bot API
            asyncio.create_task(notify_order_via_bot_api(order))

            return {"status": "ok", "order": order}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/{restaurant_id}/orders/{order_id}/status")
    async def api_update_status(restaurant_id: str, order_id: str, body: UpdateStatusRequest):
        """Update order status (NEW -> PAID -> DONE | CANCELLED) and sync to CRM."""
        try:
            order = update_status(
                restaurant_id=restaurant_id,
                order_id=order_id,
                new_status=body.status,
                data_path=data_path,
            )

            # Sync updated order to CRM
            try:
                crm_result = sync_order_to_crm(order, crm_path)
                logger.info(f"✅ Order status update synced to CRM: {order_id} → {body.status}")
            except Exception as crm_err:
                logger.warning(f"⚠️ CRM sync failed for order {order_id}: {crm_err}")

            return {"status": "ok", "order": order}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/{restaurant_id}/orders")
    async def api_list_orders(restaurant_id: str):
        """Return latest state for every order in this restaurant."""
        try:
            orders = get_latest_orders(restaurant_id, data_path)
            return {"orders": orders}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/{restaurant_id}/orders/{order_id}")
    async def api_get_order(restaurant_id: str, order_id: str):
        """Return the latest state of a single order."""
        try:
            order = get_order(restaurant_id, order_id, data_path)
            if order is None:
                raise HTTPException(status_code=404, detail="Order not found")
            return {"order": order}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ── Payment Sent flag ──────────────────────────────────────────────

    @router.post("/{restaurant_id}/orders/{order_id}/payment-sent")
    async def api_payment_sent(restaurant_id: str, order_id: str, body: PaymentSentRequest):
        """Client pressed 'Отправил' — mark order with payment_sent flag."""
        try:
            order = get_order(restaurant_id, order_id, data_path)
            if order is None:
                raise HTTPException(status_code=404, detail="Order not found")
            order["payment_sent"] = body.payment_sent
            order["payment_sent_at"] = __import__("datetime").datetime.now().isoformat()
            save_order_event(order, data_path)
            logger.info(f"✅ Payment sent flag set for order {order_id}")
            return {"status": "ok", "order": order}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ── Dashboard Auth ─────────────────────────────────────────────────

    @router.get("/dashboard/auth")
    async def api_dashboard_auth(token: str = ""):
        """
        Authenticate restaurant dashboard by dashboard_token.
        Returns restaurant_id and restaurant config if token is valid.
        """
        if not token:
            raise HTTPException(status_code=400, detail="Token is required")

        restaurants_dir = Path(data_path) / "restaurants"
        if not restaurants_dir.exists():
            raise HTTPException(status_code=404, detail="No restaurants found")

        for rest_dir in restaurants_dir.iterdir():
            if not rest_dir.is_dir():
                continue
            config_file = rest_dir / "config.json"
            if not config_file.exists():
                continue
            try:
                with open(config_file, "r", encoding="utf-8") as f:
                    config = json.load(f)
                if config.get("dashboard_token") == token:
                    return {
                        "status": "ok",
                        "restaurant_id": config.get("restaurant_id", rest_dir.name),
                        "restaurant_name": config.get("name", rest_dir.name),
                        "restaurant_config": config,
                    }
            except Exception:
                continue

        raise HTTPException(status_code=401, detail="Invalid dashboard token")

    # ── Dashboard: all orders for a restaurant (with config) ───────────

    @router.get("/dashboard/{restaurant_id}/orders")
    async def api_dashboard_orders(restaurant_id: str):
        """
        Get all orders for a restaurant with restaurant config.
        Used by restaurant dashboard.
        """
        try:
            orders = get_latest_orders(restaurant_id, data_path)
            # Load restaurant config
            config_file = Path(data_path) / "restaurants" / restaurant_id / "config.json"
            restaurant_config = {}
            if config_file.exists():
                try:
                    with open(config_file, "r", encoding="utf-8") as f:
                        restaurant_config = json.load(f)
                except Exception:
                    pass
            return {
                "status": "ok",
                "orders": orders,
                "restaurant": restaurant_config,
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ── Dashboard: all orders across all restaurants (admin) ───────────

    @router.get("/dashboard/admin/orders")
    async def api_admin_dashboard_orders():
        """
        Get all orders across all restaurants. For admin dashboard.
        """
        try:
            restaurants_dir = Path(data_path) / "restaurants"
            all_orders = []
            restaurant_configs = {}

            if restaurants_dir.exists():
                for rest_dir in restaurants_dir.iterdir():
                    if not rest_dir.is_dir():
                        continue
                    rest_id = rest_dir.name
                    # Load orders
                    orders = get_latest_orders(rest_id, data_path)
                    for order in orders:
                        order["restaurant_id"] = rest_id
                    all_orders.extend(orders)
                    # Load config
                    config_file = rest_dir / "config.json"
                    if config_file.exists():
                        try:
                            with open(config_file, "r", encoding="utf-8") as f:
                                restaurant_configs[rest_id] = json.load(f)
                        except Exception:
                            pass

            # Sort by created_at descending
            all_orders.sort(key=lambda o: o.get("created_at", ""), reverse=True)

            return {
                "status": "ok",
                "orders": all_orders,
                "restaurants": restaurant_configs,
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ── CRM Adapter Endpoints ──────────────────────────────────────────

    @router.get("/crm/bookings")
    async def api_crm_bookings():
        """
        CRM endpoint: return all food orders as CRM-compatible bookings.
        Scans all restaurants/*/orders.jsonl files.
        """
        try:
            bookings = get_all_food_orders_as_bookings(crm_path)
            return {"status": "ok", "bookings": bookings, "count": len(bookings)}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return router
