#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Menu Management API для ресторанов
Endpoints для управления меню блюд, ингредиентов и загрузки фото
"""

import os
import json
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field

# ============================================
# PYDANTIC MODELS
# ============================================

class Ingredient(BaseModel):
    id: str
    name: str
    price: float

class MenuItem(BaseModel):
    id: str
    name: str
    slug: str
    category: str
    price: float
    weight: str
    image: str
    ingredients: Optional[List[Ingredient]] = []
    available: bool = True
    notes: str = ""
    photos: Dict[str, Any] = Field(default_factory=lambda: {"main": "", "gallery": []})
    updated_at: Optional[str] = None

class MenuResponse(BaseModel):
    restaurant_id: str
    categories: List[str]
    items: List[MenuItem]

class RestaurantConfig(BaseModel):
    restaurant_id: str
    name: str
    description: Optional[str] = None
    info_text: Optional[str] = None
    logo: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    payment_qr_url: Optional[str] = None
    admin_ids: Optional[List[str]] = None
    delivery: Optional[Dict[str, Any]] = None

# ============================================
# HELPER FUNCTIONS
# ============================================

def get_restaurant_path(restaurant_id: str, data_path: str = "./data/ar") -> Path:
    """Получить путь к папке ресторана"""
    return Path(data_path) / "restaurants" / restaurant_id

def get_menu_file(restaurant_id: str, data_path: str = "./data/ar") -> Path:
    """Получить путь к файлу menu.json"""
    rest_path = get_restaurant_path(restaurant_id, data_path)
    return rest_path / "menu.json"

def get_config_file(restaurant_id: str, data_path: str = "./data/ar") -> Path:
    """Получить путь к файлу config.json"""
    rest_path = get_restaurant_path(restaurant_id, data_path)
    return rest_path / "config.json"

def get_images_path(restaurant_id: str, data_path: str = "./data/ar") -> Path:
    """Получить путь к папке с изображениями"""
    rest_path = get_restaurant_path(restaurant_id, data_path)
    return rest_path / "images"

def ensure_restaurant_structure(restaurant_id: str, data_path: str = "./data/ar"):
    """Создать структуру папок для ресторана если её нет"""
    rest_path = get_restaurant_path(restaurant_id, data_path)
    images_path = get_images_path(restaurant_id, data_path)
    
    rest_path.mkdir(parents=True, exist_ok=True)
    images_path.mkdir(parents=True, exist_ok=True)

def load_menu(restaurant_id: str, data_path: str = "./data/ar") -> Dict[str, Any]:
    """Загрузить меню из JSON"""
    menu_file = get_menu_file(restaurant_id, data_path)
    
    if not menu_file.exists():
        return {
            "restaurant_id": restaurant_id,
            "categories": [],
            "items": []
        }
    
    try:
        with open(menu_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Ошибка загрузки меню: {e}")
        return {
            "restaurant_id": restaurant_id,
            "categories": [],
            "items": []
        }

def save_menu(restaurant_id: str, menu_data: Dict[str, Any], data_path: str = "./data/ar"):
    """Сохранить меню в JSON"""
    ensure_restaurant_structure(restaurant_id, data_path)
    menu_file = get_menu_file(restaurant_id, data_path)
    
    try:
        with open(menu_file, 'w', encoding='utf-8') as f:
            json.dump(menu_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"❌ Ошибка сохранения меню: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения: {str(e)}")

def load_config(restaurant_id: str, data_path: str = "./data/ar") -> Dict[str, Any]:
    """Загрузить конфиг ресторана"""
    config_file = get_config_file(restaurant_id, data_path)
    
    if not config_file.exists():
        return {
            "restaurant_id": restaurant_id,
            "name": "Ресторан",
            "logo": None,
            "phone": None,
            "address": None,
            "delivery": None
        }
    
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Ошибка загрузки конфига: {e}")
        return {}

def save_config(restaurant_id: str, config_data: Dict[str, Any], data_path: str = "./data/ar"):
    """Сохранить конфиг ресторана"""
    ensure_restaurant_structure(restaurant_id, data_path)
    config_file = get_config_file(restaurant_id, data_path)
    
    try:
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"❌ Ошибка сохранения конфига: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения: {str(e)}")

# ============================================
# ROUTER
# ============================================

def create_menu_router(data_path: str = "./data/ar") -> APIRouter:
    """Создать router для меню API"""
    router = APIRouter(prefix="/api/restaurants", tags=["menu"])

    # ============ GET ENDPOINTS ============

    @router.get("")
    async def get_restaurants():
        """Получить список всех ресторанов"""
        try:
            restaurants_path = Path(data_path) / "restaurants"
            if not restaurants_path.exists():
                return {"restaurants": []}
            
            restaurants = []
            for rest_dir in restaurants_path.iterdir():
                if rest_dir.is_dir():
                    config_file = rest_dir / "config.json"
                    if config_file.exists():
                        with open(config_file, 'r', encoding='utf-8') as f:
                            config = json.load(f)
                            restaurants.append({
                                "id": rest_dir.name,
                                "restaurant_id": config.get("restaurant_id", rest_dir.name),
                                "name": config.get("name", rest_dir.name),
                                "description": config.get("description"),
                                "info_text": config.get("info_text"),
                                "address": config.get("address"),
                                "phone": config.get("phone"),
                                "logo": config.get("logo"),
                                "payment_qr_url": config.get("payment_qr_url"),
                                "admin_ids": config.get("admin_ids", []),
                                "manager_username": config.get("manager_username"),
                                "theme": config.get("theme"),
                                "created_at": config.get("created_at"),
                            })
            
            return {"restaurants": restaurants}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/{restaurant_id}/menu")
    async def get_menu(restaurant_id: str):
        """Получить меню ресторана"""
        try:
            menu = load_menu(restaurant_id, data_path)
            return menu
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/{restaurant_id}/config")
    async def get_config(restaurant_id: str):
        """Получить конфиг ресторана"""
        try:
            config = load_config(restaurant_id, data_path)
            return config
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ============ POST ENDPOINTS ============

    @router.post("/{restaurant_id}/upload-logo")
    async def upload_restaurant_logo(
        restaurant_id: str,
        logo: UploadFile = File(...)
    ):
        """Загрузить логотип ресторана"""
        try:
            if not restaurant_id:
                raise HTTPException(status_code=400, detail="restaurant_id обязателен")
            
            if not logo.filename:
                raise HTTPException(status_code=400, detail="Файл не выбран")
            
            if not logo.content_type or not logo.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="Файл должен быть изображением")
            
            # Создаём папку для логотипов
            from pathlib import Path as P
            import shutil
            root_path = P(__file__).parent.parent
            
            # Save to public/ directory (served as static files by nginx)
            public_logos_path = root_path / "public" / "images_web" / "restaurant_logos"
            public_logos_path.mkdir(parents=True, exist_ok=True)
            
            # Also save to backend data directory (backup)
            backend_logos_path = root_path / "backend" / "data" / "ar" / "restaurant_logos"
            backend_logos_path.mkdir(parents=True, exist_ok=True)
            
            # Сохраняем логотип
            ext = P(logo.filename).suffix
            filename = f"{restaurant_id}_logo{ext}"
            
            contents = await logo.read()
            
            # Save to public/ (web-accessible via Vite build)
            public_filepath = public_logos_path / filename
            with open(public_filepath, 'wb') as f:
                f.write(contents)
            
            # Save to backend data/ (backup)
            backend_filepath = backend_logos_path / filename
            with open(backend_filepath, 'wb') as f:
                f.write(contents)
            
            # Also copy to dist/ if it exists (for immediate availability without rebuild)
            dist_logos_path = root_path / "dist" / "images_web" / "restaurant_logos"
            if root_path.joinpath("dist").exists():
                dist_logos_path.mkdir(parents=True, exist_ok=True)
                dist_filepath = dist_logos_path / filename
                with open(dist_filepath, 'wb') as f:
                    f.write(contents)
            
            logo_path = f"restaurant_logos/{filename}"
            print(f"✅ Logo saved to public/: {public_filepath}")
            print(f"✅ Logo saved to backend/: {backend_filepath}")
            
            # Update config with new logo path
            current_config = load_config(restaurant_id, data_path)
            current_config["logo"] = logo_path
            save_config(restaurant_id, current_config, data_path)
            
            return {"logo_path": logo_path}
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error uploading logo: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/{restaurant_id}/upload-qr")
    async def upload_payment_qr(
        restaurant_id: str,
        qr: UploadFile = File(...)
    ):
        """Загрузить QR-код для оплаты (PromptPay)"""
        try:
            if not qr.filename:
                raise HTTPException(status_code=400, detail="Файл не выбран")
            
            if not qr.content_type or not qr.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="Файл должен быть изображением")
            
            from pathlib import Path as P
            import shutil
            root_path = P(__file__).parent.parent
            
            # Save to public/ directory (served as static files)
            public_qr_path = root_path / "public" / "images_web" / "restaurants" / restaurant_id
            public_qr_path.mkdir(parents=True, exist_ok=True)
            
            # Also save to backend data directory
            backend_qr_path = root_path / "backend" / "data" / "ar" / "restaurants" / restaurant_id / "images"
            backend_qr_path.mkdir(parents=True, exist_ok=True)
            
            # Save QR image
            ext = P(qr.filename).suffix
            filename = f"qr_promptpay{ext}"
            
            contents = await qr.read()
            
            # Save to public/
            public_filepath = public_qr_path / filename
            with open(public_filepath, 'wb') as f:
                f.write(contents)
            
            # Save to backend data/
            backend_filepath = backend_qr_path / filename
            with open(backend_filepath, 'wb') as f:
                f.write(contents)
            
            # Also copy to dist/ if it exists
            dist_qr_path = root_path / "dist" / "images_web" / "restaurants" / restaurant_id
            if root_path.joinpath("dist").exists():
                dist_qr_path.mkdir(parents=True, exist_ok=True)
                dist_filepath = dist_qr_path / filename
                with open(dist_filepath, 'wb') as f:
                    f.write(contents)
            
            qr_path = f"/images_web/restaurants/{restaurant_id}/{filename}"
            print(f"✅ Payment QR saved to public/: {public_filepath}")
            
            # Update config with new QR path
            current_config = load_config(restaurant_id, data_path)
            current_config["payment_qr_url"] = qr_path
            save_config(restaurant_id, current_config, data_path)
            
            return {"qr_path": qr_path}
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error uploading payment QR: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("")
    async def create_restaurant(
        restaurant_id: str = Form(...),
        name: str = Form(...),
        address: str = Form(...),
        phone: str = Form(...),
        logo: UploadFile = File(None)
    ):
        """Создать новый ресторан"""
        try:
            if not restaurant_id or not name:
                raise HTTPException(status_code=400, detail="restaurant_id и name обязательны")
            
            # Создаём структуру папок
            ensure_restaurant_structure(restaurant_id, data_path)
            
            # Обработка логотипа если он загружен
            logo_path = None
            if logo and logo.filename:
                upload_dir = Path(data_path) / "restaurant_logos"
                upload_dir.mkdir(parents=True, exist_ok=True)
                
                # Получаем расширение файла
                ext = Path(logo.filename).suffix if '.' in logo.filename else '.png'
                logo_filename = f"{restaurant_id}_logo{ext}"
                logo_file_path = upload_dir / logo_filename
                
                # Сохраняем файл
                contents = await logo.read()
                with open(logo_file_path, 'wb') as f:
                    f.write(contents)
                
                # Также сохраняем в public/images_web/restaurant_logos/
                root_path = Path(data_path).parent.parent
                public_upload_dir = root_path / "public" / "images_web" / "restaurant_logos"
                public_upload_dir.mkdir(parents=True, exist_ok=True)
                public_logo_path = public_upload_dir / logo_filename
                with open(public_logo_path, 'wb') as f:
                    f.write(contents)
                
                logo_path = f"restaurant_logos/{logo_filename}"
            
            # Создаём config.json
            config = {
                "restaurant_id": restaurant_id,
                "name": name,
                "address": address,
                "phone": phone,
                "logo": logo_path,
                "created_at": datetime.now().isoformat()
            }
            save_config(restaurant_id, config, data_path)
            
            # Создаём пустой menu.json
            menu = {
                "restaurant_id": restaurant_id,
                "categories": [],
                "items": []
            }
            save_menu(restaurant_id, menu, data_path)
            
            # Обновляем restaurants.json
            restaurants_file = Path(data_path) / "restaurants.json"
            restaurants = []
            
            if restaurants_file.exists():
                try:
                    with open(restaurants_file, 'r', encoding='utf-8') as f:
                        restaurants = json.load(f)
                except:
                    restaurants = []
            
            # Проверяем что ресторана нет
            if not any(r.get("restaurant_id") == restaurant_id for r in restaurants):
                restaurants.append(config)
                
                # Сохраняем обновленный список
                restaurants_file.parent.mkdir(parents=True, exist_ok=True)
                with open(restaurants_file, 'w', encoding='utf-8') as f:
                    json.dump(restaurants, f, ensure_ascii=False, indent=2)
            
            print(f"✅ Restaurant created: {restaurant_id}")
            return {"status": "ok", "restaurant": config}
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error creating restaurant: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.delete("/{restaurant_id}")
    async def delete_restaurant(restaurant_id: str):
        """Удалить ресторан со всеми данными"""
        try:
            # Удаляем папку ресторана
            rest_path = get_restaurant_path(restaurant_id, data_path)
            if rest_path.exists():
                shutil.rmtree(rest_path)
                print(f"✅ Restaurant folder deleted: {rest_path}")
            
            # Удаляем логотип если есть
            logo_dir = Path(data_path) / "restaurant_logos"
            if logo_dir.exists():
                for logo_file in logo_dir.glob(f"{restaurant_id}_logo*"):
                    logo_file.unlink()
                    print(f"✅ Logo deleted: {logo_file}")
            
            # Также удаляем из public/
            root_path = Path(data_path).parent.parent
            public_logo_dir = root_path / "public" / "images_web" / "restaurant_logos"
            if public_logo_dir.exists():
                for logo_file in public_logo_dir.glob(f"{restaurant_id}_logo*"):
                    logo_file.unlink()
                    print(f"✅ Public logo deleted: {logo_file}")
            
            # Удаляем из restaurants.json
            restaurants_file = Path(data_path) / "restaurants.json"
            if restaurants_file.exists():
                try:
                    with open(restaurants_file, 'r', encoding='utf-8') as f:
                        restaurants = json.load(f)
                    
                    # Фильтруем ресторан
                    restaurants = [r for r in restaurants if r.get("restaurant_id") != restaurant_id]
                    
                    # Сохраняем обновленный список
                    with open(restaurants_file, 'w', encoding='utf-8') as f:
                        json.dump(restaurants, f, ensure_ascii=False, indent=2)
                    print(f"✅ Restaurant removed from restaurants.json: {restaurant_id}")
                except Exception as e:
                    print(f"⚠️ Error updating restaurants.json: {e}")
            
            print(f"✅ Restaurant deleted: {restaurant_id}")
            return {"status": "ok", "message": f"Restaurant {restaurant_id} deleted"}
        except Exception as e:
            print(f"❌ Error deleting restaurant: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/{restaurant_id}/menu")
    async def create_menu_item(restaurant_id: str, item: MenuItem):
        """Добавить новое блюдо в меню"""
        try:
            menu = load_menu(restaurant_id, data_path)
            
            # Проверить что ID уникален
            if any(i["id"] == item.id for i in menu.get("items", [])):
                raise HTTPException(status_code=400, detail="Блюдо с таким ID уже существует")
            
            # Добавить категорию если её нет
            if item.category not in menu.get("categories", []):
                menu.setdefault("categories", []).append(item.category)
            
            # Добавить блюдо
            item_dict = item.dict()
            item_dict["updated_at"] = datetime.now().isoformat()
            menu.setdefault("items", []).append(item_dict)
            
            save_menu(restaurant_id, menu, data_path)
            
            return {"status": "ok", "item": item_dict}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/{restaurant_id}/upload-menu-photos")
    async def upload_menu_photos(
        restaurant_id: str,
        menu_id: str = Form(...),
        photos: List[UploadFile] = File(...)
    ):
        """Загрузить фото для блюда"""
        try:
            # Валидация входных данных
            if not restaurant_id or not menu_id:
                raise HTTPException(status_code=400, detail="restaurant_id и menu_id обязательны")
            
            if not photos or len(photos) == 0:
                raise HTTPException(status_code=400, detail="Не выбраны файлы для загрузки")
            
            # Используем папку public/images_web для статики
            from pathlib import Path as P
            import os
            
            # Получаем корень проекта (на уровень выше backend/)
            root_path = P(__file__).parent.parent
            images_path = root_path / "public" / "images_web" / "restaurants" / restaurant_id
            
            # Создаём папку если её нет
            images_path.mkdir(parents=True, exist_ok=True)
            
            uploaded_paths = []
            
            for photo in photos:
                if not photo.filename:
                    continue
                
                # Валидация типа файла
                if not photo.content_type or not photo.content_type.startswith("image/"):
                    print(f"⚠️ Skipping non-image file: {photo.filename}")
                    continue
                
                # Генерируем имя файла
                ext = P(photo.filename).suffix
                filename = f"{menu_id}_{len(uploaded_paths)}{ext}"
                filepath = images_path / filename
                
                try:
                    # Сохраняем файл
                    contents = await photo.read()
                    with open(filepath, 'wb') as f:
                        f.write(contents)
                    
                    # Возвращаем относительный путь для images_web
                    relative_path = f"restaurants/{restaurant_id}/{filename}"
                    uploaded_paths.append(relative_path)
                    print(f"✅ Photo saved: {relative_path}")
                except Exception as e:
                    print(f"❌ Error saving photo: {e}")
                    raise HTTPException(status_code=500, detail=f"Ошибка загрузки фото: {str(e)}")
            
            # Проверяем что хотя бы одно фото загружено
            if not uploaded_paths:
                raise HTTPException(status_code=400, detail="Не удалось загрузить ни одного фото")
            
            print(f"✅ Menu item {menu_id} in restaurant {restaurant_id} updated with {len(uploaded_paths)} photos")
            
            # Возвращаем JSON в формате, ожидаемом фронтенд
            return {"uploaded": uploaded_paths, "count": len(uploaded_paths)}
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error uploading menu photos: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))

    # ============ PUT ENDPOINTS ============

    @router.put("/{restaurant_id}")
    async def update_restaurant(restaurant_id: str, config: Dict[str, Any]):
        """Обновить данные ресторана"""
        try:
            # Загрузить текущий конфиг
            current_config = load_config(restaurant_id, data_path)
            
            # Обновить только переданные поля
            for key, value in config.items():
                if value is not None:
                    current_config[key] = value
            
            # Сохранить обновлённый конфиг
            save_config(restaurant_id, current_config, data_path)
            
            # Также обновить restaurants.json
            restaurants_file = Path(data_path) / "restaurants.json"
            if restaurants_file.exists():
                try:
                    with open(restaurants_file, 'r', encoding='utf-8') as f:
                        restaurants = json.load(f)
                    
                    for i, r in enumerate(restaurants):
                        if r.get("restaurant_id") == restaurant_id:
                            # Обновляем поля в restaurants.json
                            for key, value in config.items():
                                if value is not None:
                                    restaurants[i][key] = value
                            break
                    
                    with open(restaurants_file, 'w', encoding='utf-8') as f:
                        json.dump(restaurants, f, ensure_ascii=False, indent=2)
                except Exception as e:
                    print(f"⚠️ Ошибка обновления restaurants.json: {e}")
            
            print(f"✅ Restaurant updated: {restaurant_id}")
            return {"status": "ok", "restaurant": current_config}
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error updating restaurant: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.put("/{restaurant_id}/menu/{menu_id}")
    async def update_menu_item(restaurant_id: str, menu_id: str, item: MenuItem):
        """Обновить блюдо в меню"""
        try:
            menu = load_menu(restaurant_id, data_path)
            
            # Найти блюдо
            item_index = None
            for idx, i in enumerate(menu.get("items", [])):
                if i["id"] == menu_id:
                    item_index = idx
                    break
            
            if item_index is None:
                raise HTTPException(status_code=404, detail="Блюдо не найдено")
            
            # Обновить блюдо
            item_dict = item.dict()
            item_dict["updated_at"] = datetime.now().isoformat()
            menu["items"][item_index] = item_dict
            
            # Добавить категорию если её нет
            if item.category not in menu.get("categories", []):
                menu.setdefault("categories", []).append(item.category)
            
            save_menu(restaurant_id, menu, data_path)
            
            return {"status": "ok", "item": item_dict}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ============ DELETE ENDPOINTS ============

    @router.delete("/{restaurant_id}/menu/{menu_id}")
    async def delete_menu_item(restaurant_id: str, menu_id: str):
        """Удалить блюдо из меню"""
        try:
            menu = load_menu(restaurant_id, data_path)
            
            # Найти и удалить блюдо
            original_count = len(menu.get("items", []))
            menu["items"] = [i for i in menu.get("items", []) if i["id"] != menu_id]
            
            if len(menu["items"]) == original_count:
                raise HTTPException(status_code=404, detail="Блюдо не найдено")
            
            save_menu(restaurant_id, menu, data_path)
            
            return {"status": "ok", "message": "Блюдо удалено"}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return router
