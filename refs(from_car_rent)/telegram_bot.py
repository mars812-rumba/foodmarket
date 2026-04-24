print("!!!!!!!!!! TEST PRINT !!!!!!!!!!!")
from pathlib import Path
import os
import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, InputMediaVideo, InputMediaPhoto, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from fastapi import FastAPI, Request, HTTPException, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import threading
from dotenv import load_dotenv
import json
from datetime import datetime
import re
import uuid
import yaml
import threading
import time
import requests
from io import BytesIO
# Claude AI imports
try:
    import anthropic
    CLAUDE_AVAILABLE = True
except ImportError:
    CLAUDE_AVAILABLE = False
    print("⚠️ Anthropic SDK not available")

# Import our new modules
from user_tracker import UserTracker
from admin_commands import AdminCommands
import random

# Импорт функций для работы с диалогами
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from web_integration import update_dialog_status, get_dialog_status

# --- CONFIGURATION ---
load_dotenv()

GROUP_LINK = "https://t.me/carbook_in_phuket"

BOT_TOKEN = os.getenv("WEBAPP_BOT_TOKEN")
ADMIN_ID = os.getenv("ADMIN_ID")

# === НОВЫЕ ГРУППЫ ===
HOT_BOOKINGS_CHAT_ID = os.getenv("HOT_BOOKINGS_CHAT_ID")
WARM_LEADS_CHAT_ID = os.getenv("WARM_LEADS_CHAT_ID")
ACTIVE_DIALOGS_CHAT_ID = os.getenv("ACTIVE_DIALOGS_CHAT_ID")

# === WEBHOOK URL ДЛЯ УВЕДОМЛЕНИЙ ===
TG_WEBHOOK_URL = os.getenv("TG_WEBHOOK_URL", "http://localhost:5001")

URL_WEBAPP =  os.getenv("URL_WEBAPP")
KNOWN_USERS_FILE = "known_users.txt"
FOLLOWUP_DELAY = 20 * 60 * 60  # 24 hours
FOLLOWUP_LOG_FILE = "followup_responses.log"
VIDEO_FILE_ID = "BAACAgIAAxkBAAI4iGkmEWxPerhmNL7xcN49Xx9_zoGGAAK-hQACd2M5SfFLM5cWhjhhNgQ"

# Claude AI Configuration
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")

# Load prompts for compatibility
try:
    with open('prompts.yaml', 'r', encoding='utf-8') as f:
        prompts_data = yaml.safe_load(f)
        CLAUDE_SYSTEM_PROMPT = prompts_data.get("main_prompt", "You are a helpful assistant.")
except Exception as e:
    print(f"⚠️ Failed to load prompts: {e}")
    CLAUDE_SYSTEM_PROMPT = "You are a helpful assistant."

# Claude client initialization
claude_client = None
if CLAUDE_AVAILABLE and ANTHROPIC_API_KEY:
    try:
        claude_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        print("✅ Claude client initialized in telegram_bot")
    except Exception as e:
        print(f"⚠️ Failed to initialize Claude client: {e}")

LOGS_FILE = "data/chat_logs.jsonl"
BOOKINGS_FILE = "data/bookings.json"
# --- НОВЫЙ СПИСОК КОМАНД МЕНЮ ---

try:
    with open("knowledge_base.txt", "r") as f:
        KNOWLEDGE_BASE = f.read()
except FileNotFoundError:
    KNOWLEDGE_BASE = ""

try:
    CWD = os.path.dirname(os.path.realpath(__file__))
    CARS_JSON_PATH = os.path.join(CWD, "data/web_cars.json")
    with open(CARS_JSON_PATH, "r") as f:
        CAR_LIST_JSON = json.load(f)
except FileNotFoundError:
    print(f"!!!!!! CRITICAL: CAR_LIST_JSON NOT FOUND at {CARS_JSON_PATH}")
    CAR_LIST_JSON = {}

# --- INITIALIZATION ---
# ... (вверху, где ты определяешь CAR_LIST_JSON) ...
CARS_JSON_PATH = os.path.join(CWD, "data/web_cars.json")
CAR_LIST_JSON = {} # Инициализируем как пустой словарь


def reload_cars_json():
    """Перечитывает JSON с машинами из файла в память"""
    global CAR_LIST_JSON # Важно: мы меняем глобальную переменную
    try:
        with open(CARS_JSON_PATH, "r") as f:
            CAR_LIST_JSON = json.load(f)
        print(f"✅ C-JSON ОБНОВЛЕН: {len(CAR_LIST_JSON.get('cars', []))} машин.")
        return True
    except Exception as e:
        print(f"❌ CRITICAL: Ошибка перезагрузки C-JSON: {e}")
        return False

# --- INITIALIZATION ---
reload_cars_json() # <--- Вызови ее здесь при первом запуске
bot = telebot.TeleBot(BOT_TOKEN)

# FastAPI application setup
app = FastAPI(title="Telegram Bot API", description="FastAPI backend for Telegram bot")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
user_timers = {}
pending_bookings = {}
recent_webapp_entries = {}
tracker = UserTracker()

# Claude conversation management variables
user_conversations = {}  # {user_id: {"status": "active/paused/ended", "history": [], "filters": {}}}
user_sessions = {}       # {user_id: {"claude_initiated": bool, ...}}
user_filters_cache = {}  # {user_id: {days, category, startDate, endDate, ...}}
claude_init_timers = {}  # {user_id: timer}


# --- BOT MENU SETUP ---
from telebot.types import BotCommand

try:
    commands = [
        BotCommand("start", "🚗 Открыть каталог авто"),
        BotCommand("help", "ℹ️ Помощь и справка"),
        BotCommand("about", "👋 О сервисе Sunny Rentals"),
        BotCommand("restart", "🔄 Перезапустить бота"),
        BotCommand("menu", "📱 Показать меню команд"),
        BotCommand("getid", "🆔 Узнать ID чата")
    ]
    bot.set_my_commands(commands)
    print("✅ Bot Menu команды установлены успешно!")
except Exception as e:
    print(f"⚠️ Не удалось установить Bot Menu команды: {e}")

admin_cmds = AdminCommands(tracker)



# ==============================
# UTILITY FUNCTIONS
# ==============================

def is_admin_user(user_id):
    """Проверка на админа"""
    return str(user_id) == str(ADMIN_ID)

def safe_send_message(chat_id, text, **kwargs):
    """Безопасная отправка сообщения"""
    try:
        return bot.send_message(chat_id, text, **kwargs)
    except Exception as e:
        print(f"❌ Failed to send message to {chat_id}: {e}")
        return None


def get_admin_reply_keyboard():
    """Создает админ-клавиатуру с кнопками управления"""
    markup = ReplyKeyboardMarkup(resize_keyboard=True, row_width=3)
    
    # Верхний ряд - основные разделы
    btn_hot = KeyboardButton("🔥 Горячие")
    btn_warm = KeyboardButton("🌡️ Теплые")
    btn_crm = KeyboardButton("🔍 CRM")  # ← ИЗМЕНИЛИ
    
    # Средний ряд - управление
    btn_stats = KeyboardButton("📊 Статистика")
    btn_panel = KeyboardButton("💻 Флот-панель")
    btn_settings = KeyboardButton("⚙️ Управление")
    
    # Нижний ряд - дополнительно
    btn_books = KeyboardButton("📅 Календарь")
    btn_logs = KeyboardButton("📝 Логи")
    btn_back = KeyboardButton("👤 Обычный режим")
    
    markup.add(btn_hot, btn_warm, btn_stats)
    markup.add(btn_crm, btn_panel,btn_books )
    markup.add(btn_settings, btn_logs, btn_back)
    
    return markup




def load_bookings() -> list:
    if not os.path.exists(BOOKINGS_FILE):
        return []

    with open(BOOKINGS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("bookings.json must contain a list")

    return data

def save_bookings(bookings: list):
    if not isinstance(bookings, list):
        raise ValueError("save_bookings expects a list")

    with open(BOOKINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(
            bookings,
            f,
            ensure_ascii=False,
            indent=2
        )

def escape_html(text: str) -> str:
    """Replaces special characters with their HTML entities."""
    if not isinstance(text, str):
        text = str(text)
    return text.replace('&', '&').replace('<', '<').replace('>', '>')


def is_admin_user(user_id):
    """Проверяет, является ли пользователь админом"""
    return str(user_id) == ADMIN_ID

def is_date_overlap(start1, end1, start2, end2):
    try:
        s1 = datetime.fromisoformat(start1.replace('Z', '+00:00'))
        e1 = datetime.fromisoformat(end1.replace('Z', '+00:00'))
        s2 = datetime.fromisoformat(start2.replace('Z', '+00:00'))
        e2 = datetime.fromisoformat(end2.replace('Z', '+00:00'))
        return s1 <= e2 and s2 <= e1
    except Exception as e:
        print(f"Error in is_date_overlap: {e}")
        print(f"start1: {start1}, end1: {end1}, start2: {start2}, end2: {end2}")
        raise

# === БЕЗОПАСНАЯ ОТПРАВКА СООБЩЕНИЙ ===

def safe_send_message(chat_id, text, **kwargs):
    """Безопасная отправка сообщений с обработкой ошибок"""
    try:
        return bot.send_message(chat_id, text, **kwargs)
    except Exception as e:
        if "bot was blocked" in str(e).lower():
            print(f"⚠️ User {chat_id} blocked the bot")
            return None
        elif "chat not found" in str(e).lower():
            print(f"⚠️ Chat {chat_id} not found")
            return None
        elif "forbidden" in str(e).lower():
            print(f"⚠️ Bot doesn't have permission to message {chat_id}")
            return None
        else:
            print(f"❌ Error sending message to {chat_id}: {e}")
            raise e


def safe_send_photo(chat_id, photo, **kwargs):
    """Безопасная отправка фото с обработкой ошибок"""
    try:
        return bot.send_photo(chat_id, photo, **kwargs)
    except Exception as e:
        if "bot was blocked" in str(e).lower():
            print(f"⚠️ User {chat_id} blocked the bot")
            return None
        elif "chat not found" in str(e).lower():
            print(f"⚠️ Chat {chat_id} not found")
            return None
        elif "forbidden" in str(e).lower():
            print(f"⚠️ Bot doesn't have permission to message {chat_id}")
            return None
        else:
            print(f"❌ Error sending photo to {chat_id}: {e}")
            raise e


def safe_send_animation(chat_id, animation, **kwargs):
    """Безопасная отправка анимации с обработкой ошибок"""
    try:
        return bot.send_animation(chat_id, animation, **kwargs)
    except Exception as e:
        if "bot was blocked" in str(e).lower():
            print(f"⚠️ User {chat_id} blocked the bot")
            return None
        elif "chat not found" in str(e).lower():
            print(f"⚠️ Chat {chat_id} not found")
            return None
        elif "forbidden" in str(e).lower():
            print(f"⚠️ Bot doesn't have permission to message {chat_id}")
            return None
        else:
            print(f"❌ Error sending animation to {chat_id}: {e}")
            raise e


# === НОВЫЕ ФУНКЦИИ ДЛЯ ГРУПП ===


def send_dialog_to_group(user_id, action, details=""):
    """Отправляет информацию о диалоге в группу активных диалогов"""
    try:
        if not ACTIVE_DIALOGS_CHAT_ID:
            print("⚠️ ACTIVE_DIALOGS_CHAT_ID не настроен")
            return
        
        user_data = tracker.get_user(user_id)
        username = user_data.get('username') if user_data else None
        user_link = f"@{username}" if username else f'<a href="tg://user?id={user_id}">{user_id}</a>'
        
        action_emojis = {
            "started": "🟢 ДИАЛОГ СТАРТОВАЛ",
            "ended": "⚫ ДИАЛОГ ЗАВЕРШЕН", 
            "paused": "⏸️ ДИАЛОГ ПРИОСТАНОВЛЕН",
            "analysis": "📊 АНАЛИЗ ДИАЛОГА"
        }
        
        action_text = action_emojis.get(action, f"📝 {action.upper()}")
        
        message = (
            f"{action_text}\n\n"
            f"👤 Клиент: {user_link}\n"
            f"⏰ {datetime.now().strftime('%d.%m %H:%M')}\n"
        )
        
        if details:
            message += f"\n📝 {details}"
        
        if action == "started":
            filters = user_sessions.get(user_id, {}).get('filters', {})
            if filters:
                days = filters.get('days', '?')
                category = filters.get('category', 'все')
                message += f"\n🎯 Интерес: {category}, {days} дней"
        
        safe_send_message(ACTIVE_DIALOGS_CHAT_ID, message, parse_mode="HTML")
        print(f"✅ Отправлена информация о диалоге в группу")
        
    except Exception as e:
        print(f"❌ Ошибка отправки диалога в группу: {e}")


# ==============================
# ФУНКЦИИ ОБРАБОТКИ СОБЫТИЙ ДИАЛОГОВ
# ==============================

def handle_dialog_user_message(user_id: int, message_text: str):
    """Обработка сообщения от пользователя - обновляет статус диалога"""
    try:
        print(f"💬 Обработка сообщения от пользователя {user_id}")

        # Обновляем статус диалога
        update_dialog_status(
            user_id=user_id,
            has_new_messages=True,
            last_message_at=datetime.now().isoformat(),
            last_message_from="user",
            message_count_increment=1
        )

        # Логируем событие
        log_dialog_event(user_id, "message_received",
            content=message_text,
            timestamp=datetime.now().isoformat()
        )
        
        print(f"✅ Обновлен статус диалога для пользователя {user_id}")

    except Exception as e:
        print(f"❌ Ошибка обработки сообщения пользователя {user_id}: {e}")

def handle_dialog_manager_message(user_id: int, message_text: str):
    """Обработка сообщения от менеджера - обновляет статус диалога"""
    try:
        print(f"👨‍💼 Обработка сообщения менеджера для пользователя {user_id}")

        # Обновляем статус диалога
        update_dialog_status(
            user_id=user_id,
            last_message_at=datetime.now().isoformat(),
            last_message_from="manager",
            message_count_increment=1
        )

        # Логируем событие
        log_dialog_event(user_id, "message_sent", {
            "from": "manager",
            "content": message_text,
            "timestamp": datetime.now().isoformat()
        })

        print(f"✅ Обновлен статус диалога для менеджера {user_id}")

    except Exception as e:
        print(f"❌ Ошибка обработки сообщения менеджера {user_id}: {e}")

def handle_dialog_claude_message(user_id: int, response_text: str):
    """Обработка ответа от Claude - обновляет статус диалога"""
    try:
        print(f"🤖 Обработка ответа Claude для пользователя {user_id}")

        # Обновляем статус диалога
        update_dialog_status(
            user_id=user_id,
            last_message_at=datetime.now().isoformat(),
            last_message_from="claude",
            message_count_increment=1
        )

        # Логируем событие
        log_dialog_event(user_id, "claude_response", {
            "from": "claude",
            "content": response_text,
            "timestamp": datetime.now().isoformat()
        })

        print(f"✅ Обновлен статус диалога для Claude {user_id}")

    except Exception as e:
        print(f"❌ Ошибка обработки ответа Claude {user_id}: {e}")

def handle_claude_start(user_id: int):
    """Обработка запуска Claude - обновляет статус диалога"""
    try:
        print(f"🧠 Запуск Claude для пользователя {user_id}")

        # Обновляем статус диалога
        update_dialog_status(
            user_id=user_id,
            claude_status="active"
        )

        # Логируем событие
        log_dialog_event(user_id, "claude_started", {
            "initiated_by": "manager",
            "timestamp": datetime.now().isoformat()
        })

        print(f"✅ Запущен Claude для пользователя {user_id}")

    except Exception as e:
        print(f"❌ Ошибка запуска Claude {user_id}: {e}")

def handle_claude_pause(user_id: int):
    """Обработка паузы Claude - обновляет статус диалога"""
    try:
        print(f"⏸️ Пауза Claude для пользователя {user_id}")

        # Обновляем статус диалога
        update_dialog_status(
            user_id=user_id,
            claude_status="paused"
        )

        # Логируем событие
        log_dialog_event(user_id, "dialog_paused", {
            "reason": "manager_pause",
            "timestamp": datetime.now().isoformat()
        })

        print(f"✅ Claude приостановлен для пользователя {user_id}")

    except Exception as e:
        print(f"❌ Ошибка паузы Claude {user_id}: {e}")

def handle_claude_resume(user_id: int):
    """Обработка возобновления Claude - обновляет статус диалога"""
    try:
        print(f"▶️ Возобновление Claude для пользователя {user_id}")

        # Обновляем статус диалога
        update_dialog_status(
            user_id=user_id,
            claude_status="active"
        )

        # Логируем событие
        log_dialog_event(user_id, "dialog_resumed", {
            "initiated_by": "manager",
            "timestamp": datetime.now().isoformat()
        })

        print(f"✅ Claude возобновлен для пользователя {user_id}")

    except Exception as e:
        print(f"❌ Ошибка возобновления Claude {user_id}: {e}")

def handle_claude_stop(user_id: int):
    """Обработка остановки Claude - обновляет статус диалога"""
    try:
        print(f"⏹️ Остановка Claude для пользователя {user_id}")

        # Обновляем статус диалога
        update_dialog_status(
            user_id=user_id,
            active=False,
            claude_status="stopped"
        )

        # Логируем событие
        log_dialog_event(user_id, "dialog_stopped", {
            "reason": "manager_stop",
            "timestamp": datetime.now().isoformat()
        })

        print(f"✅ Claude остановлен для пользователя {user_id}")

    except Exception as e:
        print(f"❌ Ошибка остановки Claude {user_id}: {e}")


def log_chat_to_file(user_id, role, content):
    """Логирует сообщение в файл chat_logs.jsonl."""
    if not LOGS_FILE:
        print(f"⚠️ LOGS_FILE не определен. Логирование в файл отключено.")
        return
    try:
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "user_id": user_id,
            "role": role,  # "user" или "assistant"
            "content": content
        }
        # 'a' - append (добавление в конец файла)
        with open(LOGS_FILE, 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')
    except Exception as e:
        print(f"❌ CRITICAL: Не удалось записать лог в {LOGS_FILE}: {e}")


# ==============================
# CLAUDE DIALOG SYSTEM - ПОЛНЫЙ БЛОК
# ==============================

def log_dialog_event(*args, **kwargs):
    """
    Логирует событие диалога в crm_history.jsonl
    
    Всеядная функция - принимает любые аргументы
    """
    try:
        # Извлекаем user_id и action из позиционных аргументов
        user_id = args[0] if len(args) > 0 else None
        action = args[1] if len(args) > 1 else "unknown"
        
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "action": action,
            **kwargs
        }

        # Записываем в crm_history.jsonl
        history_file ="data/crm_history.jsonl"
        with open(history_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")

        print(f"📝 Dialog event logged: {action} for user {user_id}")
        return True

    except Exception as e:
        print(f"❌ Error logging dialog event: {e}")
        return False


def call_backend_api(endpoint, data=None, method="POST"):
    """Вызывает API эндпойнт бэкенда"""
    try:
        backend_url = "http://localhost:5000"
        url = f"{backend_url}{endpoint}"
        
        if method == "POST":
            response = requests.post(url, json=data, timeout=10)
        elif method == "GET":
            response = requests.get(url, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
            
        if response.status_code == 200:
            return response.json()
        else:
            print(f"⚠️ Backend API error {response.status_code}: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error calling backend API {endpoint}: {e}")
        return None

def initiate_claude_dialogue(user_id, user_filters=None):
    """Запускает диалог Claude через бэкенд API"""
    print(f"🤖 Initiating Claude dialogue for user {user_id} via backend API")
    
    try:
        # Вызываем API бэкенда для запуска Claude
        result = call_backend_api("/api/claude/start", {
            "user_id": user_id,
            "filters": user_filters or {}
        })
        
        if result and result.get("status") == "success":
            print(f"✅ Claude dialogue initiated via backend for user {user_id}")
            # Отправляем уведомление в группу диалогов
            send_dialog_to_group(user_id, "started", "Claude начал подбор вариантов")
        else:
            print(f"❌ Failed to initiate Claude via backend for user {user_id}")
            
    except Exception as e:
        print(f"❌ Error initiating Claude dialogue: {e}")
        import traceback
        traceback.print_exc()


def handle_claude_best_options(user_id):
    """Запрашивает лучшие варианты через бэкенд API"""
    print(f"🎯 Requesting Claude best options for {user_id} via backend API")
    
    try:
        result = call_backend_api("/api/claude/best_options", {
            "user_id": user_id
        })
        
        if result and result.get("status") == "success":
            print(f"✅ Claude best options requested via backend for {user_id}")
        else:
            print(f"❌ Failed to get Claude best options via backend for {user_id}")
            
    except Exception as e:
        print(f"❌ Error requesting Claude best options: {e}")



def process_claude_message(user_id, user_input):
    """Отправляет сообщение в Claude через бэкенд API"""
    print(f"🚀 Processing Claude message for {user_id} via backend API")
    
    try:
        result = call_backend_api("/api/claude/send_message", {
            "user_id": user_id,
            "message": user_input
        })
        
        if result and result.get("status") == "success":
            # Получаем ответ от Claude и отправляем пользователю
            response_text = result.get("response_text", "")
            photos = result.get("photos", [])
            
            # ОБНОВЛЯЕМ СТАТУС ДИАЛОГА ПРИ ОТВЕТЕ CLAUDE
            handle_dialog_claude_message(user_id, response_text)
            
            # Отправляем фото если есть
            if photos:
                for photo_path in photos[:6]:  # Лимит 6 фото
                    try:
                        full_path = os.path.join(CWD, "..", "public", "images_web", photo_path)
                        if os.path.exists(full_path):
                            with open(full_path, 'rb') as photo_file:
                                bot.send_chat_action(user_id, 'upload_photo')
                                safe_send_photo(user_id, photo_file)
                                time.sleep(0.5)
                    except Exception as e:
                        print(f"❌ Error sending photo {photo_path}: {e}")
            
            # Отправляем текст
            if response_text:
                bot.send_chat_action(user_id, 'typing')
                time.sleep(1)
                safe_send_message(user_id, response_text)
                
            print(f"✅ Claude message processed and sent to {user_id}")
        else:
            print(f"❌ Failed to process Claude message via backend for {user_id}")
            
    except Exception as e:
        print(f"❌ Error processing Claude message: {e}")
        safe_send_message(user_id, "Секунду, подвисло. Напиши ещё раз.")

# ==============================
# CALLBACK HANDLERS
# ==============================

@bot.callback_query_handler(func=lambda call: call.data.startswith("start_claude_"))
def handle_start_claude(call):
    """Обработчик кнопки 'Запустить Claude' из CRM"""
    try:
        user_id = int(call.data.split('_')[2])
        
        print(f"🔥 CALLBACK RECEIVED: start_claude_{user_id}")
        
        bot.answer_callback_query(call.id, "🧠 Запускаю Claude...")
        bot.edit_message_reply_markup(call.message.chat.id, call.message.message_id, reply_markup=None)
        
        # ✅ БЕРЁМ ФИЛЬТРЫ ИЗ КЭША (приоритет)
        filters = user_filters_cache.get(user_id, {})
        print(f"📊 Loaded filters from cache: {filters}")
        
        # Если в кэше пусто - пробуем из файла (fallback)
        if not filters or not filters.get('days'):
            print(f"⚠️ Cache empty, trying user_data.json...")
            try:
                user_data_file = "webapp/backend/data/user_data.json"
                if os.path.exists(user_data_file):
                    with open(user_data_file, "r", encoding="utf-8") as f:
                        user_data_list = json.load(f)
                    
                    for user_data in user_data_list:
                        if user_data.get('user_id') == user_id:
                            if user_data.get('car_interested'):
                                filters['category'] = user_data.get('car_interested', 'все')
                            
                            if user_data.get('dates_selected'):
                                dates = user_data['dates_selected']
                                filters['startDate'] = dates.get('start')
                                filters['endDate'] = dates.get('end')
                                filters['days'] = dates.get('days')
                            
                            print(f"📊 Loaded from file: {filters}")
                            break
            except Exception as e:
                print(f"⚠️ Error loading from file: {e}")
        
        # Дефолт если всё пусто
        if not filters or not filters.get('days'):
            filters = {'days': 7, 'category': 'все'}
            print(f"📊 Using default filters: {filters}")
        
        # ✅ ЗАПУСКАЕМ ДИАЛОГ CLAUDE
        print(f"🚀 Calling initiate_claude_dialogue({user_id}, {filters})")
        initiate_claude_dialogue(user_id, filters)
        
        # ОБНОВЛЯЕМ СТАТУС ДИАЛОГА
        handle_claude_start(user_id)
        
        bot.send_message(
            ADMIN_ID,
            f"🧠 <b>CLAUDE АКТИВИРОВАН</b>\n\n"
            f"👤 Клиент: {user_id}\n"
            f"🎯 Теплый лид переведен на Claude\n"
            f"📅 Фильтры: {filters}\n"
            f"⚡ Диалог запущен",
            parse_mode="HTML"
        )
        
        print(f"✅ Claude activated for warm lead {user_id}")
        
    except Exception as e:
        print(f"❌ Error starting Claude: {e}")
        import traceback
        traceback.print_exc()
        bot.answer_callback_query(call.id, "⚠️ Ошибка запуска Claude")


# ==============================
# КОНЕЦ БЛОКА CLAUDE
# ==============================

@bot.message_handler(commands=['getid'])
def debug_chat_id(message):
    if str(message.from_user.id) == ADMIN_ID:
        chat_info = f"""
📋 <b>Информация о чате:</b>
        
🆔 Chat ID: <code>{message.chat.id}</code>
👥 Тип: {message.chat.type}
📝 Название: {message.chat.title or 'Личные сообщения'}
        """
        safe_send_message(message.chat.id, chat_info, parse_mode="HTML")


# ==============================
# /START HANDLER - ЧИСТАЯ ВЕРСИЯ
# ==============================
@bot.message_handler(commands=['start'])
def handle_start(message):
    chat_id = message.chat.id
    user_id = message.from_user.id
    username = message.from_user.username

    # === АДМИН - показываем меню ===
    if is_admin_user(user_id):
        markup = get_admin_reply_keyboard()
        safe_send_message(
            chat_id,
            "🎛️ <b>АДМИН-РЕЖИМ SUNNY RENTALS</b>\n\nВыберите раздел:",
            reply_markup=markup,
            parse_mode="HTML"
        )
        return

    # === ОБЫЧНЫЙ ПОЛЬЗОВАТЕЛЬ - чистый чат ===

    # Удаляем команду /start
    try:
        bot.delete_message(chat_id, message.message_id)
    except:
        pass

    # Трекаем вход
    source = 'telegram_web'
    if ' ' in message.text:
        source = message.text.split(' ', 1)[1]
        
    text = (
        "👋 Привет! Добро пожаловать в <b>Sunny Rentals</b>\n\n"
        "🚗 Аренда авто на Пхукете\n"
        "💰 Прозрачные цены\n"
        "✅ Без скрытых платежей\n\n"
        "Нажми кнопку ниже чтобы выбрать машину:"
    )

    # Кнопка webapp (inline)
    markup = InlineKeyboardMarkup()
    markup.add(InlineKeyboardButton(
        "🚀 Открыть каталог",
        web_app=WebAppInfo(URL_WEBAPP)
    ))

    # Отправляем сообщение и сразу сохраняем его ID
    try:
        msg = safe_send_message(
            chat_id,
            text,
            reply_markup=markup,
            parse_mode="HTML"
        )

        # Авто-удаление клавиатуры (кнопки) через 90 секунд
        def remove_keyboard_after_delay():
            time.sleep(2*60)  # 14 минуты — можно 60 или 120
            try:
                bot.edit_message_reply_markup(
                    chat_id=chat_id,
                    message_id=msg.message_id,
                    reply_markup=InlineKeyboardMarkup()  # пустая клавиатура = кнопка исчезает
                )
                print(f"🗑️ Inline keyboard removed for {chat_id} after 90s")
            except Exception as e:
                print(f"⚠️ Не удалось убрать клавиатуру: {e}")

        threading.Thread(target=remove_keyboard_after_delay, daemon=True).start()

        # Опционально: полное удаление сообщения через 3 минуты (если хочешь супер-чистоту)
        def delete_message_later():
            time.sleep(2*60)
            try:
                bot.delete_message(chat_id, msg.message_id)
                bot.send_message(chat_id,"Отправьте любое сообщение для начала диалога с менеджером, либо нажмите /start  для повторного открытия каталога.")
            except:
                pass
        threading.Thread(target=delete_message_later, daemon=True).start()

    except Exception as e:
        print(f"Ошибка отправки стартового сообщения: {e}")

# === ХЭНДЛЕР ДЛЯ ПОЛУЧЕНИЯ ID ВИДЕО ===
@bot.message_handler(content_types=['video'])
def get_video_id(message):
    """Возвращает file_id отправленного видео"""
    if is_admin_user(message.from_user.id):
        video_id = message.video.file_id
        bot.reply_to(
            message,
            f"📹 Video File ID:\n\n<code>{video_id}</code>",
            parse_mode="HTML"
        )
        print(f"📹 Video ID: {video_id}")
    else:
        bot.reply_to(message, "⚠️ Эта функция доступна только администратору")


        # 1. Определяем корень проекта (поднимаемся на уровень выше из папки backend)
BASE_DIR = Path(__file__).resolve().parent.parent
MEDIA_ROOT = BASE_DIR / "backend" / "media"

# === НОВЫЕ ХЭНДЛЕРЫ ДЛЯ МУЛЬТИМЕДИА ===
@bot.message_handler(content_types=['photo'])
def handle_photo_message(message):
    """Обработка входящих фотографий от пользователей"""
    try:
        user_id = message.from_user.id
        chat_id = message.chat.id
        
        # Пропускаем админов (они не отправляют фото как клиенты)
        if is_admin_user(user_id):
            return
            
        print(f"📸 Получена фотография от пользователя {user_id}")
        
        # Получаем лучшее качество фото
        photo = message.photo[-1]  # Последний элемент - самое высокое разрешение
        file_id = photo.file_id
        file_size = photo.file_size
        
        # Создаем директорию для пользователя если не существует
        from pathlib import Path
        media_dir = Path("media") / str(user_id)
        media_dir.mkdir(parents=True, exist_ok=True)
        
        # Скачиваем файл
        file_info = bot.get_file(file_id)
        downloaded_file = bot.download_file(file_info.file_path)
        
        # Генерируем уникальное имя файла
       # 1. Генерируем уникальное имя файла
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = ".jpg" 
        filename = f"photo_{timestamp}{file_extension}"
        
        # 2. Формируем путь к папке (убираем 'incoming' для совместимости с веб-интерфейсом)
        # Файлы будут сохраняться прямо в: backend/media/{user_id}/
        user_media_dir = MEDIA_ROOT / str(user_id)
        user_media_dir.mkdir(parents=True, exist_ok=True)
        
        # 3. Соединяем путь папки с ИМЕНЕМ ФАЙЛА
        file_path = user_media_dir / filename

        # Сохраняем файл
        with open(file_path, 'wb') as new_file:
            new_file.write(downloaded_file)
        
        # Логируем медиа сообщение
        media_info = {
            "type": "received_media",
            "filename": filename,
            "content_type": "image/jpeg",
            "file_size": file_path.stat().st_size,
            "timestamp": datetime.now().isoformat(),
            "download_url": f"/api/crm/media/{user_id}/{filename}"
        }
        
        # Обновляем статус диалога
        handle_dialog_user_message(user_id, "[Фотография]")
        
        # Только webhook на бэкенд — бот максимально минимальный
        try:
            # Получаем username из message.from_user (доступно здесь)
            sender_username = message.from_user.username
            
            webhook_data = {
                "user_id": user_id,
                "media": media_info,
                "username": sender_username,
                "timestamp": datetime.now().isoformat()
            }
            response = requests.post("http://localhost:5000/api/internal/receive-media", json=webhook_data, timeout=5)
            if response.status_code == 200:
                print(f"✅ Media info sent to backend for user {user_id}")
            else:
                print(f"⚠️ Backend returned status {response.status_code}")
        except Exception as webhook_error:
            print(f"⚠️ Error sending media to backend: {webhook_error}")
        
        # Отправляем уведомление в группу активных диалогов
        if ACTIVE_DIALOGS_CHAT_ID:
            user_data = tracker.get_user(user_id)
            username = user_data.get('username') if user_data else None
            user_link = f"@{username}" if username else f'<a href="tg://user?id={user_id}">{user_id}</a>'
            
            safe_send_message(
                ACTIVE_DIALOGS_CHAT_ID,
                f"📸 <b>Фотография от {user_link}</b>\n\n"
                f"💾 Размер: {file_size:,} байт\n"
                f"📁 Сохранено: {filename}",
                parse_mode="HTML"
            )
        
        print(f"✅ Фотография сохранена: {file_path}")
        
    except Exception as e:
        print(f"❌ Ошибка обработки фотографии: {e}")
        import traceback
        traceback.print_exc()

@bot.message_handler(content_types=['document'])
def handle_document_message(message):
    """Обработка входящих документов от пользователей"""
    try:
        user_id = message.from_user.id
        
        # Пропускаем админов
        if is_admin_user(user_id):
            return
            
        print(f"📄 Получен документ от пользователя {user_id}")
        
        document = message.document
        file_id = document.file_id
        file_name = document.file_name
        file_size = document.file_size
        mime_type = document.mime_type
        
        # Проверяем тип файла
        allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
        if mime_type not in allowed_types:
            bot.reply_to(message, "❌ Поддерживаются только изображения (JPG, PNG) и PDF.")
            return

        # 1. Создаем правильную директорию (media/{user_id})
        user_incoming_dir = MEDIA_ROOT / str(user_id)
        user_incoming_dir.mkdir(parents=True, exist_ok=True)
        
        # 2. Генерируем безопасное имя
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = re.sub(r'[^\w\-_.]', '_', file_name)
        filename = f"doc_{timestamp}_{safe_name}"
        
        # 3. Полный путь к ФАЙЛУ
        file_path = user_incoming_dir / filename
        
        # Скачиваем файл
        file_info = bot.get_file(file_id)
        downloaded_file = bot.download_file(file_info.file_path)
        
        # Сохраняем файл
        with open(file_path, 'wb') as new_file:
            new_file.write(downloaded_file)
        
        # Подготовка данных для CRM/Бэкенда
        # Используем .relative_to(BASE_DIR) осторожно (убедитесь, что BASE_DIR - родитель)
        try:
            relative_path = str(file_path.relative_to(BASE_DIR))
        except ValueError:
            relative_path = str(file_path)

        media_info = {
            "type": "document",
            "file_id": file_id,
            "file_name": file_name,
            "file_path": relative_path,
            "file_size": file_size,
            "mime_type": mime_type,
            "filename": filename,
            "timestamp": datetime.now().isoformat(),
            "download_url": f"/api/crm/media/{user_id}/{filename}"
        }
        
        # Дальнейшая логика (уведомления и логирование)
        handle_dialog_user_message(user_id, f"[Документ: {file_name}]")
        log_chat_to_file(user_id, "user", {
            "content": f"[Документ: {file_name}]",
            "media": media_info
        })
        
        # Отправка в группу активных диалогов
        if ACTIVE_DIALOGS_CHAT_ID:
            user_data = tracker.get_user(user_id)
            username = user_data.get('username') if user_data else None
            user_link = f"@{username}" if username else f'ID: {user_id}'
            
            safe_send_message(
                ACTIVE_DIALOGS_CHAT_ID,
                f"📄 <b>Документ от {user_link}</b>\n\n"
                f"📎 Файл: {file_name}\n"
                f"📁 Путь: <code>incoming/{filename}</code>",
                parse_mode="HTML"
            )

        # Webhook на бэкенд
        requests.post("http://localhost:5000/api/internal/receive-media", 
                      json={"user_id": user_id, "media": media_info}, 
                      timeout=5)
        
        print(f"✅ Документ успешно сохранен: {file_path}")
        
    except Exception as e:
        print(f"❌ Ошибка обработки документа: {e}")
        traceback.print_exc()


def handle_booking_confirmation(call):
    """Обработка подтверждения/отклонения заявки"""
    try:
        parts = call.data.split('_')
        action = parts[0]  # approve или reject
        booking_id = '_'.join(parts[1:])  # остальное - это ID

        # Проверяем что заявка существует
        if booking_id not in pending_bookings:
            bot.answer_callback_query(call.id, "⚠️ Заявка уже обработана")
            print(f"⚠️ Booking {booking_id} not found in pending_bookings")
            return

        booking_info = pending_bookings[booking_id]
        user_id = booking_info.get('user_id', 'unknown')

        if action == 'approve':
            # ✅ В работе
            bot.answer_callback_query(call.id, "✅ Заявка в работе!")
            
            # Убираем кнопки
            try:
                bot.edit_message_reply_markup(
                    call.message.chat.id, 
                    call.message.message_id, 
                    reply_markup=None
                )
            except:
                pass
            
            # Отправляем подтверждение
            safe_send_message(
                call.message.chat.id, 
                f"✅ <b>Заявка #{booking_id} принята в работу</b>\n\n"
                f"👤 Клиент: {user_id}\n"
                f"⏰ {datetime.now().strftime('%H:%M')}",
                parse_mode="HTML"
            )
            
            # Уведомляем админа лично (если это группа)
            if call.message.chat.id != int(ADMIN_ID):
                safe_send_message(
                    ADMIN_ID,
                    f"✅ Заявка #{booking_id} взята в работу\n"
                    f"👤 Обработал: @{call.from_user.username or call.from_user.id}"
                )
            
            print(f"✅ Booking {booking_id} approved by {call.from_user.id}")

        elif action == 'reject':
            # ❌ Не удалось
            bot.answer_callback_query(call.id, "❌ Заявка отклонена")
            
            # Убираем кнопки
            try:
                bot.edit_message_reply_markup(
                    call.message.chat.id, 
                    call.message.message_id, 
                    reply_markup=None
                )
            except:
                pass
            
            # Отправляем подтверждение
            safe_send_message(
                call.message.chat.id,
                f"❌ <b>Заявка #{booking_id} отклонена</b>\n\n"
                f"👤 Клиент: {user_id}\n"
                f"⏰ {datetime.now().strftime('%H:%M')}\n\n"
                f"💡 Причину можно написать клиенту вручную",
                parse_mode="HTML"
            )
            
            # Уведомляем админа лично (если это группа)
            if call.message.chat.id != int(ADMIN_ID):
                safe_send_message(
                    ADMIN_ID,
                    f"❌ Заявка #{booking_id} отклонена\n"
                    f"👤 Обработал: @{call.from_user.username or call.from_user.id}"
                )
            
            print(f"❌ Booking {booking_id} rejected by {call.from_user.id}")

        # Удаляем заявку из pending
        del pending_bookings[booking_id]
        print(f"🗑️ Removed booking {booking_id} from pending. Remaining: {len(pending_bookings)}")

    except Exception as e:
        print(f"❌ Error in booking confirmation: {e}")
        import traceback
        traceback.print_exc()
        bot.answer_callback_query(call.id, "⚠️ Ошибка обработки")

def handle_start_userbot_command(admin_chat_id, user_id):
    """Обработчик команды запуска UserBot"""
    try:
        # Отменяем любые активные таймеры Claude для этого пользователя
        if user_id in claude_init_timers:
            claude_init_timers[user_id].cancel()
            del claude_init_timers[user_id]
        
        # Получаем команду для UserBot
        cmd = user_sessions.get(user_id, {}).get('userbot_command', f'/start_dialog {user_id}')
        
        # Уведомление в группу диалогов
        send_dialog_to_group(user_id, "started", "Админ запустил UserBot через команду")
        
        safe_send_message(
            admin_chat_id,
            f"🤖 <b>USERBOT АКТИВИРОВАН</b>\n\n"
            f"👤 Клиент: {user_id}\n"
            f"🎯 Теплый лид переведен на UserBot\n\n"
            f"📋 <b>Команда:</b>\n"
            f"<code>{cmd}</code>\n\n"
            f"💡 Скопируй и отправь СЕБЕ в UserBot",
            parse_mode="HTML"
        )
        
        print(f"✅ UserBot activated via command for {user_id}")
        
    except Exception as e:
        print(f"Error in UserBot command: {e}")


def handle_start_claude_command(admin_chat_id, user_id):
    """Обработчик команды запуска Claude через текстовую команду"""
    try:
        # ✅ ПОЛУЧАЕМ ФИЛЬТРЫ ИЗ user_data.json (БЕЗ TRACKER)
        filters = {}
        
        try:
            user_data_file = "webapp/backend/data/user_data.json"
            if os.path.exists(user_data_file):
                with open(user_data_file, "r", encoding="utf-8") as f:
                    user_data_list = json.load(f)
                
                # Ищем данные пользователя
                for user_data in user_data_list:
                    if user_data.get('user_id') == user_id:
                        print(f"🔍 Found user_data for {user_id}")
                        
                        # car_interested = категория
                        if user_data.get('car_interested'):
                            filters['category'] = user_data.get('car_interested', 'все')
                        
                        # dates_selected = даты
                        if user_data.get('dates_selected'):
                            dates = user_data['dates_selected']
                            filters['startDate'] = dates.get('start')
                            filters['endDate'] = dates.get('end')
                            filters['days'] = dates.get('days')
                        
                        print(f"📊 Loaded filters: {filters}")
                        break
        except Exception as e:
            print(f"⚠️ Error loading filters: {e}")
            import traceback
            traceback.print_exc()
        
        # Дефолт если фильтры пустые
        if not filters or not filters.get('days'):
            filters = {'days': 7, 'category': 'все'}
            print(f"📊 Using default filters: {filters}")
        
        # Запускаем диалог Claude немедленно
        print(f"🚀 Calling initiate_claude_dialogue({user_id}, {filters})")
        initiate_claude_dialogue(user_id, filters)
        
        # ОБНОВЛЯЕМ СТАТУС ДИАЛОГА
        handle_claude_start(user_id)
        
        safe_send_message(
            admin_chat_id,
            f"🧠 <b>CLAUDE АКТИВИРОВАН</b>\n\n"
            f"👤 Клиент: {user_id}\n"
            f"🎯 Теплый лид переведен на Claude\n"
            f"📅 Фильтры: {filters}\n"
            f"⚡ Диалог запущен немедленно",
            parse_mode="HTML"
        )
        
        print(f"✅ Claude activated via command for {user_id}")
        
    except Exception as e:
        print(f"❌ Error in Claude command: {e}")
        import traceback
        traceback.print_exc()


def handle_copy_command(admin_chat_id, user_id):
    """Обработчик команды копирования"""
    try:
        cmd = user_sessions.get(user_id, {}).get('userbot_command', f'/start_dialog {user_id}')
        
        safe_send_message(
            admin_chat_id,
            f"📋 <b>КОМАНДА ДЛЯ USERBOT:</b>\n\n"
            f"<code>{cmd}</code>\n\n"
            f"💡 Команда готова для копирования\n"
            f"📱 Отправь СЕБЕ в UserBot",
            parse_mode="HTML"
        )
        
    except Exception as e:
        print(f"Error copying command: {e}")


def handle_start_userbot(call):
    """Обработчик запуска UserBot для теплого лида"""
    try:
        user_id = int(call.data.split('_')[2])
        
        bot.answer_callback_query(call.id, "🤖 Запускаю UserBot...")
        bot.edit_message_reply_markup(call.message.chat.id, call.message.message_id, reply_markup=None)
        
        # Отменяем любые активные таймеры Claude для этого пользователя
        if user_id in claude_init_timers:
            claude_init_timers[user_id].cancel()
            del claude_init_timers[user_id]
        
        # Получаем команду для UserBot
        cmd = user_sessions.get(user_id, {}).get('userbot_command', f'/start_dialog {user_id}')
        
        # Уведомление в группу диалогов
        send_dialog_to_group(user_id, "started", "Админ запустил UserBot вручную")
        
        bot.send_message(
            ADMIN_ID,
            f"🤖 <b>USERBOT АКТИВИРОВАН</b>\n\n"
            f"👤 Клиент: {user_id}\n"
            f"🎯 Теплый лид переведен на UserBot\n\n"
            f"📋 <b>Команда:</b>\n"
            f"<code>{cmd}</code>\n\n"
            f"💡 Скопируй и отправь СЕБЕ в UserBot\n"
            f"(от @mars_rent самому себе)",
            parse_mode="HTML"
        )
        
        print(f"✅ UserBot activated for warm lead {user_id}")
        
    except Exception as e:
        print(f"Error starting UserBot: {e}")
        bot.answer_callback_query(call.id, "⚠️ Ошибка запуска UserBot")




def handle_booking_confirmation_callback(call):
    """Обработка подтверждения/отклонения заявки из callback"""
    try:
        parts = call.data.split('_')
        action = parts[0]
        booking_id = '_'.join(parts[1:])

        if booking_id not in pending_bookings:
            bot.answer_callback_query(call.id, "⚠️ Заявка уже обработана")
            return

        if action == 'approve':
            bot.answer_callback_query(call.id, "✅ В работе!")
            bot.edit_message_reply_markup(call.message.chat.id, call.message.message_id, reply_markup=None)
            safe_send_message(call.message.chat.id, "✅ <b>Заявка принята в работу</b>", parse_mode="HTML")

        elif action == 'reject':
            bot.answer_callback_query(call.id, "❌ Не удалось")
            bot.edit_message_reply_markup(call.message.chat.id, call.message.message_id, reply_markup=None)
            safe_send_message(call.message.chat.id, "❌ <b>Заявка отклонена</b>", parse_mode="HTML")

        del pending_bookings[booking_id]

    except Exception as e:
        print(f"Error in booking confirmation: {e}")
        bot.answer_callback_query(call.id, "⚠️ Ошибка")


@bot.callback_query_handler(func=lambda call: call.data == "show_main_menu_from_start")
def handle_show_main_menu_callback(call):
    bot.answer_callback_query(call.id)
    
    # Проверяем, админ ли это
    if is_admin_user(call.from_user.id):
        markup = get_admin_reply_keyboard()
        message_text = "🎛️ <b>АДМИН-РЕЖИМ</b>\n\nВыберите раздел в меню:"
    else:
        markup = get_reply_keyboard()
        message_text = "📱 <b>Главное меню</b>\n\nВыберите раздел:"
    
    safe_send_message(
        call.message.chat.id,
        message_text,
        reply_markup=markup,
        parse_mode="HTML"
    )


# === REPLY KEYBOARD ===
def get_reply_keyboard():
    markup = ReplyKeyboardMarkup(resize_keyboard=True, row_width=3)
    btn_help = KeyboardButton("🤖 О боте")
    btn_catalog = KeyboardButton("🚀 Автопарк")
    btn_contact = KeyboardButton("📞 Контакт")
    btn_about = KeyboardButton("ℹ️ О нас")
    btn_faq = KeyboardButton("📚 FAQ")
    btn_review = KeyboardButton("⭐ Отзывы")
    markup.add(btn_contact, btn_catalog, btn_help)
    markup.add(btn_about, btn_review, btn_faq)
    return markup

    
@bot.message_handler(func=lambda message: user_conversations.get(message.chat.id, {}).get("status") == "active")
def handle_claude_conversation(message):
    """Обработчик сообщений в активном диалоге Claude - теперь использует бэкенд API"""
    user_id = message.chat.id
    user_input = message.text
    
    status = user_conversations.get(user_id, {}).get("status")
    if status == "paused":
        print(f"⏸️ Claude на паузе для {user_id}. Игнорируем.")
        return

    if user_conversations.get(user_id, {}).get('admin_joined'):
        print(f"Админ {ADMIN_ID} в чате с {user_id}, Claude молчит.")
        return
    
    # Если юзер пишет до нажатия кнопки - активируем диалог сразу
    if user_conversations.get(user_id, {}).get("status") == "waiting_button":
        user_conversations[user_id]["status"] = "active"

    # ОБНОВЛЯЕМ СТАТУС ДИАЛОГА ПРИ СООБЩЕНИИ ОТ ПОЛЬЗОВАТЕЛЯ
    handle_dialog_user_message(user_id, user_input)

    # Логируем сообщение пользователя
    try:
        log_chat_to_file(user_id, "user", user_input)
        
        if ACTIVE_DIALOGS_CHAT_ID:
            user_data = tracker.get_user(user_id)
            username = user_data.get('username') if user_data else None
            user_link = f"@{username}" if username else f'<a href="tg://user?id={user_id}">{user_id}</a>'
            
            safe_send_message(
                ACTIVE_DIALOGS_CHAT_ID,
                f"👤 <b>Клиент {user_link}:</b>\n\n{escape_html(user_input)}",
                parse_mode="HTML",
                disable_web_page_preview=True
            )
    except Exception as e:
        print(f"❌ Ошибка логирования сообщения пользователя в группу: {e}")

    # Проверяем команды завершения
    if user_input.lower() in ["/end", "спасибо", "все", "пока", "все понятно"]:
        send_dialog_to_group(user_id, "ended", f"Клиент завершил: {user_input}")
        safe_send_message(user_id, "Рад был помочь! Если что, пиши 😊")
        
        if user_id in user_conversations:
            user_conversations[user_id]["status"] = "ended"
            print(f"Диалог Claude с {user_id} завершен по команде.")
        return
    
    # Отправляем сообщение в Claude через бэкенд API
    process_claude_message(user_id, user_input)
        
        
@bot.message_handler(func=lambda message: user_conversations.get(message.chat.id, {}).get("status") != "active")
def universal_handler(message):
    chat_id = message.chat.id
    text = message.text
    
    # === АДМИН-КНОПКИ ===
    if is_admin_user(message.from_user.id):
        
        # === ОБРАБОТКА КОМАНД ДЛЯ ТЕПЛЫХ ЛИДОВ ===
        if text.startswith('/ub'):  # UserBot
            try:
                user_id = int(text[3:])  # убираем /ub
                handle_start_userbot_command(chat_id, user_id)
                return
            except ValueError:
                pass
            
        elif text.startswith('/cl'):  # Claude
            try:
                user_id = int(text[3:])  # убираем /cl
                handle_start_claude_command(chat_id, user_id)
                return
            except ValueError:
                pass
            
        elif text.startswith('/cmd'):  # Command
            try:
                user_id = int(text[4:])  # убираем /cmd
                handle_copy_command(chat_id, user_id)
                return
            except ValueError:
                pass
        
        # === ОБРАБОТКА КНОПОК АДМИН-МЕНЮ ===
        
        if text == "🔥 Горячие":
            hot_bookings = get_hot_bookings_history()
            
            response = (
                f"🔥 <b>ГОРЯЧИЕ ЗАЯВКИ</b>\n\n"
                f"📊 Активных заявок: {len(pending_bookings)}\n"
                f"✅ Завершенных броней: {len(hot_bookings)}\n"
                f"⏰ Сейчас: {datetime.now().strftime('%H:%M')}\n\n"
            )
            
            if hot_bookings:
                response += f"📋 <b>Последние {len(hot_bookings)} бронирований:</b>\n\n"
                
                for i, booking in enumerate(hot_bookings, 1):
                    user_link = f"@{booking['username']}" if booking['username'] else f"ID: {booking['user_id']}"
                    
                    # Информация об авто
                    car_name = booking.get('car_interested', 'Не указано')
                    if car_name and car_name != 'Не указано':
                        car_display = car_name[:25] + "..." if len(car_name) > 25 else car_name
                    else:
                        car_display = "Авто не указано"
                    
                    # Информация о датах
                    dates = booking.get('dates')
                    if dates:
                        days = dates.get('days', '?')
                        date_display = f"{days} дней"
                    else:
                        date_display = "Даты ?"
                    
                    # Форматируем время
                    try:
                        timestamp = datetime.fromisoformat(booking['timestamp'].replace('Z', '+00:00'))
                        time_display = timestamp.strftime('%d.%m %H:%M')
                    except:
                        time_display = "?"
                    
                    response += (
                        f"{i}. {user_link}\n"
                        f"🚗 {car_display}\n"
                        f"📅 {date_display} | ⏰ {time_display}\n"
                        f"📊 {booking['source']}\n\n"
                    )
            else:
                response += "📭 Пока нет завершенных бронирований.\n\n"
            
            response += "💡 Полная информация в группе горячих заявок"
            
            safe_send_message(chat_id, response, parse_mode="HTML")
            return
            
        elif text == "🌡️ Теплые":
            warm_leads = get_warm_leads_history()
            
            if not warm_leads:
                response = "🌡️ <b>ТЕПЛЫЕ ЛИДЫ</b>\n\n📭 Пока нет теплых лидов за последние дни."
                safe_send_message(chat_id, response, parse_mode="HTML")
            else:
                response = (
                    f"🌡️ <b>ТЕПЛЫЕ ЛИДЫ</b>\n\n"
                    f"📊 Найдено лидов: {len(warm_leads)}\n\n"
                    f"💡 <b>Команды:</b> /ub - UserBot | /cl - Claude | /cmd - Копировать\n\n"
                )
                
                # Показываем топ-10 лидов с гиперссылками
                for i, lead in enumerate(warm_leads[:10], 1):
                    user_id = lead['user_id']
                    user_link = f"@{lead['username']}" if lead['username'] else f"ID: {lead['user_id']}"
                    dates = lead['dates']
                    days = dates.get('days', '?')
                    
                    # Форматируем дату
                    try:
                        timestamp = datetime.fromisoformat(lead['timestamp'].replace('Z', '+00:00'))
                        time_ago = timestamp.strftime('%d.%m %H:%M')
                    except:
                        time_ago = "?"
                    
                    # Формируем команду для UserBot
                    start_date = dates.get('start', '').split('T')[0] if dates.get('start') else ''
                    end_date = dates.get('end', '').split('T')[0] if dates.get('end') else ''
                    userbot_command = f"/start_dialog {user_id}"
                    if start_date and end_date:
                        userbot_command += f" dates:{start_date}-{end_date}"
                    if days:
                        userbot_command += f" days:{days}"
                    
                    # Сохраняем команду для копирования
                    if user_id not in user_sessions:
                        user_sessions[user_id] = {}
                    user_sessions[user_id]['userbot_command'] = userbot_command
                    
                    # Создаем строку с текстовыми командами
                    response += (
                        f"{i}. {user_link}\n"
                        f"📅 {days} дней | ⏰ {time_ago} | 📊 {lead['source']}\n"
                        f"<code>/ub{user_id}</code> | <code>/cl{user_id}</code> | <code>/cmd{user_id}</code>\n\n"
                    )
                
                # Показываем остальные лиды без действий
                if len(warm_leads) > 10:
                    response += f"📋 <b>Остальные {len(warm_leads) - 10} лидов:</b>\n"
                    for i, lead in enumerate(warm_leads[10:], 11):
                        user_display = f"@{lead['username']}" if lead['username'] else f"ID: {lead['user_id']}"
                        days = lead['dates'].get('days', '?')
                        try:
                            timestamp = datetime.fromisoformat(lead['timestamp'].replace('Z', '+00:00'))
                            time_str = timestamp.strftime('%d.%m %H:%M')
                        except:
                            time_str = "?"
                        
                        response += f"{i}. {user_display} | {days}д | {time_str}\n"
                
                safe_send_message(chat_id, response, parse_mode="HTML", disable_web_page_preview=True)
            
            return
            
        elif text == "🔍 CRM" :
            markup = InlineKeyboardMarkup()
            markup.add(InlineKeyboardButton(
                "🔍 CRM панель для админа",
                web_app=WebAppInfo(url="https://sunny-rentals.online/admin/crm")
            ))
            safe_send_message(chat_id, "🔍 CRM : https://sunny-rentals.online/admin/crm", parse_mode="HTML", reply_markup=markup)
            return
        elif text == "📊 Статистика":
            try:
                stats = tracker.get_stats()
                response = (
                    f"📊 <b>СТАТИСТИКА</b>\n\n"
                    f"👥 Всего пользователей: {stats['total_users']}\n"
                    f"✅ Завершили бронирование: {stats['bookings_completed']}\n"
                    f"📈 Конверсия: {stats['conversion_rate']}%\n\n"
                    f"📋 Начали форму: {stats['form_started']}\n"
                    f"📧 Followup отправлен: {stats['followup_sent']}\n"
                    f"💬 Ответили на followup: {stats['followup_responded']}\n\n"
                )
                
                if stats['popular_cars']:
                    response += "🚗 <b>Популярные авто:</b>\n"
                    for car, count in list(stats['popular_cars'].items())[:3]:
                        response += f"• {car}: {count}\n"
                
            except Exception as e:
                response = f"❌ Ошибка получения статистики: {e}"
            
            safe_send_message(chat_id, response, parse_mode="HTML")
            return
            
        elif text == "💻 Флот-панель":
            try:
                # Твои ссылки
                admin_url = "https://sunny-rentals.online/admin?key=sunny2025"
                fleet_url = "https://sunny-rentals.online/admin/cars"
                
                # Путь к твоей картинке (относительно корня проекта, где запускается webapp.py)
                photo_path = "webapp/public/admin_panel.png"
                
                # Создаем "inline" кнопки
                markup = InlineKeyboardMarkup()
                markup.row(
                    InlineKeyboardButton(
                        "⚙️ Управлять флотом",
                        url=admin_url
                    )
#                    InlineKeyboardButton(
#                        "🚘 Открыть весь флот",
#                        url=fleet_url
#                    )
                 )
                
                # Текст для подписи к фото
                caption_text = (
                    "🖥️ <b>Панель управления</b>\n\n"
                    "1. Добавляйте, редактируйте и удаляйте автомобили\n"
                    "2. Управляйте доступностью и ценами\n"
                    "3. Просматривайте статистику и отчеты\n\n"
                    "<b>ИЛИ ПРОСМОТРЕТЬ ВСЕ АВТОМОБИЛИ</b>\n\n"

                    "Выберите, что хотите открыть:"
                )
                
                # Проверяем, существует ли файл
                if not os.path.exists(photo_path):
                    print(f"⚠️ [Флот-панель] Файл картинки не найден по пути: {photo_path}")
                    # Если картинки нет, отправляем просто текст (как раньше)
                    safe_send_message(chat_id, caption_text, parse_mode="HTML", reply_markup=markup)
                else:
                    # Если картинка есть, открываем ее и отправляем
                    with open(photo_path, 'rb') as photo:
                        bot.send_photo(
                            chat_id,
                            photo,
                            caption=caption_text,
                            parse_mode="HTML",
                            reply_markup=markup
                        )
                
            except Exception as e:
                response = f"❌ Ошибка при отправке панели с фото: {e}"
                safe_send_message(chat_id, response, parse_mode="HTML")
            
            return
            
        elif text == "📅 Календарь":
            markup = InlineKeyboardMarkup()
            markup.add(InlineKeyboardButton(
                "🟢⚪️ График занятости транспорта",
                web_app=WebAppInfo(url="https://sunny-rentals.online/admin/scheduler")
            ))
            safe_send_message(chat_id, "Панель управления бронью : https://sunny-rentals.online/admin/scheduler", parse_mode="HTML", reply_markup=markup)
            return
            
        elif text == "👤 Обычный режим":
            # Переключаем админа в обычный режим
            markup = get_reply_keyboard()
            safe_send_message(
                chat_id,
                "👤 Переключено в обычный режим пользователя.\n\nИспользуйте /start для возврата в админ-режим.",
                reply_markup=markup,
                parse_mode="HTML"
            )
            return
            
        elif text == "⚙️ Управление":
            markup = InlineKeyboardMarkup()
            markup.add(InlineKeyboardButton(
                "УПРАВЛЕНИЕ",
                web_app=WebAppInfo(url="https://sunny-rentals.online/admin/app?key=sunny2025")
            ))
            safe_send_message(chat_id, "Панель управления бронью : https://https://sunny-rentals.online/admin/app?key=sunny2025", parse_mode="HTML", reply_markup=markup)
            return
            
        elif text == "📝 Логи":
            response = "📝 <b>ЛОГИ</b>\n\nДоступны файлы:\n• user_data.json - данные пользователей\n• chat_logs.jsonl - логи диалогов\n• followup_responses.log - ответы followup\n\n"
            safe_send_message(chat_id, response, parse_mode="HTML")
            return
            
    # --- КОНЕЦ АДМИН-ЛОГИКИ ---
    
    # --- ПРОВЕРКА НА ГРУППЫ ---
    if message.chat.type != "private":
        print(f"Ignoring message from non-admin in non-private chat {chat_id}")
        return
    
    # === ОБЫЧНЫЕ ПОЛЬЗОВАТЕЛИ ===
    # Claude НЕ активен - отправляем сообщение на бэкенд молча

    # ОБНОВЛЯЕМ СТАТУС ДИАЛОГА ПРИ СООБЩЕНИИ ОТ ПОЛЬЗОВАТЕЛЯ
    handle_dialog_user_message(message.from_user.id, text)

    webhook_data = {
        "user_id": message.from_user.id,
        "text": text,
        "username": message.from_user.username,
        "timestamp": datetime.now().isoformat(),
        "claude_status": "inactive"
    }

    try:
        response = requests.post("http://localhost:5000/api/internal/receive-message", json=webhook_data, timeout=5)
        print(f"📨 Отправлено на бэкенд (молча) для пользователя {message.from_user.id}")
        
        new_message_text = (
            f"📥 НОВОЕ СООБЩЕНИЕ \n"
            f"User ID :  <b>{message.from_user.id}</b>\n"
            f"Message: {text}\n"
            )
        
        safe_send_message(ACTIVE_DIALOGS_CHAT_ID, new_message_text, parse_mode="HTML")
        
    except Exception as webhook_error:
        print(f"⚠️ Ошибка отправки webhook на бэкенд: {webhook_error}")
        # Продолжаем работу даже если бэкенд недоступен

    # НЕ отвечаем пользователю - бэкенд сам решит что делать
        
        
# ==============================
# FASTAPI ENDPOINTS - WEBHOOK NOTIFICATIONS
# ==============================

@app.post("/botapi/notify/webapp-opened")
async def notify_webapp_opened(request: Request):
    """
    web_integrations.py вызывает когда пользователь ВПЕРВЫЕ зашёл в webapp
    Отправляет уведомление в группу (опционально)
    """
    try:
        data = await request.json()
        user_id = data.get('user_id')
        username = data.get('username')
        
        print(f"📱 Webhook: webapp_opened - user {user_id} (@{username})")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id required")
        
        # Формируем ссылку на пользователя
        user_link = f"@{username}" if username else f'<a href="tg://user?id={user_id}">{user_id}</a>'
        
        # ✅ ОПЦИОНАЛЬНО: Отправка уведомления в группу/админу
        # Если не хочешь спамить - просто убери этот блок или отправь только в лог
        if ADMIN_ID:  # Или WARM_LEADS_CHAT_ID если хочешь в группу
            message = (
                f"📱 <b>Новый вход в webapp</b>\n\n"
                f"👤 {user_link}\n"
                f"🆔 <code>{user_id}</code>\n"
                f"⏰ {datetime.now().strftime('%d.%m %H:%M')}\n\n"
                f"<i>Впервые открыл приложение</i>"
            )
            
            # Отправляем админу тихо (без звука)
            safe_send_message(
                ADMIN_ID,  # или WARM_LEADS_CHAT_ID
                message,
                parse_mode="HTML",
                disable_notification=True  # ✅ Без звука чтобы не спамить
            )
            print(f"✅ Sent webapp_opened notification for {user_id}")
        
        return JSONResponse(content={"status": "ok"})
        
    except Exception as e:
        print(f"❌ Error in notify_webapp_opened: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/botapi/notify/filters-used")
async def notify_filters_used(request: Request):
    """
    main.py вызывает когда пользователь использовал фильтры (теплый лид)
    Отправляет в группу WARM_LEADS и СОХРАНЯЕТ фильтры для Claude
    """
    try:
        data = await request.json()
        user_id = data.get('user_id')
        filters = data.get('filters', {})
        
        print(f"🌡️ Webhook: filters_used - user {user_id}")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id required")
        
        # ✅ СОХРАНЯЕМ ФИЛЬТРЫ В КЭШЕ ДЛЯ CLAUDE
        user_filters_cache[user_id] = {
            'days': filters.get('days'),
            'category': filters.get('category', 'все'),
            'startDate': filters.get('startDate'),
            'endDate': filters.get('endDate'),
            'pickupLocation': filters.get('pickupLocation'),
            'returnLocation': filters.get('returnLocation')
        }
        print(f"💾 Cached filters for user {user_id}: {user_filters_cache[user_id]}")
        
        # Получаем username
        username = filters.get('username')
        user_link = f"@{username}" if username else f'<a href="tg://user?id={user_id}">{user_id}</a>'
        
        # Форматируем даты
        start_date = filters.get('startDate', '').split('T')[0] if filters.get('startDate') else 'не указано'
        end_date = filters.get('endDate', '').split('T')[0] if filters.get('endDate') else 'не указано'
        days = filters.get('days', 'не указано')
        category = filters.get('category', 'все')
        pickup = filters.get('pickupLocation', 'не указано')
        return_loc = filters.get('returnLocation', 'не указано')
        
        try:
            start_formatted = datetime.strptime(start_date, '%Y-%m-%d').strftime('%d.%m.%Y')
            end_formatted = datetime.strptime(end_date, '%Y-%m-%d').strftime('%d.%m.%Y')
        except:
            start_formatted = start_date
            end_formatted = end_date
        
        # Маппинг локаций
        location_map = {
            'airport': '🛬 Аэропорт',
            'hotel': '🏨 Отель',
            'villa': '🏡 Вилла',
            'other': '📍 Другое'
        }
        
        pickup_formatted = location_map.get(pickup, pickup)
        return_formatted = location_map.get(return_loc, return_loc)
        
        # ✅ ОТПРАВКА В ГРУППУ ТЕПЛЫХ ЛИДОВ С КНОПКОЙ
        if WARM_LEADS_CHAT_ID:
            message = (
                f"🌡️ <b>ТЕПЛЫЙ ЛИД</b>\n\n"
                f"👤 {user_link}\n"
                f"🆔 <code>{user_id}</code>\n"
                f"⏰ {datetime.now().strftime('%d.%m %H:%M')}\n\n"
                f"📅 {start_formatted} - {end_formatted} ({days} дн.)\n"
                f"🚗 Категория: {category}\n"
                f"📍 {pickup_formatted} → {return_formatted}\n\n"
                f"<i>Использовал фильтры, но не забронировал</i>"
            )
            
            markup = InlineKeyboardMarkup()
            markup.add(
                InlineKeyboardButton(
                    "🧠 Запустить Claude",
                    callback_data=f"start_claude_{user_id}"
                )
            )
            
            safe_send_message(
                WARM_LEADS_CHAT_ID,
                message,
                parse_mode="HTML",
                reply_markup=markup
            )
            print(f"✅ Sent warm lead to group with Claude button")
        
        return JSONResponse(content={"status": "ok"})
        
    except Exception as e:
        print(f"❌ Error in notify_filters_used: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/botapi/notify/booking-submitted")
async def notify_booking_submitted(request: Request):
    """main.py вызывает когда пользователь отправил бронь"""
    try:
        data = await request.json()
        booking_id = data.get('booking_id')
        user_id = data.get('user_id')
        form_data = data.get('form_data', {})
        
        print(f"🔥 Webhook: booking submitted - {booking_id} from user {user_id}")
        
        if not booking_id or not user_id:
            raise HTTPException(status_code=400, detail="booking_id and user_id required")
        
        # Получаем данные
        car_info = form_data.get('car', {})
        pricing_info = form_data.get('pricing', {})
        dates_info = form_data.get('dates', {})
        contact_info = form_data.get('contact', {})
        locations_info = form_data.get('locations', {})
        
        username = form_data.get('username')
        user_link = f"@{username}" if username else f'<a href="tg://user?id={user_id}">{user_id}</a>'
        
        # Форматируем даты
        try:
            start_date = dates_info.get('start', '').split('T')[0]
            end_date = dates_info.get('end', '').split('T')[0]
            start_formatted = datetime.strptime(start_date, '%Y-%m-%d').strftime('%d.%m.%Y')
            end_formatted = datetime.strptime(end_date, '%Y-%m-%d').strftime('%d.%m.%Y')

        except:
            start_formatted = dates_info.get('start', '-')
            end_formatted = dates_info.get('end', '-')
        
        # Маппинг локаций
        location_map = {
            'airport': '🛬 Аэропорт',
            'hotel': '🏨 Отель',
            'villa': '🏡 Вилла',
            'other': '📍 Другое'
        }
        
        pickup = locations_info.get('pickup', 'не указано')
        return_loc = locations_info.get('return', 'не указано')
        pickup_formatted = location_map.get(pickup, pickup)
        return_formatted = location_map.get(return_loc, return_loc)
        
        # ✅ ОДНО сообщение в группу HOT BOOKINGS с кнопками
        admin_message = (
            f"<b>НОВАЯ БРОНЬ #{booking_id}</b>\n\n"
            f"{user_link}\n"
            f"<code>{user_id}</code>\n"
            f"{datetime.now().strftime('%d.%m %H:%M')}\n\n"
            f"{car_info.get('name', f"{car_info.get('brand', '')} {car_info.get('model', '')}")}\n"
            f"{start_formatted} - {end_formatted} ({dates_info.get('days', '?')} дн.)\n"
            f"{pickup_formatted} → {return_formatted}\n\n"
            f"<b>{pricing_info.get('grandTotal', 0):,} ฿</b>\n"
            f"{contact_info.get('value', '-')}"
        )
        
        markup = InlineKeyboardMarkup()
        markup.row(
            InlineKeyboardButton("✅ В работу", callback_data=f"approve_{booking_id}"),
            InlineKeyboardButton("❌ Не удалось", callback_data=f"reject_{booking_id}")
        )
        
        # Сохраняем для обработки callback
        pending_bookings[booking_id] = {
            'user_id': user_id,
            'form_data': form_data,
            'timestamp': datetime.now().isoformat()
        }
        
        # ✅ ОДНА отправка в группу
        if HOT_BOOKINGS_CHAT_ID:
            safe_send_message(
                HOT_BOOKINGS_CHAT_ID,
                admin_message,
                parse_mode="HTML",
                reply_markup=markup
            )
            print(f"✅ Sent booking to hot group with buttons")
        
        return JSONResponse(content={"status": "ok", "booking_id": booking_id})
        
    except Exception as e:
        print(f"❌ Error in notify_booking_submitted: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/send_command")
async def send_command_to_userbot(request: Request):
    """Отправить команду с кнопкой для запуска userbot"""
    try:
        data = await request.json()
        admin_id = data.get('admin_id')
        command = data.get('command')
        
        print(f"📨 Received command request: {command}")
#        safe_send_message(chat_id=admin_id,text=f"<code>{command}</code>", parse_mode="HTML", disable_web_page_preview=False)
        print(f"✅ Command button sent to admin {admin_id}")
        
        return JSONResponse(content={"status": "ok", "message": "Command sent"})
    except Exception as e:
        print(f"❌ Error sending command: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==============================
# FASTAPI ENDPOINTS - INTERNAL COMMUNICATION
# ==============================

@app.post("/internal/send_message")
async def internal_send_message(request: Request):
    """Internal endpoint for sending messages from CRM to Telegram users"""
    try:
        data = await request.json()
        user_id = data.get('user_id')
        text = data.get('text')
        
        if not user_id or not text:
            raise HTTPException(status_code=400, detail="user_id and text are required")
        
        # Send message via Telegram bot
        bot.send_message(user_id, text)
        
        return JSONResponse(content={"status": "ok", "message": "Message sent successfully"})
        
    except Exception as e:
        print(f"❌ Error in internal_send_message: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
# === ДУБЛИРУЮЩИЙ ОБРАБОТЧИК - ЗАКОММЕНТИРОВАН (дублировал фото на порт 8000)
# @bot.message_handler(content_types=['photo'])
# def handle_photo(message):
#     try:
#         print(f"📸 Incoming photo from {message.chat.id}")
#
#         # Получаем файл от Telegram
#         file_info = bot.get_file(message.photo[-1].file_id)
#         file_bytes = bot.download_file(file_info.file_path)
#
#         # Определяем имя файла
#         filename = file_info.file_path.split("/")[-1]
#         content_type = "image/jpeg"  # Telegram всегда отдаёт jpg для фото
#
#         # Готовим multipart запрос в CRM
#         files = {
#             "file": (filename, BytesIO(file_bytes), content_type)
#         }
#         data = {
#             "user_id": message.chat.id,
#             "message": message.caption or ""
#         }
#
#         crm_url = os.getenv("CRM_BACKEND_URL", "http://localhost:8000")
#
#         response = requests.post(
#             f"{crm_url}/api/crm/receive_media",
#             files=files,
#             data=data,
#             timeout=30
#         )
#
#         if response.status_code == 200:
#             print("✅ Photo forwarded to CRM")
#         else:
#             print(f"❌ CRM error: {response.status_code} {response.text}")
#
#     except Exception as e:
#         print("❌ Failed to forward photo:", e)

@app.post("/internal/send_media")
async def internal_send_media(
    user_id: int = Form(...),
    message: str = Form(""),
    media: UploadFile = File(...)
):
    """Internal endpoint for sending media files from CRM to Telegram users"""
    try:
        print(f"📤 Received media for user {user_id}: {media.filename}")
        
        # Определяем тип медиа и отправляем
        if media.content_type.startswith('image/'):
            # Отправляем фото
            bot.send_photo(user_id, media.file, caption=message)
        elif media.content_type == 'application/pdf':
            # Отправляем документ
            bot.send_document(user_id, media.file, caption=message)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported media type: {media.content_type}")
        
        print(f"✅ Media sent successfully to user {user_id}")
        return JSONResponse(content={"status": "ok", "message": "Media sent successfully"})
        
    except Exception as e:
        print(f"❌ Error in internal_send_media: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/internal/update_claude_status")
async def internal_update_claude_status(request: Request):
    """Internal endpoint for updating Claude status from backend"""
    try:
        data = await request.json()
        user_id = data.get('user_id')
        status = data.get('status')
        
        if not user_id or not status:
            raise HTTPException(status_code=400, detail="user_id and status are required")
        
        print(f"🔄 Updating Claude status for user {user_id}: {status}")
        
        # Update conversation status
        if status == "active":
            user_conversations[user_id] = {
                "status": "active",
                "history": user_conversations.get(user_id, {}).get("history", []),
                "filters": user_conversations.get(user_id, {}).get("filters", {})
            }
            handle_claude_start(user_id)
        elif status == "paused":
            if user_id in user_conversations:
                user_conversations[user_id]["status"] = "paused"
            handle_claude_pause(user_id)
        elif status == "idle":
            if user_id in user_conversations:
                user_conversations[user_id]["status"] = "stopped"
            handle_claude_stop(user_id)
        
        return JSONResponse(content={"status": "ok", "message": f"Claude status updated to {status}"})
        
    except Exception as e:
        print(f"❌ Error in internal_update_claude_status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==============================
# FASTAPI ENDPOINTS - CRM AND DIALOG MANAGEMENT
# ==============================

@app.post("/botapi/dialog/start")
async def api_start_claude(request: Request):
    data = await request.json()
    user_id = data.get('user_id')
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    
    # Сброс и запуск
    user_conversations[user_id] = {"status": "active", "history": [], "filters": {}}
    if user_id in user_sessions:
        user_sessions[user_id]["claude_initiated"] = True
        
    # Сразу отправляем приветственные варианты
    threading.Thread(target=handle_claude_best_options, args=(user_id,)).start()
    
    send_dialog_to_group(user_id, "started", "Claude активирован через CRM")
    
    # ОБНОВЛЯЕМ СТАТУС ДИАЛОГА
    handle_claude_start(user_id)
    
    return JSONResponse(content={"status": "ok", "message": "Claude started"})

@app.post("/botapi/dialog/pause")
async def api_pause_claude(request: Request):
    data = await request.json()
    user_id = data.get('user_id')
    if user_id in user_conversations:
        user_conversations[user_id]["status"] = "paused"
        send_dialog_to_group(user_id, "paused", "Claude на паузе (ручное управление)")
        
        # ОБНОВЛЯЕМ СТАТУС ДИАЛОГА
        handle_claude_pause(user_id)
        
        return JSONResponse(content={"status": "ok"})
    raise HTTPException(status_code=404, detail="Dialog not found")

@app.post("/botapi/dialog/resume")
async def api_resume_claude(request: Request):
    data = await request.json()
    user_id = data.get('user_id')
    if user_id in user_conversations:
        user_conversations[user_id]["status"] = "active"
        send_dialog_to_group(user_id, "started", "Claude возобновил работу")
        
        # ОБНОВЛЯЕМ СТАТУС ДИАЛОГА
        handle_claude_resume(user_id)
        
        return JSONResponse(content={"status": "ok"})
    raise HTTPException(status_code=404, detail="Dialog not found")

@app.post("/botapi/dialog/stop")
async def api_stop_claude(request: Request):
    data = await request.json()
    user_id = data.get('user_id')
    if user_id in user_conversations:
        user_conversations[user_id]["status"] = "stopped"
        send_dialog_to_group(user_id, "ended", "Claude полностью отключен для юзера")
        
        # ОБНОВЛЯЕМ СТАТУС ДИАЛОГА
        handle_claude_stop(user_id)
        
    return JSONResponse(content={"status": "ok"})

@app.post("/botapi/crm/send_message")
async def crm_send_message(request: Request):
    """CRM endpoint for sending messages to clients"""
    data = await request.json()
    user_id = data.get('user_id')
    text = data.get('text')
    
    if not user_id or not text:
        raise HTTPException(status_code=400, detail="Missing data")
        
    try:
        # Отправляем сообщение от имени бота
        bot.send_message(user_id, text)
        
        # Логируем, чтобы в истории CRM сообщение тоже появилось
        log_chat_to_file(user_id, "assistant", f"[Менеджер]: {text}")
        
        # Уведомляем админ-группу
        if ACTIVE_DIALOGS_CHAT_ID:
            safe_send_message(ACTIVE_DIALOGS_CHAT_ID, f"👨‍💻 <b>Ответ менеджера юзеру {user_id}:</b>\n\n{text}", parse_mode="HTML")
        
        # ОБНОВЛЯЕМ СТАТУС ДИАЛОГА ПРИ СООБЩЕНИИ ОТ МЕНЕДЖЕРА
        handle_dialog_manager_message(user_id, text)
            
        return JSONResponse(content={"status": "ok"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/crm/bookings/{user_id}")
async def get_user_bookings(user_id: int):
    """CRM endpoint to get bookings for a specific user"""
    try:
        # Load bookings from file
        bookings = load_bookings()
        
        # Filter bookings for the specific user (handle both string and int comparison)
        user_bookings = []
        user_id_str = str(user_id)  # Convert to string for comparison
        
        for booking in bookings:
            booking_user_id = booking.get('user_id')
            # Compare both as strings to handle type mismatch
            if str(booking_user_id) == user_id_str:
                user_bookings.append(booking)
        
        return JSONResponse(content={
            "status": "ok",
            "user_id": user_id,
            "bookings": user_bookings,
            "count": len(user_bookings)
        })
        
    except Exception as e:
        print(f"Error getting bookings for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==============================
# FASTAPI ENDPOINTS - DIALOG STATUS MANAGEMENT
# ==============================

@app.post("/api/crm/dialog/{user_id}/mark-read")
async def mark_dialog_read(user_id: int):
    """Сбросить флаг has_new_messages когда менеджер открыл чат"""
    try:
        update_dialog_status(
            user_id=user_id,
            has_new_messages=False
        )

        log_dialog_event(user_id, "messages_marked_read", {
            "by": "manager",
            "timestamp": datetime.now().isoformat()
        })

        return JSONResponse(content={"status": "ok"})
    except Exception as e:
        print(f"❌ Error marking dialog read for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/crm/dialog/{user_id}/status")
async def get_dialog_status_endpoint(user_id: int):
    """Получить статус диалога для пользователя"""
    try:
        status = get_dialog_status(user_id)
        return JSONResponse(content={"status": "ok", "dialog": status})
    except Exception as e:
        print(f"❌ Error getting dialog status for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==============================
# FASTAPI APPLICATION STARTUP
# ==============================

def run_fastapi_app():
    """Run the FastAPI application"""
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)

if __name__ == '__main__':
    # Start FastAPI server in a separate thread
    fastapi_thread = threading.Thread(target=run_fastapi_app, daemon=True)
    fastapi_thread.start()
    print("🚀 FastAPI server started on port 5001")
    print("🤖 Bot is polling...")
    bot.infinity_polling()