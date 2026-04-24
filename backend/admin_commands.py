from user_tracker import UserTracker
from datetime import datetime

def escape_markdown(text):
    """Escapes special characters for Telegram Markdown."""
    if not isinstance(text, str):
        text = str(text)
    import re
    escape_chars = r'_*`['
    return re.sub(f'([\\{escape_chars}])', r'\\\1', text)

class AdminCommands:
    def __init__(self, tracker: UserTracker):
        self.tracker = tracker
    
    def cmd_userlist(self) -> str:
        """Get list of users with usernames"""
        users = self.tracker.get_users_with_username()
        
        if not users:
            return "📋 *Список пользователей*\n\n_Пока нет пользователей с username_"
        
        message = "📋 *Список пользователей*\n\n"
        
        for i, user in enumerate(users, 1):
            username = user.get('username', 'unknown')
            user_id = user.get('user_id')
            timestamp = user.get('timestamp', '')
            status = user.get('status', 'unknown')
            booking = "✅" if user.get('booking_submitted') else "❌"
            
            # Format timestamp
            try:
                dt = datetime.fromisoformat(timestamp)
                time_str = dt.strftime('%d.%m.%Y %H:%M')
            except:
                time_str = timestamp
            
            message += (
                f"{i}. @{escape_markdown(username)}\n"
                f"   ID: `{user_id}` | {booking} Бронь | {escape_markdown(status)}\n"
                f"   Заход: {escape_markdown(time_str)}\n\n"
            )
        
        message += f"_Всего: {len(users)} пользователей_"
        return message
    
    def cmd_stat(self) -> str:
        """Get statistics"""
        stats = self.tracker.get_stats()
        
        message = "📊 *СТАТИСТИКА*\n\n"
        
        # General stats
        message += "📈 *Общие показатели:*\n"
        message += f"• Всего посетителей: {stats['total_users']}\n"
        message += f"• Завершенных бронирований: {stats['bookings_completed']}\n"
        message += f"• Конверсия: {stats['conversion_rate']}%\n\n"
        
        # Form stats
        message += "📝 *Форма бронирования:*\n"
        message += f"• Начали заполнение: {stats['form_started']}\n"
        message += f"• % начавших: {stats['form_started_rate']}%\n\n"
        
        # Followup stats
        message += "⏰ *Followup через 24ч:*\n"
        message += f"• Отправлено: {stats['followup_sent']}\n"
        message += f"• Ответили: {stats['followup_responded']}\n"
        message += f"• % ответов: {stats['followup_response_rate']}%\n\n"
        
        # Rejection reasons
        if stats['rejection_reasons']:
            message += "❌ *Причины отказа:*\n"
            reason_names = {
                'price': 'Стоимость',
                'cars': 'Ассортимент',
                'trust': 'Нет доверия',
                'curious': 'Из любопытства'
            }
            for reason, count in stats['rejection_reasons'].items():
                reason_text = reason_names.get(reason, reason)
                message += f"• {escape_markdown(reason_text)}: {count}\n"
            message += "\n"
        
        # Popular cars
        if stats['popular_cars']:
            message += "🚗 *Популярные автомобили:*\n"
            sorted_cars = sorted(stats['popular_cars'].items(), key=lambda x: x[1], reverse=True)
            for car, count in sorted_cars[:5]:  # Top 5
                message += f"• {escape_markdown(car)}: {count}\n"
        
        return message
    
    def cmd_users(self, limit: int = 10) -> str:
        """Get recent users with detailed info"""
        all_users = self.tracker.get_all_users()
        
        if not all_users:
            return "📋 *Последние пользователи*\n\n_Пока нет пользователей_"
        
        # Sort by timestamp, newest first
        sorted_users = sorted(all_users, key=lambda x: x.get('timestamp', ''), reverse=True)
        users = sorted_users[:limit]
        
        message = f"👥 *Последние {len(users)} пользователей*\n\n"
        
        for i, user in enumerate(users, 1):
            user_id = user.get('user_id')
            username = user.get('username')
            timestamp = user.get('timestamp', '')
            car = user.get('car_interested') or 'не выбрал'
            booking = user.get('booking_submitted', False)
            dates = user.get('dates_selected', {})
            
            # Format entry timestamp
            try:
                dt = datetime.fromisoformat(timestamp)
                time_str = dt.strftime('%d.%m %H:%M')
            except:
                time_str = timestamp
            
            # User link
            user_link = f"@{escape_markdown(username)}" if username else f"[{user_id}](tg://user?id={user_id})"
            
            # Car name
            car_display = escape_markdown(car[:30] if len(car) > 30 else car)
            
            # Format dates if available
            dates_str = ""
            if dates:
                start_raw = dates.get('start')
                end_raw = dates.get('end')
                days = dates.get('days', '?')
                
                # Format dates from ISO to readable format
                try:
                    if start_raw:
                        start_dt = datetime.fromisoformat(start_raw.replace('Z', '+00:00'))
                        start = start_dt.strftime('%d.%m')
                    else:
                        start = '?'
                    
                    if end_raw:
                        end_dt = datetime.fromisoformat(end_raw.replace('Z', '+00:00'))
                        end = end_dt.strftime('%d.%m')
                    else:
                        end = '?'
                    
                    dates_str = f"\n   📅 {escape_markdown(start)} - {escape_markdown(end)} ({days}д)"
                except:
                    dates_str = ""
            
            # Booking status
            if booking:
                booking_status = "✅ Забронировал"
            else:
                booking_status = "❌ Не забронировал"
            
            message += (
                f"{i}. {user_link}\n"
                f"   🚗 {car_display}\n"
                f"   {booking_status}{dates_str}\n"
                f"   🕐 Заход: {escape_markdown(time_str)}\n\n"
            )
        
        return message
    
    def cmd_booked(self) -> str:
        """Get users who completed booking"""
        users = self.tracker.get_booked_users()
        
        if not users:
            return "✅ *Завершенные бронирования*\n\n_Пока нет завершенных бронирований_"
        
        message = "✅ *Завершенные бронирования*\n\n"
        
        for i, user in enumerate(users, 1):
            user_id = user.get('user_id')
            username = user.get('username')
            car = user.get('car_interested', 'не указан')
            dates = user.get('dates_selected', {})
            timestamp = user.get('timestamp', '')
            
            # Format dates
            start = dates.get('start', '?') if dates else '?'
            end = dates.get('end', '?') if dates else '?'
            days = dates.get('days', '?') if dates else '?'
            
            # Format timestamp
            try:
                dt = datetime.fromisoformat(timestamp)
                time_str = dt.strftime('%d.%m.%Y %H:%M')
            except:
                time_str = timestamp
            
            user_link = f"@{escape_markdown(username)}" if username else f"[{user_id}](tg://user?id={user_id})"
            
            message += (
                f"{i}. {user_link}\n"
                f"   🚗 {escape_markdown(car)}\n"
                f"   📅 {escape_markdown(start)} - {escape_markdown(end)} ({days} дней)\n"
                f"   🕐 {escape_markdown(time_str)}\n\n"
            )
        
        message += f"_Всего: {len(users)} бронирований_"
        return message
    
    def cmd_sources(self) -> str:
        """Статистика по источникам трафика"""
        try:
            sources_stats = {}
            
            # Собираем статистику
            for user_id, user_data in self.tracker.users.items():
                source = user_data.get('source', 'direct')
                
                if source not in sources_stats:
                    sources_stats[source] = {
                        'users': 0,
                        'webapp_opened': 0,
                        'filters_used': 0,
                        'bookings': 0
                    }
                
                sources_stats[source]['users'] += 1
                
                if user_data.get('webapp_entries'):
                    sources_stats[source]['webapp_opened'] += 1
                
                if user_data.get('filters_completed'):
                    sources_stats[source]['filters_completed'] += 1
                
                if user_data.get('booking_submitted'):
                    sources_stats[source]['bookings'] += 1
            
            # Если нет данных
            if not sources_stats:
                return (
                    "📊 *ИСТОЧНИКИ ТРАФИКА*\n\n"
                    "Пока нет данных.\n\n"
                    "Используйте ссылки вида:\n"
                    "`t.me/webapp_rent_bot?start=название_канала`\n\n"
                    "Примеры:\n"
                    "• `?start=real_phuket`\n"
                    "• `?start=instagram`\n"
                    "• `?start=tg_ads`"
                )
            
            # Форматируем ответ
            response = "📊 *СТАТИСТИКА ПО ИСТОЧНИКАМ*\n\n"
            
            # Сортируем по количеству пользователей
            sorted_sources = sorted(
                sources_stats.items(), 
                key=lambda x: x[1]['users'], 
                reverse=True
            )
            
            for source, stats in sorted_sources:
                # Красивые названия источников
                source_names = {
                    'real_phuket': '🌴 Real Phuket',
                    'tg_ads': '💰 Telegram Ads',
                    'channel_carbook': '📢 Carbook Channel',
                    'instagram': '📸 Instagram',
                    'tiktok': '🎵 TikTok',
                    'group': '👥 Группа',
                    'qr_leaflet': '📄 QR Листовка',
                    'qr': '📄 QR',
                    'direct': '🔗 Прямой переход'
                }
                
                source_name = source_names.get(source, f"📍 {source}")
                
                # Считаем конверсию
                conversion = (stats['bookings'] / stats['users'] * 100) if stats['users'] > 0 else 0
                
                response += (
                    f"*{source_name}*\n"
                    f"├ Пользователей: {stats['users']}\n"
                    f"├ Открыли каталог: {stats['webapp_opened']}\n"
                    f"├ Заполнили фильтры: {stats['filters_completed']}\n"
                    f"├ Забронировали: {stats['bookings']}\n"
                    f"└ Конверсия: {conversion:.1f}%\n\n"
                )
            
            # Добавляем итого
            total_users = sum(s['users'] for s in sources_stats.values())
            total_bookings = sum(s['bookings'] for s in sources_stats.values())
            total_conversion = (total_bookings / total_users * 100) if total_users > 0 else 0
            
            response += (
                f"━━━━━━━━━━━━━━━\n"
                f"*ИТОГО:*\n"
                f"• Всего пользователей: {total_users}\n"
                f"• Всего заявок: {total_bookings}\n"
                f"• Общая конверсия: {total_conversion:.1f}%"
            )
            
            return response
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"❌ Error in cmd_sources: {e}")
            print(error_trace)
            return f"❌ Ошибка получения статистики:\n```\n{e}\n```"
    
    def cmd_help(self) -> str:
        """Get help message"""
        return """🔧 *Админ-команды:*

/panel - Админ панель с кнопками 🎛️
/userlist - Список пользователей
/users - Последние 10 пользователей
/booked - Завершенные бронирования
/stat - Полная статистика
/sources - Статистика по источникам 📊
/help - Это сообщение

💡 _Все данные обновляются в реальном времени_"""