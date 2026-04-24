import json
import os
from datetime import datetime
from typing import Optional, Dict, Any

USER_DATA_FILE = "webapp/backend/data/user_data.json"

class UserTracker:
    def __init__(self, filepath: str = USER_DATA_FILE):
        self.filepath = filepath
        self.users = self._load_data()
    
    def _load_data(self) -> list:
        """Load user data from JSON file"""
        if not os.path.exists(self.filepath):
            return []
        try:
            with open(self.filepath, 'r', encoding='utf-8') as f:
                # Handle empty file case
                content = f.read()
                if not content:
                    return []
                return json.loads(content)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Error loading user data from {self.filepath}: {e}")
            # Optional: create a backup of the corrupted file
            # import shutil
            # shutil.copy(self.filepath, self.filepath + '.bak')
            return []
        
    def _save_data(self):
        """Save user data to JSON file"""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self.filepath), exist_ok=True)
        
            with open(self.filepath, 'w', encoding='utf-8') as f:
                json.dump(self.users, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"❌ Error saving user data to {self.filepath}: {e}")

    def save_data(self):
        """Alias for _save_data for compatibility"""
        return self._save_data()  
        
    def update_user_status(self, user_id, status, note=""):
        # Получаем ссылку на данные пользователя
        user_data = self.get_user_data(user_id)
        
        # Проверяем, что пользователь найден
        if user_data:
            user_data['status'] = status
            user_data['last_note'] = note
            user_data['updated_at'] = datetime.now().isoformat()
            
            # Сохраняем изменения в файл/БД
            self.save_data()
            return True
            
        return False
    def _find_user_index(self, user_id):
        # Пропускаем системных пользователей
        if user_id in ['admin', 'unknown_user', 'system']:
            return None
        
        try:
            user_id_int = int(user_id)
        except (ValueError, TypeError):
            return None
        
        # ... остальной код
        
    def add_webapp_entry(self, user_id: int, source: str = "unknown", username: str = None):

        idx = self._find_user_index(user_id)
        
        if idx is None:
            # New user
            user_data = {
                "user_id": int(user_id),
                "username": username,
                "timestamp": datetime.now().isoformat(),
                "source": source,
                "action": "opened_webapp",
                "status": "new",
                
                "car_interested": None,
                "dates_selected": None,
                "form_started": False,
                "booking_submitted": False,
                
                "followup_sent_at": None,
                "followup_help_needed": None,
                "followup_reason": None,
                
                "status": "awaiting_followup"
            }
            self.users.append(user_data)
            print(f"New user tracked: {user_id}")
        else:
            # Existing user - update timestamp and username if it was missing
            self.users[idx]["timestamp"] = datetime.now().isoformat()
            if not self.users[idx].get("username") and username:
                 self.users[idx]["username"] = username
            print(f"Updated timestamp for user: {user_id}")
        
        self._save_data()
    def update_action(self, user_id: int, action: str):
        """Обновляет action пользователя"""
        idx = self._find_user_index(user_id)
    
        if idx is not None:
            self.users[idx]["action"] = action
            self.users[idx]["timestamp"] = datetime.now().isoformat()
            print(f"✓ Updated action for user {user_id}: {action}")
            self._save_data()
        else:
            print(f"⚠️ Cannot update action for non-existent user {user_id}")

    def update_status(self, user_id: int, status: str):
        """Обновляет status пользователя (new, warm, hot, booked)"""
        idx = self._find_user_index(user_id)
    
        if idx is not None:
            self.users[idx]["status"] = status
            self.users[idx]["timestamp"] = datetime.now().isoformat()
            print(f"✓ Updated status for user {user_id}: {status}")
            self._save_data()
        else:
            print(f"⚠️ Cannot update status for non-existent user {user_id}")

    def update_booking_submitted(self, user_id: int):
        """Обновляет когда пользователь отправил заявку"""
        idx = self._find_user_index(user_id)
    
        if idx is not None:
            self.users[idx]["booking_submitted"] = True
            self.users[idx]["action"] = "booking_submitted"
            self.users[idx]["status"] = "hot"
            self.users[idx]["status"] = "booked"
            self.users[idx]["timestamp"] = datetime.now().isoformat()
            print(f"✓ Updated booking_submitted for user {user_id}")
            self._save_data()
    def update_car_interest(self, user_id: int, car_name: str, dates: Dict[str, Any]):
        """Update when user clicks 'Забронировать'"""
        idx = self._find_user_index(user_id)
        
        if idx is not None:
            self.users[idx]["car_interested"] = car_name
            self.users[idx]["dates_selected"] = dates
            self.users[idx]["form_started"] = True
            self.users[idx]["action"] = "clicked_book"
            print(f"Updated car interest for user {user_id}: {car_name}")
            self._save_data()
    
    def update_dates_selected(self, user_id: int, dates: Dict[str, Any]):
        """Update dates when user completes filters (before booking)"""
        idx = self._find_user_index(user_id)
        
        if idx is not None:
            self.users[idx]["dates_selected"] = dates
            print(f"📅 Updated dates for user {user_id}: {dates.get('start')} to {dates.get('end')} ({dates.get('days')} days)")
            self._save_data()
        else:
            print(f"⚠️ Warning: Tried to update dates for non-existent user {user_id}")
    
    def update_booking_submitted(self, user_id: int):
        """Update when user submits booking form"""
        idx = self._find_user_index(user_id)
        
        if idx is not None:
            self.users[idx]["booking_submitted"] = True
            self.users[idx]["status"] = "booked"
            self.users[idx]["action"] = "booking_submitted"
            print(f"Booking submitted for user {user_id}")
            self._save_data()
    
    def update_followup_sent(self, user_id: int):
        """Update when 24h followup is sent"""
        idx = self._find_user_index(user_id)
        
        if idx is not None:
            self.users[idx]["followup_sent_at"] = datetime.now().isoformat()
            print(f"Followup sent to user {user_id}")
            self._save_data()
    
    def update_followup_response(self, user_id: int, help_needed: bool, reason: str = None):
        """Update followup response"""
        idx = self._find_user_index(user_id)
        
        if idx is not None:
            self.users[idx]["followup_help_needed"] = help_needed
            self.users[idx]["followup_reason"] = reason
            
            if help_needed:
                self.users[idx]["status"] = "helped"
            elif reason:
                self.users[idx]["status"] = "rejected_" + reason
            
            print(f"Followup response from user {user_id}: help={help_needed}, reason={reason}")
            self._save_data()
    
    def get_user(self, user_id: int) -> Optional[Dict]:
        """Get user data"""
        idx = self._find_user_index(user_id)
        return self.users[idx] if idx is not None else None
    
    def get_all_users(self) -> list:
        """Get all users"""
        return self.users
    
    def get_users_with_username(self) -> list:
        """Get users who have username"""
        return [u for u in self.users if u.get('username')]
    
    def get_booked_users(self) -> list:
        """Get users who completed booking"""
        return [u for u in self.users if u.get('booking_submitted')]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics"""
        total = len(self.users)
        if total == 0:
            return {
                "total_users": 0, "bookings_completed": 0, "conversion_rate": 0,
                "form_started": 0, "form_started_rate": 0, "followup_sent": 0,
                "followup_responded": 0, "followup_response_rate": 0,
                "rejection_reasons": {}, "popular_cars": {}
            }

        booked = len([u for u in self.users if u.get('booking_submitted')])
        form_started = len([u for u in self.users if u.get('form_started')])
        followup_sent = len([u for u in self.users if u.get('followup_sent_at')])
        followup_responded = len([u for u in self.users if u.get('followup_help_needed') is not None])
        
        # Count reasons
        reasons = {}
        for user in self.users:
            reason = user.get('followup_reason')
            if reason:
                reasons[reason] = reasons.get(reason, 0) + 1
        
        # Popular cars
        cars = {}
        for user in self.users:
            car = user.get('car_interested')
            if car:
                cars[car] = cars.get(car, 0) + 1
        
        return {
            "total_users": total,
            "bookings_completed": booked,
            "conversion_rate": round(booked / total * 100, 2) if total > 0 else 0,
            "form_started": form_started,
            "form_started_rate": round(form_started / total * 100, 2) if total > 0 else 0,
            "followup_sent": followup_sent,
            "followup_responded": followup_responded,
            "followup_response_rate": round(followup_responded / followup_sent * 100, 2) if followup_sent > 0 else 0,
            "rejection_reasons": reasons,
            "popular_cars": cars
        }