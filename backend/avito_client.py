#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
AvitoClient — клиент для работы с Avito Messenger API.

Отвечает за:
- Получение и обновление access_token (через Redis или напрямую)
- Отправку сообщений в чаты Авито
- Получение истории сообщений
- Пометку сообщений как прочитанные
- Регистрацию/удаление вебхуков
"""

import os
import json
import time
import logging
import requests
from typing import Optional, Dict, Any, List
from datetime import datetime

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class AvitoClientError(Exception):
    """Базовая ошибка клиента Авито"""
    pass


class AvitoAuthError(AvitoClientError):
    """Ошибка авторизации"""
    pass


class AvitoAPIError(AvitoClientError):
    """Ошибка API Авито"""

    def __init__(self, message: str, status_code: int = 0, response: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response or {}


class AvitoClient:
    """
    Клиент для работы с Avito Messenger API.

    Токен хранится в Redis (обновляется автоматически каждые 23ч)
    или запрашивается напрямую при отсутствии Redis.
    """

    BASE_URL = "https://api.avito.ru"
    TOKEN_URL = "https://api.avito.ru/token"
    MESSENGER_URL = "https://api.avito.ru/messenger/v1"
    MESSENGER_V2_URL = "https://api.avito.ru/messenger/v2"
    MESSENGER_V3_URL = "https://api.avito.ru/messenger/v3"

    # Ключи Redis
    REDIS_TOKEN_KEY = "avito_access_token"
    REDIS_TOKEN_TTL = 86400  # 24 часа

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        redis_host: Optional[str] = None,
        redis_port: int = 6379,
        redis_db: int = 0,
        redis_password: Optional[str] = None,
    ):
        self.client_id = client_id or os.getenv("AVITO_CLIENT_ID", "")
        self.client_secret = client_secret or os.getenv("AVITO_CLIENT_SECRET", "")
        self.account_id = os.getenv("AVITO_ACCOUNT_ID", "")

        # Redis для хранения токена
        self._redis = None
        if REDIS_AVAILABLE and redis_host:
            try:
                self._redis = redis.Redis(
                    host=redis_host,
                    port=redis_port,
                    db=redis_db,
                    password=redis_password,
                    decode_responses=True,
                )
                self._redis.ping()
                logger.info("✅ Redis connected for Avito token storage")
            except Exception as e:
                logger.warning(f"⚠️ Redis connection failed: {e}, using in-memory token")
                self._redis = None

        # Fallback: in-memory token cache
        self._token_cache: Dict[str, Any] = {"token": None, "expires_at": 0}

    # ── Token Management ──────────────────────────────────────────────

    async def get_access_token(self) -> str:
        """
        Получить access_token из Redis или запросить новый.

        Фоновая задача в web_integration.py обновляет токен каждые 23 часа и кладёт в Redis.
        Если Redis недоступен — запрашиваем напрямую.
        """
        # 1. Попробовать Redis
        if self._redis:
            try:
                token = self._redis.get(self.REDIS_TOKEN_KEY)
                if token:
                    logger.debug("🔑 Avito token from Redis")
                    return token
            except Exception as e:
                logger.warning(f"⚠️ Redis read error: {e}")

        # 2. Попробовать in-memory кэш
        if self._token_cache["token"] and self._token_cache["expires_at"] > time.time():
            logger.debug("🔑 Avito token from cache")
            return self._token_cache["token"]

        # 3. Запросить новый токен
        return await self._request_new_token()

    async def _request_new_token(self) -> str:
        """Запросить новый access_token у Авито API"""
        if not self.client_id or not self.client_secret:
            raise AvitoAuthError("AVITO_CLIENT_ID and AVITO_CLIENT_SECRET are required")

        logger.info("🔄 Requesting new Avito access token...")

        try:
            response = requests.post(
                self.TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30,
            )

            if response.status_code != 200:
                raise AvitoAuthError(
                    f"Token request failed: {response.status_code} - {response.text}"
                )

            data = response.json()
            token = data.get("access_token")
            expires_in = data.get("expires_in", 86400)

            if not token:
                raise AvitoAuthError("No access_token in response")

            # Сохранить в Redis
            if self._redis:
                try:
                    self._redis.setex(
                        self.REDIS_TOKEN_KEY,
                        int(expires_in - 3600),  # На час меньше
                        token,
                    )
                    logger.info("✅ Avito token saved to Redis")
                except Exception as e:
                    logger.warning(f"⚠️ Redis write error: {e}")

            # Сохранить в кэш
            self._token_cache = {
                "token": token,
                "expires_at": time.time() + expires_in - 3600,
            }

            logger.info("✅ New Avito access token obtained")
            return token

        except requests.RequestException as e:
            raise AvitoAuthError(f"Token request error: {e}")

    def set_access_token(self, token: str, ttl: int = 86400) -> None:
        """
        Установить токен извне (например, через API или вручную для отладки).

        Args:
            token: Avito access_token
            ttl: Время жизни в секундах (default: 24h)
        """
        # Сохранить в Redis
        if self._redis:
            try:
                self._redis.setex(self.REDIS_TOKEN_KEY, ttl, token)
                logger.info("✅ Avito token set in Redis via set_access_token()")
            except Exception as e:
                logger.warning(f"⚠️ Redis write error: {e}")

        # Сохранить в кэш
        self._token_cache = {
            "token": token,
            "expires_at": time.time() + ttl,
        }

    # ── HTTP Helper ───────────────────────────────────────────────────

    async def _api_request(
        self,
        method: str,
        url: str,
        data: Optional[dict] = None,
        params: Optional[dict] = None,
        retry_on_auth: bool = True,
    ) -> dict:
        """Базовый метод для API запросов с авторизацией"""
        token = await self.get_access_token()

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        try:
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                json=data,
                params=params,
                timeout=30,
            )

            # Если токен истёк — обновить и повторить
            if response.status_code == 401 and retry_on_auth:
                logger.info("🔄 Token expired, refreshing...")
                self._token_cache["token"] = None  # Сбросить кэш
                if self._redis:
                    try:
                        self._redis.delete(self.REDIS_TOKEN_KEY)
                    except Exception:
                        pass
                return await self._api_request(method, url, data, params, retry_on_auth=False)

            if response.status_code >= 400:
                error_text = response.text[:500]
                logger.error(f"❌ Avito API error: {response.status_code} - {error_text}")
                raise AvitoAPIError(
                    f"API error: {response.status_code}",
                    status_code=response.status_code,
                    response={"text": error_text},
                )

            return response.json()

        except requests.RequestException as e:
            raise AvitoAPIError(f"Request error: {e}")

    # ── Messenger API ─────────────────────────────────────────────────

    async def send_message(self, chat_id: str, text: str) -> dict:
        """
        Отправить текстовое сообщение в чат Авито.

        Args:
            chat_id: UUID чата Авито
            text: Текст сообщения

        Returns:
            Ответ API Авито
        """
        url = f"{self.MESSENGER_URL}/accounts/{self.account_id}/chats/{chat_id}/messages"

        data = {
            "message": {"text": text},
            "type": "text",
        }

        logger.info(f"📤 Sending Avito message to chat {chat_id[:8]}...")
        result = await self._api_request("POST", url, data=data)
        logger.info(f"✅ Avito message sent to chat {chat_id[:8]}")
        return result

    async def get_chat_messages(
        self,
        chat_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[dict]:
        """
        Получить историю сообщений чата.

        Args:
            chat_id: UUID чата Авито
            limit: Количество сообщений
            offset: Смещение

        Returns:
            Список сообщений
        """
        url = f"{self.MESSENGER_V3_URL}/accounts/{self.account_id}/chats/{chat_id}/messages/"

        params = {"limit": limit, "offset": offset}

        result = await self._api_request("GET", url, params=params)
        return result.get("messages", [])

    async def get_chats(
        self,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
    ) -> List[dict]:
        """
        Получить список чатов.

        Args:
            limit: Количество чатов
            offset: Смещение
            unread_only: Только с непрочитанными

        Returns:
            Список чатов
        """
        url = f"{self.MESSENGER_V2_URL}/accounts/{self.account_id}/chats"

        params = {"limit": limit, "offset": offset}
        if unread_only:
            params["unread_only"] = "true"

        result = await self._api_request("GET", url, params=params)
        return result.get("chats", [])

    async def mark_as_read(self, chat_id: str) -> dict:
        """
        Пометить чат как прочитанный.

        Согласно документации Avito, метод POST /messenger/v1/accounts/{user_id}/chats/{chat_id}/read
        помечает весь чат прочитанным (не конкретное сообщение).

        Args:
            chat_id: UUID чата
        """
        url = f"{self.MESSENGER_URL}/accounts/{self.account_id}/chats/{chat_id}/read"

        return await self._api_request("POST", url)

    # ── Webhook Management ─────────────────────────────────────────────

    async def register_webhook(self, webhook_url: str) -> dict:
        """
        Зарегистрировать URL для получения вебхуков.

        Args:
            webhook_url: URL для получения уведомлений
        """
        url = f"{self.MESSENGER_V3_URL}/webhook"

        data = {"url": webhook_url}

        logger.info(f"🔗 Registering Avito webhook: {webhook_url}")
        result = await self._api_request("POST", url, data=data)
        logger.info(f"✅ Avito webhook registered")
        return result

    async def delete_webhook(self, webhook_url: Optional[str] = None) -> dict:
        """
        Отключить уведомления (webhook).

        Согласно документации Avito, используется POST /messenger/v1/webhook/unsubscribe
        с телом {"url": "..."}.

        Args:
            webhook_url: URL вебхука для отключения. Если не указан,
                         сначала запрашивается из подписок.
        """
        if not webhook_url:
            # Получаем текущие подписки, чтобы узнать URL
            subs = await self.get_webhook_info()
            subscriptions = subs.get("subscriptions", [])
            if not subscriptions:
                logger.info("ℹ️ No active Avito webhooks to delete")
                return {"ok": True}
            # Удаляем все подписки
            results = []
            for sub in subscriptions:
                url_str = sub.get("url", "")
                if url_str:
                    url = f"{self.MESSENGER_URL}/webhook/unsubscribe"
                    data = {"url": url_str}
                    logger.info(f"🔗 Unsubscribing Avito webhook: {url_str}")
                    result = await self._api_request("POST", url, data=data)
                    results.append(result)
            logger.info("✅ Avito webhooks unsubscribed")
            return {"ok": True, "results": results}

        url = f"{self.MESSENGER_URL}/webhook/unsubscribe"
        data = {"url": webhook_url}
        logger.info(f"🔗 Unsubscribing Avito webhook: {webhook_url}")
        result = await self._api_request("POST", url, data=data)
        logger.info("✅ Avito webhook unsubscribed")
        return result

    async def get_webhook_info(self) -> dict:
        """
        Получить список подписок (webhooks).

        Согласно документации Avito, используется POST /messenger/v1/subscriptions.
        Возвращает {"subscriptions": [{"url": "...", "version": "3"}, ...]}.
        """
        url = f"{self.MESSENGER_URL}/subscriptions"

        return await self._api_request("POST", url)

    # ── Utility Methods ────────────────────────────────────────────────

    @staticmethod
    def parse_webhook_payload(data: dict) -> Dict[str, Any]:
        """
        Разобрать payload вебхука Авито в удобный формат.

        Args:
            data: Сырой JSON от Авито вебхука

        Returns:
            Структурированные данные:
            {
                "event_type": "message_received" | "message_read" | ...,
                "chat_id": "uuid",
                "user_id": 123456,
                "author_id": 123456,
                "text": "Привет",
                "message_id": "msg_id",
                "created_at": "ISO timestamp",
                "is_our_message": False,
            }
        """
        payload = data.get("payload", {})
        value = payload.get("value", {})

        event_type = data.get("event", "")
        chat_id = value.get("chat_id", "")
        user_id = value.get("user_id", 0)
        author_id = value.get("author_id", 0)
        item_id = value.get("item_id", 0)
        content = value.get("content", {})
        text = content.get("text", "")
        message_id = value.get("id", "")
        created_at = value.get("created", "")

        # Определяем, наше ли это сообщение (author_id = наш account_id)
        is_our_message = str(author_id) == str(os.getenv("AVITO_ACCOUNT_ID", ""))

        return {
            "event_type": event_type,
            "chat_id": chat_id,
            "user_id": user_id,
            "author_id": author_id,
            "item_id": item_id,
            "text": text,
            "message_id": message_id,
            "created_at": created_at,
            "is_our_message": is_our_message,
            "raw": data,
        }

    @staticmethod
    def make_avito_user_id(avito_user_id: int) -> str:
        """Создать уникальный ID для CRM из Avito user_id (устаревший, для обратной совместимости)"""
        return f"avito_{avito_user_id}"

    @staticmethod
    def make_avito_chat_crm_id(chat_id: str) -> str:
        """Создать уникальный CRM ID из Avito chat_id.
        
        Каждый chat_id = отдельный лид в CRM.
        Формат: avito_chat_{chat_id} (например avito_chat_u2u-123456-7890)
        """
        # Убираем возможные спецсимволы, оставляем безопасные
        safe_chat_id = chat_id.replace(" ", "_").replace("/", "_")
        return f"avito_chat_{safe_chat_id}"

    @staticmethod
    def is_avito_user_id(user_id: str) -> bool:
        """Проверить, является ли user_id пользователем Авито (старый или новый формат)"""
        uid = str(user_id)
        return uid.startswith("avito_")

    @staticmethod
    def is_avito_chat_crm_id(user_id: str) -> bool:
        """Проверить, является ли user_id CRM ID на основе chat_id (новый формат)"""
        return str(user_id).startswith("avito_chat_")
