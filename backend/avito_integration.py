#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
AvitoCRMIntegration — связывает Авито-сообщения с существующей CRM системой.

Использует:
- avito_client.py — для работы с Avito Messenger API
- web_integration.py — для логирования, статусов диалогов, CRM данных
- Claude AI — для генерации ответов (тот же промпт что и для Telegram)

Поток данных (прямая интеграция, без n8n):
1. Авито отправляет вебхук напрямую на /api/avito/webhook (порт 5005)
2. Этот модуль обрабатывает сообщение:
   - Парсит payload
   - Находит/создаёт пользователя в CRM
   - Проверяет статус бота
   - Если бот включён → Claude AI → ответ в Авито
   - Если бот выключен → уведомление менеджеру
   - Логирует в chat_logs.jsonl и crm_history.jsonl
   - Обновляет статус диалога
   - Отправляет уведомление в Telegram группу

Токен Авито обновляется автоматически каждые 23 часа (фоновая задача в web_integration.py).
Вебхук регистрируется через POST /api/avito/register-webhook.
"""

import os
import json
import time
import logging
import threading
import requests
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List

from dotenv import load_dotenv

load_dotenv()
ANTHROPIC_API_KEY=os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
CLAUDE_MODEL=os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")

logger = logging.getLogger(__name__)

# Импортируем AvitoClient
try:
    from avito_client import AvitoClient, AvitoClientError
except ImportError as e:
    logger.warning(f"⚠️ avito_client imports failed: {e}")

# Claude AI
try:
    import anthropic
    CLAUDE_AVAILABLE = True
except ImportError:
    CLAUDE_AVAILABLE = False
    logger.warning("⚠️ Anthropic SDK not available for Avito bot")

# Ленивый импорт функций из web_integration (избегаем циклического импорта)
def _get_dialog_status_func():
    """Ленивый импорт get_dialog_status из web_integration"""
    try:
        from web_integration import get_dialog_status
        return get_dialog_status
    except ImportError:
        return None

def _update_dialog_status_func():
    """Ленивый импорт update_dialog_status из web_integration"""
    try:
        from web_integration import update_dialog_status
        return update_dialog_status
    except ImportError:
        return None


class AvitoCRMIntegration:
    """
    Интеграция Авито мессенджера с CRM системой.

    Обеспечивает:
    - Приём и обработку входящих сообщений
    - Генерацию ответов через Claude AI
    - Логирование всех сообщений в CRM
    - Управление ботом (вкл/выкл/пауза)
    - Уведомления менеджеру в Telegram
    """

    def __init__(self, data_path: str = "./data"):
        self.data_path = Path(data_path)
        self.data_path.mkdir(parents=True, exist_ok=True)

        # Файлы CRM
        self.user_data_file = self.data_path / "user_data.json"
        self.chat_logs_file = self.data_path / "chat_logs.jsonl"
        self.crm_history_file = self.data_path / "crm_history.jsonl"

        # Avito клиент
        self.avito = AvitoClient(
            redis_host=os.getenv("REDIS_HOST"),
            redis_port=int(os.getenv("REDIS_PORT", "6379")),
            redis_password=os.getenv("REDIS_PASSWORD"),
        )

        # Claude клиент — используем прямой HTTP вызов (как в web_integration.py)
        # SDK anthropic.Anthropic() может ломаться с некоторыми версиями,
        # прямой requests.post надёжнее
        self.claude_client = None
        if ANTHROPIC_API_KEY:
            self.claude_client = True  # флаг: API ключ доступен
            logger.info(f"✅ Claude API ready for Avito integration (model={CLAUDE_MODEL})")
        else:
            logger.warning("⚠️ No ANTHROPIC_API_KEY or CLAUDE_API_KEY — Avito bot disabled")

        # Загружаем промпт
        self.system_prompt = self._load_prompt()

        # Кэш диалогов (avito_user_id -> conversation history)
        self._conversations: Dict[str, List[dict]] = {}
        self._conv_lock = threading.Lock()

        # Дедупликация вебхуков: message_id → timestamp
        # Авито может присылать один и тот же вебхук несколько раз
        self._processed_messages: Dict[str, float] = {}
        self._processed_lock = threading.Lock()
        self._DEDUP_TTL = 300  # 5 минут — время жизни записи дедупликации

        # Telegram бот для уведомлений
        self._tg_bot = None

    def set_telegram_bot(self, bot):
        """Установить Telegram бота для отправки уведомлений"""
        self._tg_bot = bot
        logger.info("✅ Telegram bot set for Avito notifications")

    # ── Prompt Loading ────────────────────────────────────────────────

    def _load_prompt(self) -> str:
        """Загрузить системный промпт из prompts.yaml (avito_prompt приоритет)"""
        try:
            import yaml
            prompt_file = Path(__file__).parent / "prompts.yaml"
            with open(prompt_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
                # Приоритет: avito_prompt для контекста металлической мебели
                prompt = data.get("avito_prompt", "")
                if prompt:
                    logger.info("✅ Avito prompt loaded from prompts.yaml (avito_prompt)")
                    return prompt
                # Fallback на main_prompt
                prompt = data.get("main_prompt", "")
                if prompt:
                    logger.info("✅ Avito prompt loaded from prompts.yaml (main_prompt fallback)")
                    return prompt
        except Exception as e:
            logger.warning(f"⚠️ Failed to load prompts.yaml: {e}")

        # Fallback промпт
        return self._default_prompt()

    def _default_prompt(self) -> str:
        """Дефолтный промпт для магазина металлической мебели"""
        return """Ты — AI помощник магазина металлической мебели «Avarage Roaster».
Клиент написал тебе в чат Авито по объявлению.

Отвечай как живой человек, расслабленно и дружелюбно. Используй эмодзи умеренно.

Правила:
- Будь конкретным — называй цены, размеры, сроки
- Предлагай 2-3 варианта, не больше
- Уточняй назначение если клиент не указал
- Если не знаешь точный ответ — скажи что уточнишь
- Не пиши длинные сообщения — 3-4 предложения максимум
- Всегда предлагай задать вопросы"""

    # ── Inventory Context ────────────────────────────────────────────────

    def _get_inventory_context(self) -> str:
        """
        Загрузить данные о товарах из inventory.json и сформировать
        текстовый контекст для Claude.
        """
        try:
            inventory_file = self.data_path / "inventory.json"
            if not inventory_file.exists():
                return ""

            with open(inventory_file, "r", encoding="utf-8") as f:
                items = json.load(f)

            if not items:
                return ""

            context = "\n\nДОСТУПНЫЕ ТОВАРЫ:\n"
            for item in items:
                name = item.get("name", "Без названия")
                item_class = item.get("class", "")
                class_name = {
                    "grill": "Мангалы",
                    "dog_cage": "Вольеры",
                    "garden_furniture": "Садовая мебель",
                    "table_and_base": "Столы и подстолья",
                    "shelf": "Стеллажи",
                    "stove": "Печи под казан",
                    "computer_table": "Компьютерные столы",
                }.get(item_class, item_class)

                price = item.get("price", "")
                price_str = f"{price}₽" if price else "Цена по запросу"

                context += f"\n{name} ({class_name}) — {price_str}\n"

                # Атрибуты товара
                attributes = item.get("attributes", {})
                if attributes:
                    attr_parts = []
                    for key, val in attributes.items():
                        if val:
                            attr_parts.append(f"{key}: {val}")
                    if attr_parts:
                        context += f"  Характеристики: {', '.join(attr_parts)}\n"

                # Описание
                description = item.get("description", "")
                if description:
                    context += f"  Описание: {description[:200]}\n"

                # Доступность
                available = item.get("available", True)
                if not available:
                    context += "  ⚠️ НЕТ В НАЛИЧИИ\n"

            return context

        except Exception as e:
            logger.warning(f"⚠️ Failed to load inventory context: {e}")
            return ""

    # ── User Management ────────────────────────────────────────────────

    def _find_or_create_avito_lead(self, chat_id: str, author_id: int, item_id: int = 0, username: str = "") -> dict:
        """
        Найти или создать лид Авито в CRM по chat_id.
        
        Каждый уникальный chat_id = отдельный лид в CRM.
        author_id — ID клиента (того, кто написал), сохраняется для контекста.
        item_id — ID объявления Авито, сохраняется для контекста.

        Returns:
            Запись пользователя из user_data.json
        """
        crm_user_id = AvitoClient.make_avito_chat_crm_id(chat_id)
        users = self._load_users()

        # Ищем существующий лид по chat_id
        for user in users:
            if str(user.get("user_id")) == crm_user_id:
                # Обновляем метаданные если нужно
                user["updated_at"] = datetime.now().isoformat()
                if author_id and not user.get("avito_author_id"):
                    user["avito_author_id"] = author_id
                if item_id and not user.get("avito_item_id"):
                    user["avito_item_id"] = item_id
                self._save_users(users)
                return user

        # Создаём новый лид — статус NEW, source=avito
        now = datetime.now().isoformat()
        new_user = {
            "user_id": crm_user_id,
            "username": username or f"Avito chat {chat_id[:12]}",
            "source": "avito",
            "avito_chat_id": chat_id,
            "avito_author_id": author_id,       # ID клиента, который написал
            "avito_item_id": item_id,            # ID объявления
            "status": "new",
            "car_interested": None,
            "category_interested": None,
            "created_at": now,
            "updated_at": now,
            "pickup_location": None,
            "marker": None,
            "notes": [],
            "last_note": None,
            "has_active_booking": False,
            "archived": False,
            "dialog": {
                "active": True,
                "has_new_messages": True,
                "last_message_at": now,
                "last_message_from": "client",
                "message_count": 0,
                "claude_status": "stopped",  # Бот выключен по умолчанию
            },
        }

        users.append(new_user)
        self._save_users(users)
        logger.info(f"✅ Created new Avito lead in CRM: {crm_user_id} (chat={chat_id[:12]}, author={author_id}, item={item_id})")
        return new_user

    def _load_users(self) -> list:
        """Загрузить пользователей из user_data.json"""
        if not self.user_data_file.exists():
            return []
        try:
            with open(self.user_data_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except (json.JSONDecodeError, IOError):
            return []

    def _save_users(self, users: list) -> None:
        """Сохранить пользователей в user_data.json"""
        self.user_data_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.user_data_file, "w", encoding="utf-8") as f:
            json.dump(users, f, ensure_ascii=False, indent=2)

    # ── Main Message Handler ──────────────────────────────────────────

    async def handle_webhook(self, webhook_data: dict) -> dict:
        """
        Обработка входящего вебхука от Авито (приходит напрямую на порт 5005).

        Args:
            webhook_data: Сырой JSON от Авито

        Returns:
            Результат обработки
        """
        # Парсим payload
        parsed = AvitoClient.parse_webhook_payload(webhook_data)
        event_type = parsed["event_type"]
        chat_id = parsed["chat_id"]
        user_id = parsed["user_id"]          # ID владельца аккаунта (наш)
        author_id = parsed.get("author_id", 0)  # ID клиента, который написал
        item_id = parsed.get("item_id", 0)      # ID объявления Авито
        text = parsed["text"]
        is_our_message = parsed["is_our_message"]
        message_id = parsed.get("message_id", "")

        # ── Отладка: выводим полный payload и результат парсинга ──
        logger.info(f"🔍 Avito PARSED: event={event_type}, chat={chat_id[:8] if chat_id else 'NONE'}, user_id={user_id}(owner), author_id={author_id}(client), item_id={item_id}, is_our={is_our_message}, text={repr(text[:50]) if text else 'NONE'}, msg_id={message_id}")

        # ── Дедупликация: Авито может присылать один вебхук дважды ──
        if message_id and not is_our_message:
            dedup_key = f"{chat_id}:{message_id}"
            now = time.time()
            with self._processed_lock:
                # Очистка старых записей (старше _DEDUP_TTL)
                expired = [k for k, t in self._processed_messages.items() if now - t > self._DEDUP_TTL]
                for k in expired:
                    del self._processed_messages[k]

                if dedup_key in self._processed_messages:
                    logger.info(f"⏭️ Avito webhook DUPLICATE skipped: chat={chat_id[:8]}, msg={message_id}")
                    return {"status": "ok", "action": "duplicate_skipped", "message_id": message_id}

                self._processed_messages[dedup_key] = now

        logger.info(f"📩 Avito webhook: event={event_type}, chat={chat_id[:8] if chat_id else 'NONE'}, owner={user_id}, author={author_id}(client), item={item_id}, our={is_our_message}, msg={message_id}")

        # Находим/создаём лид по chat_id (каждый чат = отдельный лид)
        user = self._find_or_create_avito_lead(
            chat_id=chat_id,
            author_id=author_id,
            item_id=item_id,
            username="",
        )
        crm_user_id = user["user_id"]

        # Логируем входящее сообщение от клиента в chat_logs
        # (наши исходящие уже залогированы при отправке через send_manager_message / AI response)
        if text and not is_our_message:
            self._log_chat_message(
                user_id=crm_user_id,
                role="user",
                content=text,
            )

        # Логируем событие в crm_history
        if is_our_message:
            self._log_crm_event(
                user_id=crm_user_id,
                action="bot_message_sent" if user.get("dialog", {}).get("claude_status") == "active" else "manager_message_sent",
                data={"text_preview": (text or "")[:100], "chat_id": chat_id},
            )
        else:
            self._log_crm_event(
                user_id=crm_user_id,
                action="user_message_received",
                data={"text_preview": (text or "")[:100], "chat_id": chat_id},
            )

        # Обновляем статус диалога
        try:
            _update_dialog_status_func()(
                user_id=crm_user_id,
                has_new_messages=not is_our_message,
                last_message_from="manager" if is_our_message else "client",
                last_message_at=datetime.now().isoformat(),
                message_count_increment=1,
            )
        except Exception as e:
            logger.warning(f"⚠️ Failed to update dialog status: {e}")

        # Если это наше сообщение — ничего больше не делаем
        if is_our_message:
            return {"status": "ok", "action": "logged_only", "is_our_message": True}

        # Если нет текста (например, событие прочтения) — только логируем
        if not text:
            return {"status": "ok", "action": "no_text", "is_our_message": False}

        # Отправляем уведомление менеджеру
        await self._notify_manager(crm_user_id, text, chat_id)

        # Проверяем статус бота
        dialog = user.get("dialog", {})
        claude_status = dialog.get("claude_status", "stopped")

        if claude_status == "active":
            # Бот включён — генерируем ответ через Claude
            response = await self._generate_ai_response(crm_user_id, text)
            if response:
                # Отправляем ответ в Авито
                try:
                    await self.avito.send_message(chat_id, response)
                    logger.info(f"✅ AI response sent to Avito chat {chat_id[:8]}")
                except AvitoClientError as e:
                    logger.error(f"❌ Failed to send AI response to Avito: {e}")
                    # Уведомляем менеджера что ответ сгенерирован, но не доставлен
                    await self._notify_manager_action_needed(
                        crm_user_id, text, chat_id,
                        f"❌ Ответ Claude сгенерирован, но не доставлен в Авито: {str(e)[:100]}"
                    )
                    return {"status": "error", "action": "send_failed", "error": str(e)}

                # Логируем ответ бота
                self._log_chat_message(crm_user_id, "assistant", response)
                self._log_crm_event(crm_user_id, "claude_response", {
                    "response_preview": response[:100],
                    "chat_id": chat_id,
                })

                # Обновляем счётчик сообщений
                try:
                    _update_dialog_status_func()(
                        user_id=crm_user_id,
                        message_count_increment=1,
                        last_message_from="assistant",
                        last_message_at=datetime.now().isoformat(),
                    )
                except Exception:
                    pass

                return {"status": "ok", "action": "ai_responded", "response_preview": response[:100]}

            else:
                # Claude не смог ответить — менеджер получит уведомление из _generate_ai_response
                logger.warning(f"⚠️ Claude failed to respond for Avito user {crm_user_id}, manager notified")
                self._log_crm_event(crm_user_id, "claude_failed", {
                    "reason": "API error or no key",
                    "chat_id": chat_id,
                })
                return {"status": "ok", "action": "claude_failed", "claude_status": "active"}

        elif claude_status == "paused":
            # Бот на паузе — уведомляем что менеджер должен ответить
            await self._notify_manager_action_needed(crm_user_id, text, chat_id, "Бот на паузе — ответите вручную")
            return {"status": "ok", "action": "bot_paused", "claude_status": "paused"}

        else:
            # Бот выключен — уведомляем менеджера
            await self._notify_manager_action_needed(crm_user_id, text, chat_id, "Бот выключен — ответите вручную или включите бота")
            return {"status": "ok", "action": "bot_stopped", "claude_status": "stopped"}

    # ── AI Response Generation ────────────────────────────────────────

    def _build_system_prompt_with_context(self) -> str:
        """Собрать системный промпт с контекстом товаров"""
        inventory_context = self._get_inventory_context()
        if inventory_context:
            return self.system_prompt + inventory_context
        return self.system_prompt

    async def _generate_ai_response(self, user_id: str, user_message: str) -> Optional[str]:
        """
        Генерация ответа через Claude AI.

        Использует прямой HTTP вызов к Anthropic API (как в web_integration.py),
        а не SDK — это надёжнее и совместимо с разными версиями.
        Промпт из prompts.yaml (avito_prompt) + контекст товаров.
        Поддерживает контекст диалога.
        """
        if not self.claude_client:
            logger.error("❌ Claude API key not configured for Avito integration")
            return None

        # Получаем историю диалога
        with self._conv_lock:
            history = self._conversations.get(user_id, [])

        # Добавляем сообщение пользователя
        history.append({"role": "user", "content": user_message})

        # Ограничиваем историю до последних 20 сообщений
        if len(history) > 20:
            history = history[-20:]

        # Собираем системный промпт с контекстом товаров
        system_prompt = self._build_system_prompt_with_context()

        # Определяем max_tokens: первое сообщение короче
        is_first_message = len(history) <= 1
        max_tokens = 300 if is_first_message else 1000

        try:
            # Прямой HTTP вызов к Anthropic API (как в web_integration.py)
            headers = {
                "x-api-key": ANTHROPIC_API_KEY,
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01",
            }

            data = {
                "model": CLAUDE_MODEL,
                "max_tokens": max_tokens,
                "system": system_prompt,
                "messages": history,
            }

            logger.info(f"🤖 Calling Claude API for Avito user {user_id} (first={is_first_message}, max_tokens={max_tokens})...")

            response = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=data,
                timeout=30,
            )
            response.raise_for_status()
            result = response.json()

            ai_text = result["content"][0]["text"].strip()

            # Убираем ** (markdown bold) — Авито не рендерит markdown
            ai_text = ai_text.replace('**', '')

            # Добавляем ответ в историю
            history.append({"role": "assistant", "content": ai_text})

            # Сохраняем историю
            with self._conv_lock:
                self._conversations[user_id] = history

            logger.info(f"🤖 Claude response for Avito user {user_id}: {ai_text[:80]}...")
            return ai_text

        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code if e.response else 0
            error_text = e.response.text[:300] if e.response else str(e)
            logger.error(f"❌ Claude API HTTP error for Avito user {user_id}: {status_code} - {error_text}")

            # Уведомляем менеджера об ошибке
            if status_code == 401:
                await self._notify_manager_action_needed(
                    user_id, user_message, "",
                    f"⚠️ Ошибка авторизации Claude API (401). Проверьте ANTHROPIC_API_KEY в .env"
                )
            elif status_code == 429:
                await self._notify_manager_action_needed(
                    user_id, user_message, "",
                    f"⚠️ Превышен лимит запросов Claude (429). Ответьте клиенту вручную"
                )
            else:
                await self._notify_manager_action_needed(
                    user_id, user_message, "",
                    f"⚠️ Ошибка Claude API ({status_code}). Ответьте клиенту вручную"
                )
            return None

        except Exception as e:
            logger.error(f"❌ Claude API error for Avito user {user_id}: {e}")
            await self._notify_manager_action_needed(
                user_id, user_message, "",
                f"⚠️ Ошибка Claude: {str(e)[:100]}. Ответьте клиенту вручную"
            )
            return None

    # ── Start with Greeting (CRM → START button) ──────────────────────

    async def start_with_greeting(self, avito_user_id: str) -> dict:
        """
        Запуск Claude с приветственным сообщением (при нажатии START в CRM).

        1. Устанавливает статус active
        2. Генерирует приветственное сообщение через Claude
        3. Отправляет его в чат Авито
        4. Логирует

        Returns:
            Результат операции
        """
        crm_user_id = avito_user_id
        if not AvitoClient.is_avito_user_id(avito_user_id):
            crm_user_id = AvitoClient.make_avito_user_id(int(avito_user_id))

        try:
            # 1. Обновляем статус
            _update_dialog_status_func()(
                user_id=crm_user_id,
                claude_status="active",
            )

            # 2. Логируем событие
            self._log_crm_event(crm_user_id, "claude_started", {
                "by": "manager",
                "source": "crm_start_button",
            })

            # 3. Генерируем приветственное сообщение
            greeting_prompt = (
                "Начни диалог с клиентом. Это первое сообщение — клиент ещё ничего не писал. "
                "Поздоровайся и спроси, что его интересует. "
                "Пиши коротко, 2-3 предложения."
            )

            # Инициализируем историю если нет
            with self._conv_lock:
                if crm_user_id not in self._conversations:
                    self._conversations[crm_user_id] = []

            greeting = await self._generate_ai_response(crm_user_id, greeting_prompt)

            if not greeting:
                logger.warning(f"⚠️ Failed to generate greeting for {crm_user_id}")
                return {"status": "ok", "claude_status": "active", "greeting_sent": False}

            # 4. Отправляем в Авито
            users = self._load_users()
            user = None
            for u in users:
                if str(u.get("user_id")) == str(crm_user_id):
                    user = u
                    break

            chat_id = user.get("avito_chat_id", "") if user else ""

            if chat_id:
                try:
                    await self.avito.send_message(chat_id, greeting)
                    logger.info(f"✅ Greeting sent to Avito chat {chat_id[:8]}")
                except AvitoClientError as e:
                    logger.error(f"❌ Failed to send greeting to Avito: {e}")
                    return {"status": "ok", "claude_status": "active", "greeting_sent": False, "error": str(e)}

                # Логируем ответ бота
                self._log_chat_message(crm_user_id, "assistant", greeting)
                self._log_crm_event(crm_user_id, "claude_greeting_sent", {
                    "greeting_preview": greeting[:100],
                    "chat_id": chat_id,
                })

                # Обновляем счётчик
                try:
                    _update_dialog_status_func()(
                        user_id=crm_user_id,
                        message_count_increment=1,
                        last_message_from="assistant",
                        last_message_at=datetime.now().isoformat(),
                    )
                except Exception:
                    pass
            else:
                logger.warning(f"⚠️ No chat_id for Avito user {crm_user_id}, greeting not sent")

            return {
                "status": "ok",
                "claude_status": "active",
                "greeting_sent": bool(chat_id),
                "greeting_text": greeting if greeting else None,
                "greeting_preview": greeting[:100] if greeting else None,
            }

        except Exception as e:
            logger.error(f"❌ Failed to start with greeting for {crm_user_id}: {e}")
            return {"status": "error", "message": str(e)}

    # ── Send Claude Message (CRM chat → Claude → Avito) ──────────────

    async def send_claude_message(self, avito_user_id: str, message: str) -> dict:
        """
        Отправка сообщения через Claude из CRM чата.

        Менеджер пишет в чат CRM → сообщение идёт в Claude →
        ответ Claude отправляется в Авито.

        Args:
            avito_user_id: ID пользователя Авито (с префиксом avito_)
            message: Текст сообщения от менеджера (инструкция для Claude)

        Returns:
            Результат с ответом Claude
        """
        crm_user_id = avito_user_id
        if not AvitoClient.is_avito_user_id(avito_user_id):
            crm_user_id = AvitoClient.make_avito_user_id(int(avito_user_id))

        try:
            # Проверяем что бот активен
            users = self._load_users()
            user = None
            for u in users:
                if str(u.get("user_id")) == str(crm_user_id):
                    user = u
                    break

            dialog = user.get("dialog", {}) if user else {}
            claude_status = dialog.get("claude_status", "stopped")

            if claude_status != "active":
                return {"status": "error", "message": f"Claude is not active (status: {claude_status})"}

            # Генерируем ответ через Claude
            ai_response = await self._generate_ai_response(crm_user_id, message)

            if not ai_response:
                return {"status": "error", "message": "Failed to generate AI response"}

            # Отправляем в Авито
            chat_id = user.get("avito_chat_id", "") if user else ""
            if chat_id:
                try:
                    await self.avito.send_message(chat_id, ai_response)
                    logger.info(f"✅ Claude message sent to Avito chat {chat_id[:8]}")
                except AvitoClientError as e:
                    logger.error(f"❌ Failed to send Claude message to Avito: {e}")
                    return {"status": "error", "message": f"Failed to send to Avito: {str(e)}"}

                # Логируем
                self._log_chat_message(crm_user_id, "assistant", ai_response)
                self._log_crm_event(crm_user_id, "claude_message_sent", {
                    "response_preview": ai_response[:100],
                    "chat_id": chat_id,
                })

                # Обновляем счётчик
                try:
                    _update_dialog_status_func()(
                        user_id=crm_user_id,
                        message_count_increment=1,
                        last_message_from="assistant",
                        last_message_at=datetime.now().isoformat(),
                    )
                except Exception:
                    pass

            return {
                "status": "success",
                "response_text": ai_response,
                "delivered": bool(chat_id),
            }

        except Exception as e:
            logger.error(f"❌ Failed to send Claude message for {crm_user_id}: {e}")
            return {"status": "error", "message": str(e)}

    # ── Bot Control ────────────────────────────────────────────────────

    async def control_bot(self, avito_user_id: str, action: str) -> dict:
        """
        Управление ботом для конкретного пользователя Авито.

        Args:
            avito_user_id: ID пользователя Авито (с префиксом avito_)
            action: start | stop | pause | resume

        Returns:
            Результат операции
        """
        crm_user_id = avito_user_id
        if not AvitoClient.is_avito_user_id(avito_user_id):
            crm_user_id = AvitoClient.make_avito_user_id(int(avito_user_id))

        # Маппинг действий на статусы
        action_to_status = {
            "start": "active",
            "stop": "stopped",
            "pause": "paused",
            "resume": "active",
        }

        if action not in action_to_status:
            return {"status": "error", "message": f"Unknown action: {action}"}

        new_status = action_to_status[action]

        try:
            _update_dialog_status_func()(
                user_id=crm_user_id,
                claude_status=new_status,
            )

            # Логируем событие
            event_name = f"claude_{action}ed" if action in ("start", "stop") else f"dialog_{action}d"
            self._log_crm_event(crm_user_id, event_name, {
                "by": "manager",
                "source": "crm_api",
                "new_status": new_status,
            })

            # Очищаем историю диалога при stop
            if action == "stop":
                with self._conv_lock:
                    self._conversations.pop(crm_user_id, None)

            logger.info(f"✅ Avito bot {action} for user {crm_user_id}")
            return {"status": "ok", "claude_status": new_status, "action": action}

        except Exception as e:
            logger.error(f"❌ Failed to control Avito bot: {e}")
            return {"status": "error", "message": str(e)}

    # ── Manager Messaging ──────────────────────────────────────────────

    async def send_manager_message(self, avito_user_id: str, text: str) -> dict:
        """
        Отправка сообщения менеджером через CRM UI.

        Args:
            avito_user_id: ID пользователя Авито (с префиксом avito_)
            text: Текст сообщения

        Returns:
            Результат отправки
        """
        # Находим пользователя в CRM
        users = self._load_users()
        user = None
        for u in users:
            if str(u.get("user_id")) == str(avito_user_id):
                user = u
                break

        if not user:
            return {"status": "error", "message": "User not found"}

        chat_id = user.get("avito_chat_id", "")
        if not chat_id:
            return {"status": "error", "message": "No Avito chat_id for user"}

        try:
            # Отправляем через Avito API
            await self.avito.send_message(chat_id, text)

            # Логируем (роль "manager" — для корректного отображения в CRMPage)
            self._log_chat_message(avito_user_id, "manager", text)
            self._log_crm_event(avito_user_id, "manager_message_sent", {
                "message_length": len(text),
                "chat_id": chat_id,
            })

            try:
                _update_dialog_status_func()(
                    user_id=avito_user_id,
                    message_count_increment=1,
                    last_message_from="manager",
                    last_message_at=datetime.now().isoformat(),
                )
            except Exception:
                pass

            return {"status": "ok", "action": "message_sent"}

        except AvitoClientError as e:
            logger.error(f"❌ Failed to send manager message to Avito: {e}")
            return {"status": "error", "message": str(e)}

    # ── Notifications ─────────────────────────────────────────────────

    async def _notify_manager(self, user_id: str, text: str, chat_id: str):
        """Отправить уведомление о новом сообщении в Telegram группу"""
        if not self._tg_bot:
            return

        group_id = os.getenv("ACTIVE_DIALOGS_CHAT_ID")
        if not group_id:
            return

        try:
            msg = (
                f"📩 <b>Новое сообщение Авито</b>\n"
                f"👤 Пользователь: {user_id}\n"
                f"💬 Сообщение: {text[:200]}\n"
                f"🕐 {datetime.now().strftime('%H:%M')}"
            )
            self._tg_bot.send_message(group_id, msg, parse_mode="HTML")
        except Exception as e:
            logger.warning(f"⚠️ Failed to send TG notification: {e}")

    async def _notify_manager_action_needed(self, user_id: str, text: str, chat_id: str, reason: str):
        """Уведомление менеджеру что нужно ответить вручную"""
        if not self._tg_bot:
            return

        group_id = os.getenv("ACTIVE_DIALOGS_CHAT_ID")
        if not group_id:
            return

        try:
            msg = (
                f"⚠️ <b>Требуется ответ — Авито</b>\n"
                f"👤 Пользователь: {user_id}\n"
                f"💬 Сообщение: {text[:200]}\n"
                f"📋 Причина: {reason}\n"
                f"🕐 {datetime.now().strftime('%H:%M')}"
            )
            self._tg_bot.send_message(group_id, msg, parse_mode="HTML")
        except Exception as e:
            logger.warning(f"⚠️ Failed to send TG notification: {e}")

    # ── Logging Helpers ────────────────────────────────────────────────

    def _log_chat_message(self, user_id: str, role: str, content: str):
        """Логирование сообщения в chat_logs.jsonl (формат совместимый с CRMPage)"""
        try:
            entry = {
                "timestamp": datetime.now().isoformat(),
                "user_id": user_id,
                "role": role,
                "text": content,
                "content": {"text": content},
                "source": "avito",
            }
            self.chat_logs_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.chat_logs_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.warning(f"⚠️ Failed to log chat message: {e}")

    def _log_crm_event(self, user_id: str, action: str, data: dict = None):
        """Логирование события в crm_history.jsonl"""
        try:
            entry = {
                "timestamp": datetime.now().isoformat(),
                "user_id": user_id,
                "action": action,
                "data": data or {},
                "source": "avito",
            }
            self.crm_history_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.crm_history_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.warning(f"⚠️ Failed to log CRM event: {e}")

    # ── Status & Info ──────────────────────────────────────────────────

    async def get_dialog_info(self, avito_user_id: str) -> dict:
        """Получить полную информацию о диалоге с пользователем Авито"""
        crm_user_id = avito_user_id
        # Поддержка обоих форматов: avito_chat_xxx (новый) и avito_123 (старый)
        if not AvitoClient.is_avito_user_id(avito_user_id):
            # Если передан чистый ID — пробуем как старый формат
            try:
                crm_user_id = AvitoClient.make_avito_user_id(int(avito_user_id))
            except (ValueError, TypeError):
                crm_user_id = avito_user_id

        try:
            _get_dialog_status = _get_dialog_status_func()
            if _get_dialog_status:
                dialog_status = _get_dialog_status(crm_user_id)
            else:
                dialog_status = {}
            users = self._load_users()
            user = None
            for u in users:
                if str(u.get("user_id")) == str(crm_user_id):
                    user = u
                    break

            return {
                "user_id": crm_user_id,
                "source": "avito",
                "avito_author_id": user.get("avito_author_id") if user else None,
                "avito_chat_id": user.get("avito_chat_id") if user else None,
                "avito_item_id": user.get("avito_item_id") if user else None,
                "dialog": dialog_status,
                "username": user.get("username", "") if user else "",
            }
        except Exception as e:
            logger.error(f"❌ Failed to get dialog info: {e}")
            return {"user_id": crm_user_id, "error": str(e)}

    async def sync_chats(self, chats_limit: int = 10, messages_limit: int = 20) -> dict:
        """
        Синхронизация чатов с Авито: загружает последние чаты и сообщения из API
        и сохраняет их в CRM (user_data.json, chat_logs.jsonl).

        Args:
            chats_limit: Сколько последних чатов загрузить (default: 10)
            messages_limit: Сколько последних сообщений загрузить на чат (default: 20)

        Returns:
            Сводка о синхронизации: {"synced_chats": N, "synced_messages": M, "errors": [...]}
        """
        logger.info(f"🔄 Starting Avito chats sync (chats_limit={chats_limit}, messages_limit={messages_limit})")

        result = {
            "synced_chats": 0,
            "synced_messages": 0,
            "new_leads": 0,
            "errors": [],
        }

        try:
            # 1. Получаем список чатов из Avito API
            chats = await self.avito.get_chats(limit=chats_limit)
            logger.info(f"📋 Got {len(chats)} chats from Avito API")

            if not chats:
                logger.info("ℹ️ No Avito chats found")
                return result

            # Загружаем существующие логи для дедупликации
            existing_log_ids = self._load_existing_log_ids()

            for chat_data in chats:
                chat_id = chat_data.get("id", "")
                if not chat_id:
                    continue

                try:
                    # 2. Извлекаем информацию о чате
                    users_list = chat_data.get("users", [])
                    context = chat_data.get("context", {})
                    context_value = context.get("value", {})
                    item_id = context_value.get("id", 0)
                    item_title = context_value.get("title", "")
                    price_string = context_value.get("price_string", "")

                    # Определяем author_id (клиента) — это пользователь, не являющийся владельцем аккаунта
                    author_id = 0
                    username = ""
                    for u in users_list:
                        uid = u.get("id", 0)
                        if str(uid) != str(self.avito.account_id):
                            author_id = uid
                            username = u.get("name", f"Avito user {uid}")

                    # 3. Находим или создаём лид в CRM
                    crm_user_id = AvitoClient.make_avito_chat_crm_id(chat_id)
                    users = self._load_users()
                    existing_user = None
                    for u in users:
                        if str(u.get("user_id")) == crm_user_id:
                            existing_user = u
                            break

                    if not existing_user:
                        # Создаём новый лид
                        now = datetime.now().isoformat()
                        new_user = {
                            "user_id": crm_user_id,
                            "username": username or f"Avito chat {chat_id[:12]}",
                            "source": "avito",
                            "avito_chat_id": chat_id,
                            "avito_author_id": author_id,
                            "avito_item_id": item_id,
                            "avito_item_title": item_title,
                            "avito_item_price": price_string,
                            "status": "new",
                            "car_interested": item_title or None,
                            "category_interested": None,
                            "created_at": now,
                            "updated_at": now,
                            "pickup_location": None,
                            "marker": None,
                            "notes": [],
                            "last_note": None,
                            "has_active_booking": False,
                            "archived": False,
                            "dialog": {
                                "active": True,
                                "has_new_messages": False,
                                "last_message_at": now,
                                "last_message_from": "client",
                                "message_count": 0,
                                "claude_status": "stopped",
                            },
                        }
                        users.append(new_user)
                        self._save_users(users)
                        result["new_leads"] += 1
                        logger.info(f"✅ New Avito lead created: {crm_user_id} (chat={chat_id[:12]})")
                    else:
                        # Обновляем метаданные существующего лида
                        existing_user["updated_at"] = datetime.now().isoformat()
                        if author_id and not existing_user.get("avito_author_id"):
                            existing_user["avito_author_id"] = author_id
                        if item_id and not existing_user.get("avito_item_id"):
                            existing_user["avito_item_id"] = item_id
                        if item_title and not existing_user.get("avito_item_title"):
                            existing_user["avito_item_title"] = item_title
                        if price_string and not existing_user.get("avito_item_price"):
                            existing_user["avito_item_price"] = price_string
                        if username and existing_user.get("username", "").startswith("Avito chat "):
                            existing_user["username"] = username
                        self._save_users(users)

                    # 4. Загружаем сообщения из чата
                    messages = []
                    try:
                        messages = await self.avito.get_chat_messages(
                            chat_id=chat_id,
                            limit=messages_limit,
                        )
                    except Exception as msg_err:
                        err_str = str(msg_err)
                        logger.warning(f"⚠️ Failed to get messages for chat {chat_id[:8]}: {msg_err}")
                        result["errors"].append(f"chat {chat_id[:8]}: {err_str[:100]}")

                        # Fallback: используем last_message из данных чата при ошибке 402
                        if "402" in err_str:
                            last_msg = chat_data.get("last_message", {})
                            if last_msg:
                                last_msg_id = last_msg.get("id", f"last_{chat_id[:8]}")
                                last_msg_type = last_msg.get("type", "text")
                                last_msg_content = last_msg.get("content", {})
                                last_msg_text = last_msg_content.get("text", "")
                                last_msg_direction = last_msg.get("direction", "in")
                                last_msg_created = last_msg.get("created", 0)

                                if last_msg_type not in ("system", "deleted") and (last_msg_text or last_msg_type != "text"):
                                    # Формируем текст
                                    fallback_text = last_msg_text
                                    if last_msg_type == "image" and not last_msg_text:
                                        fallback_text = "[Изображение]"
                                    elif last_msg_type == "link":
                                        link_data = last_msg_content.get("link", {})
                                        fallback_text = link_data.get("text", "") or link_data.get("url", "[Ссылка]")
                                    elif last_msg_type == "location":
                                        loc_data = last_msg_content.get("location", {})
                                        fallback_text = loc_data.get("title", "") or loc_data.get("text", "[Геолокация]")
                                    elif last_msg_type == "call":
                                        fallback_text = "[Звонок]"
                                    elif last_msg_type == "voice":
                                        fallback_text = "[Голосовое сообщение]"

                                    if fallback_text:
                                        role = "assistant" if last_msg_direction == "out" else "user"
                                        dedup_key = f"{crm_user_id}:{last_msg_id}"
                                        if dedup_key not in existing_log_ids:
                                            try:
                                                msg_time = datetime.fromtimestamp(last_msg_created).isoformat() if last_msg_created else datetime.now().isoformat()
                                            except (OSError, ValueError):
                                                msg_time = datetime.now().isoformat()
                                            self._log_chat_message_with_time(
                                                user_id=crm_user_id,
                                                role=role,
                                                content=fallback_text,
                                                timestamp=msg_time,
                                                msg_id=last_msg_id,
                                            )
                                            logger.info(f"📋 Fallback: logged last_message for chat {chat_id[:8]} (402)")

                    # 5. Логируем сообщения в chat_logs.jsonl (с дедупликацией)
                    synced_in_chat = 0
                    for msg in messages:
                        msg_id = msg.get("id", "")
                        if not msg_id:
                            continue

                        # Дедупликация по message_id
                        dedup_key = f"{crm_user_id}:{msg_id}"
                        if dedup_key in existing_log_ids:
                            continue

                        # Определяем роль и текст
                        direction = msg.get("direction", "in")
                        msg_type = msg.get("type", "text")
                        content = msg.get("content", {})
                        text = content.get("text", "")
                        created_ts = msg.get("created", 0)

                        # Пропускаем системные и удалённые
                        if msg_type in ("system", "deleted"):
                            continue

                        role = "assistant" if direction == "out" else "user"

                        # Формируем текст для лога
                        log_text = text
                        if msg_type == "image" and not text:
                            log_text = "[Изображение]"
                        elif msg_type == "link":
                            link_data = content.get("link", {})
                            log_text = link_data.get("text", "") or link_data.get("url", "[Ссылка]")
                        elif msg_type == "location":
                            loc_data = content.get("location", {})
                            log_text = loc_data.get("title", "") or loc_data.get("text", "[Геолокация]")
                        elif msg_type == "call":
                            log_text = "[Звонок]"
                        elif msg_type == "voice":
                            log_text = "[Голосовое сообщение]"

                        if not log_text:
                            continue

                        # Формируем timestamp из unix
                        if created_ts:
                            try:
                                msg_time = datetime.fromtimestamp(created_ts).isoformat()
                            except (OSError, ValueError):
                                msg_time = datetime.now().isoformat()
                        else:
                            msg_time = datetime.now().isoformat()

                        self._log_chat_message_with_time(
                            user_id=crm_user_id,
                            role=role,
                            content=log_text,
                            timestamp=msg_time,
                            msg_id=msg_id,
                        )
                        synced_in_chat += 1

                    result["synced_messages"] += synced_in_chat
                    result["synced_chats"] += 1
                    logger.info(f"✅ Synced chat {chat_id[:8]}: {synced_in_chat} new messages")

                except Exception as chat_err:
                    logger.error(f"❌ Error syncing chat {chat_id[:8] if chat_id else 'UNKNOWN'}: {chat_err}")
                    result["errors"].append(f"chat {chat_id[:8] if chat_id else 'UNKNOWN'}: {str(chat_err)[:100]}")

            logger.info(f"🔄 Avito sync complete: {result['synced_chats']} chats, {result['synced_messages']} messages, {result['new_leads']} new leads")

        except Exception as e:
            logger.error(f"❌ Avito sync failed: {e}")
            result["errors"].append(f"global: {str(e)[:200]}")

        return result

    def _load_existing_log_ids(self) -> set:
        """Загрузить множество существующих message_id из chat_logs.jsonl для дедупликации"""
        existing_ids = set()
        try:
            if not self.chat_logs_file.exists():
                return existing_ids
            with open(self.chat_logs_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        msg_id = entry.get("msg_id", "")
                        user_id = entry.get("user_id", "")
                        if msg_id:
                            existing_ids.add(f"{user_id}:{msg_id}")
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            logger.warning(f"⚠️ Failed to load existing log IDs: {e}")
        return existing_ids

    def _log_chat_message_with_time(self, user_id: str, role: str, content: str, timestamp: str, msg_id: str = ""):
        """Логирование сообщения в chat_logs.jsonl с указанным timestamp и msg_id (для синхронизации)"""
        try:
            entry = {
                "timestamp": timestamp,
                "user_id": user_id,
                "role": role,
                "text": content,
                "content": {"text": content},
                "source": "avito",
            }
            if msg_id:
                entry["msg_id"] = msg_id
            self.chat_logs_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.chat_logs_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.warning(f"⚠️ Failed to log chat message: {e}")

    async def get_all_avito_dialogs(self) -> list:
        """Получить список всех диалогов Авито"""
        users = self._load_users()
        avito_dialogs = []

        for user in users:
            if user.get("source") == "avito" or AvitoClient.is_avito_user_id(str(user.get("user_id", ""))):
                dialog = user.get("dialog", {})
                avito_dialogs.append({
                    "user_id": user["user_id"],
                    "username": user.get("username", ""),
                    "avito_chat_id": user.get("avito_chat_id", ""),
                    "dialog": dialog,
                    "has_new_messages": dialog.get("has_new_messages", False),
                    "claude_status": dialog.get("claude_status", "stopped"),
                })

        # Сортируем по новым сообщениям и времени
        avito_dialogs.sort(
            key=lambda x: (x.get("has_new_messages", False), x.get("dialog", {}).get("last_message_at", "")),
            reverse=True,
        )

        return avito_dialogs
