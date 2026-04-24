import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Edit, Trash2, Search, Package, Upload,
  DollarSign, Tag, X, Save, Image as ImageIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreateRestaurantModal from '@/components/CreateRestaurantModal';
import { CATEGORY_ICONS } from '@/data/categoryIcons.tsx';

const API_URL = import.meta.env.VITE_API_URL || "https://weldwood.sunny-rentals.online";

const getImageUrl = (path: string | undefined, timestamp?: number): string => {
  if (!path) return "/placeholder.svg";
  if (path.startsWith("http")) return path;
  const ts = timestamp !== undefined ? timestamp : Date.now();
  
  // Absolute path starting with / — use as-is
  if (path.startsWith("/")) {
    return `${path}?t=${ts}`;
  }
  
  // Для фото ресторанов (restaurants/...)
  if (path.startsWith("restaurants/")) {
    return `/images_web/${path}?t=${ts}`;
  }
  
  // Для обычных фото (images_web/...)
  if (path.startsWith("images_web/")) {
    return `/images_web/${path.replace("images_web/", "")}?t=${ts}`;
  }
  
  // Для фото без префикса
  return `/images_web/${path}?t=${ts}`;
};

const slugify = (text: string) => {
  const ru = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ы': 'y', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  return text.toLowerCase().split('').map(c => ru[c] || (/[a-z0-9]/.test(c) ? c : '_')).join('').replace(/_+/g, '_');
};


interface Ingredient {
  id: string;
  name: string;
  price: number;
}

interface MenuItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  weight: string;
  image: string;
  ingredients?: Ingredient[];
  available: boolean;
  notes: string;
  photos: { main?: string; gallery?: string[] };
  updated_at?: string;
}

interface Restaurant {
  id: string;
  restaurant_id?: string;
  name: string;
  description?: string;
  info_text?: string;
  address?: string;
  phone?: string;
  logo?: string;
  payment_qr_url?: string;
  admin_ids?: string[];
  manager_username?: string;
  created_at?: string;
}

export default function MenuManager() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [photoTimestamp, setPhotoTimestamp] = useState<number>(Date.now());
  const [isCreateRestaurantOpen, setIsCreateRestaurantOpen] = useState(false);
  const [isEditRestaurantOpen, setIsEditRestaurantOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [restaurantFormData, setRestaurantFormData] = useState<Partial<Restaurant>>({});

  const [formData, setFormData] = useState<Partial<MenuItem>>({});

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (selectedRestaurant) {
      fetchMenuItems();
    }
  }, [selectedRestaurant]);

  const fetchRestaurants = async () => {
    try {
      const res = await fetch(`${API_URL}/api/restaurants`);
      const data = await res.json();
      setRestaurants(data.restaurants || []);
      if (data.restaurants?.length > 0) {
        setSelectedRestaurant(data.restaurants[0].id);
      }
    } catch (e) {
      console.error("Ошибка загрузки ресторанов", e);
    }
  };

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      const timestamp = Date.now();
      const res = await fetch(`${API_URL}/api/restaurants/${selectedRestaurant}/menu?t=${timestamp}`);
      const data = await res.json();
      setItems(data.items || []);
      setPhotoTimestamp(timestamp);
    } catch (e) {
      console.error("Ошибка загрузки меню", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (item: MenuItem | null) => {
    if (item) {
      setEditingItem(item);
      setFormData(item);
    } else {
      setEditingItem(null);
      setFormData({
        id: '',
        name: '',
        slug: '',
        category: 'pizza',
        price: 0,
        weight: '',
        image: '',
        ingredients: [],
        available: true,
        notes: '',
        photos: { main: '', gallery: [] }
      });
    }
    setIsEditOpen(true);
  };

  const handleSaveMenuItem = async () => {
    if (!selectedRestaurant) {
      alert('Выберите ресторан');
      return;
    }

    const isNew = !editingItem;
    const finalId = isNew ? slugify(formData.name || '') : editingItem.id;
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew 
      ? `${API_URL}/api/restaurants/${selectedRestaurant}/menu`
      : `${API_URL}/api/restaurants/${selectedRestaurant}/menu/${finalId}`;

    const payload = { ...formData, id: finalId, slug: finalId };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsEditOpen(false);
        fetchMenuItems();
      }
    } catch (e) {
      alert("Не удалось сохранить");
    }
  };

  const handleDeleteMenuItem = async (id: string) => {
    if (!confirm("Удалить это блюдо?")) return;
    try {
      await fetch(`${API_URL}/api/restaurants/${selectedRestaurant}/menu/${id}`, { method: 'DELETE' });
      fetchMenuItems();
    } catch (e) {
      alert("Ошибка при удалении");
    }
  };

  const handleUploadRestaurantLogo = async (file: File) => {
    if (!editingRestaurant) return;

    try {
      const formData = new FormData();
      formData.append('logo', file);

      const res = await fetch(`${API_URL}/api/restaurants/${editingRestaurant.restaurant_id || editingRestaurant.id}/upload-logo`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const newTimestamp = Date.now();
        setPhotoTimestamp(newTimestamp);
        setRestaurantFormData(prev => ({
          ...prev,
          logo: data.logo_path
        }));
        setUploadStatus('✅ Логотип загружен');
        setTimeout(() => setUploadStatus(''), 3000);
      } else {
        setUploadStatus('❌ Ошибка загрузки логотипа');
        setTimeout(() => setUploadStatus(''), 3000);
      }
    } catch (e) {
      console.error('Ошибка загрузки логотипа:', e);
      setUploadStatus('❌ Ошибка загрузки');
      setTimeout(() => setUploadStatus(''), 3000);
    }
  };

  const handleUploadPaymentQr = async (file: File) => {
    if (!editingRestaurant) return;

    try {
      const formData = new FormData();
      formData.append('qr', file);
      formData.append('restaurant_id', editingRestaurant.restaurant_id || editingRestaurant.id);

      const res = await fetch(`${API_URL}/api/restaurants/${editingRestaurant.restaurant_id || editingRestaurant.id}/upload-qr`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const newTimestamp = Date.now();
        setPhotoTimestamp(newTimestamp);
        setRestaurantFormData(prev => ({
          ...prev,
          payment_qr_url: data.qr_path
        }));
        setUploadStatus('✅ QR-код загружен');
        setTimeout(() => setUploadStatus(''), 3000);
      } else {
        setUploadStatus('❌ Ошибка загрузки QR');
        setTimeout(() => setUploadStatus(''), 3000);
      }
    } catch (e) {
      console.error('Ошибка загрузки QR:', e);
      setUploadStatus('❌ Ошибка загрузки');
      setTimeout(() => setUploadStatus(''), 3000);
    }
  };

  const handleSaveRestaurant = async () => {
    if (!editingRestaurant || !restaurantFormData.name) {
      alert('Заполните название ресторана');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/restaurants/${editingRestaurant.restaurant_id || editingRestaurant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restaurantFormData)
      });
      if (res.ok) {
        setIsEditRestaurantOpen(false);
        fetchRestaurants();
      } else {
        alert("Не удалось сохранить ресторан");
      }
    } catch (e) {
      alert("Ошибка при сохранении");
    }
  };

  const handleToggleAvailable = async (item: MenuItem) => {
    const updated = { ...item, available: !item.available };
    try {
      await fetch(`${API_URL}/api/restaurants/${selectedRestaurant}/menu/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    } catch (e) { console.error(e); }
  };

  const uploadMenuPhotos = async (files: File[], menuId: string, retryCount = 0): Promise<string[] | null> => {
    const maxRetries = 2;
    
    try {
      // Split large batches for mobile compatibility
      const isMobile = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
      const batchSize = isMobile ? 2 : 5; // Upload 2 files at a time on mobile, 5 on desktop
      const batches = [];
      
      for (let i = 0; i < files.length; i += batchSize) {
        batches.push(files.slice(i, i + batchSize));
      }
      
      console.log(`📱 Mobile: ${isMobile}, Batches: ${batches.length}, Batch size: ${batchSize}`);
      
      const allUploaded: string[] = [];
      
      // Upload each batch sequentially
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        const uploadFormData = new FormData();
        
        batch.forEach(file => uploadFormData.append('photos', file));
        uploadFormData.append('menu_id', menuId);
        uploadFormData.append('restaurant_id', selectedRestaurant);
        
        console.log(`📤 Uploading batch ${batchIdx + 1}/${batches.length} (${batch.length} files)...`);
        
        try {
          const res = await fetch(`${API_URL}/api/restaurants/${selectedRestaurant}/upload-menu-photos`, {
            method: 'POST',
            body: uploadFormData,
            signal: AbortSignal.timeout(60000), // 60 second timeout per batch
          });
          
          // Проверяем Content-Type ответа
          const contentType = res.headers.get('content-type');
          const isJson = contentType && contentType.includes('application/json');
          
          if (!res.ok) {
            let errorMessage = 'Upload failed';
            try {
              if (isJson) {
                const error = await res.json();
                errorMessage = error.detail || error.message || 'Upload failed';
              } else {
                const text = await res.text();
                errorMessage = text || `HTTP ${res.status}`;
              }
            } catch (parseErr) {
              errorMessage = `HTTP ${res.status}: ${res.statusText}`;
            }
            throw new Error(errorMessage);
          }
          
          // Парсим JSON с обработкой ошибок
          let data;
          try {
            data = await res.json();
          } catch (parseErr) {
            console.error('❌ JSON parse error. Response:', await res.text());
            throw new Error('Invalid JSON response from server');
          }
          
          if (!data.uploaded || !Array.isArray(data.uploaded)) {
            throw new Error('Invalid response format: missing uploaded array');
          }
          
          allUploaded.push(...data.uploaded);
          console.log(`✅ Batch ${batchIdx + 1} uploaded: ${data.uploaded.length} files`);
          
          // Small delay between batches to avoid overwhelming server
          if (batchIdx < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (batchErr: any) {
          console.error(`❌ Batch ${batchIdx + 1} error:`, batchErr.message);
          throw batchErr;
        }
      }
      
      return allUploaded;
    } catch (err: any) {
      console.error('❌ Photo upload error:', err.message);
      
      // Retry logic for network errors
      if (retryCount < maxRetries && (err.message.includes('timeout') || err.message.includes('network'))) {
        console.log(`🔄 Retrying upload (attempt ${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return uploadMenuPhotos(files, menuId, retryCount + 1);
      }
      
      throw err;
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const menuId = formData.id || slugify(formData.name || '');
    
    if (!menuId) {
      setUploadStatus('❌ Заполните название для загрузки фото');
      setTimeout(() => setUploadStatus(''), 5000);
      e.target.value = '';
      return;
    }

    // Валидация файлов
    const validFiles = files.filter(f => {
      const isImage = f.type.startsWith('image/');
      const isSmall = f.size <= 5 * 1024 * 1024; // 5MB
      if (!isImage) {
        console.warn(`⚠️ Файл ${f.name} не является изображением`);
      }
      if (!isSmall) {
        console.warn(`⚠️ Файл ${f.name} больше 5MB`);
      }
      return isImage && isSmall;
    });

    if (validFiles.length === 0) {
      setUploadStatus('❌ Выберите изображения (PNG, JPG, до 5MB)');
      setTimeout(() => setUploadStatus(''), 5000);
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    setUploadStatus(`Загружаю ${validFiles.length} фото...`);

    try {
      const uploadedPaths = await uploadMenuPhotos(validFiles, menuId);
      
      if (uploadedPaths && uploadedPaths.length > 0) {
        const newTimestamp = Date.now();
        setPhotoTimestamp(newTimestamp);
        
        const currentPhotos = formData.photos || { main: '', gallery: [] };
        const newPhotos = {
          main: currentPhotos.main || uploadedPaths[0],
          gallery: [...(currentPhotos.gallery || []), ...uploadedPaths.slice(1)]
        };
        
        setFormData(prev => ({
          ...prev,
          photos: newPhotos,
          image: uploadedPaths[0],
          updated_at: new Date(newTimestamp).toISOString()
        }));
        
        if (editingItem) {
          setEditingItem(prev => prev ? {
            ...prev,
            photos: newPhotos,
            image: uploadedPaths[0],
            updated_at: new Date(newTimestamp).toISOString()
          } : null);
        }
        
        setUploadStatus(`✅ Загружено: ${uploadedPaths.length} фото`);
        setTimeout(() => setUploadStatus(''), 3000);
      }
      
      setTimeout(() => fetchMenuItems(), 1000);
    } catch (err: any) {
      console.error('❌ Ошибка загрузки:', err);
      const errorMsg = err.message || 'Неизвестная ошибка';
      setUploadStatus(`❌ Ошибка: ${errorMsg}`);
      setTimeout(() => setUploadStatus(''), 5000);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [items, searchQuery, selectedCategory]);

  if (loading) return (
    <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b shadow-sm p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold tracking-tight">MENU <span className="text-orange-600">MANAGER</span></h1>
            <div className="flex gap-2">
              <Button onClick={() => setIsCreateRestaurantOpen(true)} size="sm" className="h-9 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-1" /> Ресторан
              </Button>
              <Button onClick={() => handleOpenEdit(null)} size="sm" className="h-9 bg-orange-600 hover:bg-orange-700">
                <Plus className="h-4 w-4 mr-1" /> Блюдо
              </Button>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
              <SelectTrigger className="w-[200px] h-10 bg-slate-100 border-none">
                <SelectValue placeholder="Выбери ресторан" />
              </SelectTrigger>
              <SelectContent>
                {restaurants.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRestaurant && (
              <Button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_URL}/api/restaurants/${selectedRestaurant}/config`);
                    if (res.ok) {
                      const config = await res.json();
                      const restaurant: Restaurant = {
                        id: selectedRestaurant,
                        restaurant_id: config.restaurant_id || selectedRestaurant,
                        name: config.name || selectedRestaurant,
                        description: config.description || '',
                        info_text: config.info_text || '',
                        address: config.address || '',
                        phone: config.phone || '',
                        logo: config.logo || '',
                        payment_qr_url: config.payment_qr_url || '',
                        admin_ids: config.admin_ids || [],
                        manager_username: config.manager_username || '',
                        created_at: config.created_at || '',
                      };
                      setEditingRestaurant(restaurant);
                      setRestaurantFormData(restaurant);
                      setIsEditRestaurantOpen(true);
                    }
                  } catch (e) {
                    console.error('Ошибка загрузки конфига ресторана', e);
                  }
                }}
                size="sm"
                variant="outline"
                className="h-10 border-slate-300"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Поиск по названию..." 
                className="pl-9 h-10 bg-slate-100 border-none focus-visible:ring-orange-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[160px] h-10 bg-slate-100 border-none flex items-center gap-2">
                {selectedCategory !== 'all' && selectedCategory && CATEGORY_ICONS[selectedCategory] && (
                  <div className="flex items-center gap-1">
                    {CATEGORY_ICONS[selectedCategory].icon}
                  </div>
                )}
                <SelectValue placeholder="Категория" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все блюда</SelectItem>
                {Object.entries(CATEGORY_ICONS).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      {v.icon}
                      <span>{v.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* MENU GRID */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredItems.map(item => (
            <Card key={item.id} className="group relative overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl bg-white">
              <div className="relative h-36 bg-slate-200 overflow-hidden">
                <img
                    src={getImageUrl(item.image, photoTimestamp)}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    alt={item.name}
                    onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
                  />
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {!item.available && <Badge variant="destructive" className="text-[10px] uppercase">Скрыт</Badge>}
                </div>
                
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full shadow-lg" onClick={() => handleOpenEdit(item)}>
                    <Edit className="h-4 w-4 text-slate-700" />
                  </Button>
                  <Button size="icon" variant="destructive" className="h-9 w-9 rounded-full shadow-lg" onClick={() => handleDeleteMenuItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <CardContent className="p-3 space-y-2">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-sm text-slate-800 line-clamp-1 leading-tight">{item.name}</h3>
                  <div className="flex items-center gap-1">
                    {CATEGORY_ICONS[item.category as keyof typeof CATEGORY_ICONS]?.icon}
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      {CATEGORY_ICONS[item.category as keyof typeof CATEGORY_ICONS]?.label}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <div className="flex flex-col">
                    <span className="text-orange-600 font-extrabold text-base leading-none">
                      {item.price.toLocaleString()} ฿
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{item.weight}</span>
                  </div>
                  <Switch 
                    checked={item.available} 
                    onCheckedChange={() => handleToggleAvailable(item)}
                    className="data-[state=checked]:bg-green-500 scale-75"
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          {/* ADD CARD */}
          <button 
            onClick={() => handleOpenEdit(null)}
            className="h-full min-h-[220px] rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 hover:border-orange-500 hover:bg-orange-50 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-orange-100 flex items-center justify-center transition-colors">
              <Plus className="h-6 w-6 text-slate-400 group-hover:text-orange-600" />
            </div>
            <span className="text-xs font-bold text-slate-500 group-hover:text-orange-600">НОВОЕ БЛЮДО</span>
          </button>
        </div>
      </div>

      {/* EDIT SHEET */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent side="bottom" className="h-[85vh] sm:h-auto sm:max-h-[90vh] overflow-y-auto p-0 sm:rounded-t-xl sm:max-w-2xl">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-2" />
          <SheetHeader className="px-6 pb-2">
            <SheetTitle className="text-2xl font-black flex items-center gap-2">
              {editingItem ? <Edit className="text-orange-600" /> : <Plus className="text-orange-600" />}
              {editingItem ? 'РЕДАКТИРОВАНИЕ' : 'НОВОЕ БЛЮДО'}
            </SheetTitle>
          </SheetHeader>

          <div className="px-6 py-4 space-y-6 pb-12">
            <Tabs defaultValue="main" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-xl">
                <TabsTrigger value="main" className="rounded-lg font-bold text-xs">ОСНОВНОЕ</TabsTrigger>
                <TabsTrigger value="ingredients" className="rounded-lg font-bold text-xs">ИНГРЕДИЕНТЫ</TabsTrigger>
                <TabsTrigger value="photos" className="rounded-lg font-bold text-xs">ФОТО</TabsTrigger>
              </TabsList>

              <TabsContent value="main" className="mt-4 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 ml-1">НАЗВАНИЕ</Label>
                    <Input
                      value={formData.name}
                      placeholder="Маргарита"
                      className="h-12 rounded-xl bg-slate-50 border-none text-lg font-bold focus-visible:ring-orange-500"
                      onChange={(e) => {
                        const name = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          name,
                          id: !editingItem ? slugify(name) : prev.id,
                          slug: !editingItem ? slugify(name) : prev.slug
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 ml-1">КАТЕГОРИЯ</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                    >
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none font-bold flex items-center gap-2">
                        {formData.category && CATEGORY_ICONS[formData.category] && (
                          <div className="flex items-center gap-2">
                            {CATEGORY_ICONS[formData.category].icon}
                            <SelectValue />
                          </div>
                        )}
                        {!formData.category && <SelectValue />}
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_ICONS).map(([k, v]) => (
                          <SelectItem key={k} value={k} className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                              {v.icon}
                              <span>{v.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 ml-1">ЦЕНА (฿)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-600" />
                      <Input
                        type="number"
                        value={formData.price}
                        className="h-12 pl-9 rounded-xl bg-slate-50 border-none font-black text-xl text-orange-600"
                        onChange={(e) => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 ml-1">ВЕС / РАЗМЕР</Label>
                    <Input
                      value={formData.weight}
                      placeholder="350г"
                      className="h-12 rounded-xl bg-slate-50 border-none font-bold"
                      onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 ml-1">ОПИСАНИЕ / ЗАМЕТКИ</Label>
                  <Textarea
                    value={formData.notes}
                    className="rounded-xl bg-slate-50 border-none min-h-[100px] font-medium"
                    placeholder="Укажи состав или особенности..."
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </TabsContent>

              <TabsContent value="ingredients" className="mt-4 space-y-4">
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                  <h4 className="text-xs font-black text-blue-800 flex items-center gap-2 mb-4 uppercase tracking-widest">
                    <Tag className="h-4 w-4" /> Ингредиенты (опционально)
                  </h4>
                  <div className="space-y-3">
                    {(formData.ingredients || []).map((ing, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-slate-200">
                        <Input
                          value={ing.name}
                          placeholder="Название ингредиента"
                          className="flex-1 h-9 rounded-lg bg-white border-slate-200 text-sm font-bold"
                          onChange={(e) => {
                            const newIngs = [...(formData.ingredients || [])];
                            newIngs[idx].name = e.target.value;
                            setFormData(prev => ({ ...prev, ingredients: newIngs }));
                          }}
                        />
                        <Input
                          type="number"
                          value={ing.price}
                          placeholder="Цена"
                          className="w-20 h-9 rounded-lg bg-white border-slate-200 text-sm font-bold"
                          onChange={(e) => {
                            const newIngs = [...(formData.ingredients || [])];
                            newIngs[idx].price = Number(e.target.value);
                            setFormData(prev => ({ ...prev, ingredients: newIngs }));
                          }}
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-9 w-9"
                          onClick={() => {
                            const newIngs = formData.ingredients?.filter((_, i) => i !== idx) || [];
                            setFormData(prev => ({ ...prev, ingredients: newIngs }));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl border-slate-300"
                      onClick={() => {
                        const newIngs = [...(formData.ingredients || []), { id: `ing_${Date.now()}`, name: '', price: 0 }];
                        setFormData(prev => ({ ...prev, ingredients: newIngs }));
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Добавить ингредиент
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="photos" className="mt-4 space-y-4 py-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={isUploading || !formData.name}
                  className="hidden"
                  id="photo-upload"
                />
                
                <div className="text-center space-y-3">
                  <ImageIcon className="h-12 w-12 text-slate-300 mx-auto" />
                  <div className="space-y-1">
                    <p className="font-bold text-slate-600">Управление медиа</p>
                    <p className="text-xs text-slate-400">
                      {!formData.name ? 'Заполните название' : 'PNG, JPG — до 5MB'}
                    </p>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-slate-300"
                    disabled={isUploading || !formData.name}
                    onClick={() => document.getElementById('photo-upload')?.click()}
                  >
                    {isUploading ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        {uploadStatus || 'Загрузка...'}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" /> Загрузить фото
                      </>
                    )}
                  </Button>
                </div>

                {formData.image && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-xs font-bold text-slate-500 mb-2">Текущее фото:</p>
                    <div className="flex gap-2">
                      <div className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-slate-200">
                        <img
                          src={getImageUrl(formData.image, photoTimestamp)}
                          className="w-full h-full object-cover"
                          alt="Main"
                          onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex gap-3 pt-4 border-t">
              <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-bold text-slate-500" onClick={() => setIsEditOpen(false)}>
                ОТМЕНА
              </Button>
              <Button
                className="flex-[2] h-14 rounded-2xl bg-orange-600 hover:bg-orange-700 font-black text-lg shadow-xl shadow-orange-200 active:scale-95 transition-all"
                onClick={handleSaveMenuItem}
              >
                <Save className="h-5 w-5 mr-2" /> СОХРАНИТЬ
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* EDIT RESTAURANT SHEET */}
      <Sheet open={isEditRestaurantOpen} onOpenChange={setIsEditRestaurantOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto p-0 sm:rounded-t-xl sm:max-w-2xl">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-2" />
          <SheetHeader className="px-6 pb-2">
            <SheetTitle className="text-2xl font-black flex items-center gap-2">
              <Edit className="text-orange-600" />
              РЕДАКТИРОВАНИЕ РЕСТОРАНА
            </SheetTitle>
          </SheetHeader>

          <div className="px-6 py-4 space-y-6 pb-12">
            {/* ID (Read-only) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">ID РЕСТОРАНА (не редактируется)</Label>
              <Input
                value={editingRestaurant?.restaurant_id || editingRestaurant?.id || ''}
                disabled
                className="h-12 rounded-xl bg-slate-100 border-none text-lg font-bold text-slate-400"
              />
            </div>

            {/* Название */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">НАЗВАНИЕ РЕСТОРАНА</Label>
              <Input
                value={restaurantFormData.name || ''}
                placeholder="Название ресторана"
                className="h-12 rounded-xl bg-slate-50 border-none text-lg font-bold focus-visible:ring-orange-500"
                onChange={(e) => setRestaurantFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* Адрес */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">АДРЕС</Label>
              <Input
                value={restaurantFormData.address || ''}
                placeholder="Адрес ресторана"
                className="h-12 rounded-xl bg-slate-50 border-none text-lg font-bold focus-visible:ring-orange-500"
                onChange={(e) => setRestaurantFormData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>

            {/* Телефон */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">ТЕЛЕФОН</Label>
              <Input
                value={restaurantFormData.phone || ''}
                placeholder="+66..."
                className="h-12 rounded-xl bg-slate-50 border-none text-lg font-bold focus-visible:ring-orange-500"
                onChange={(e) => setRestaurantFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            {/* Описание */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">ОПИСАНИЕ</Label>
              <Input
                value={restaurantFormData.description || ''}
                placeholder="Authentic Italian Pizza & Pasta"
                className="h-12 rounded-xl bg-slate-50 border-none text-lg font-bold focus-visible:ring-orange-500"
                onChange={(e) => setRestaurantFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* Информация о компании */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">ИНФОРМАЦИЯ О КОМПАНИИ</Label>
              <Input
                value={restaurantFormData.info_text || ''}
                placeholder="Open daily 11:00–23:00 · Chiang Mai, soi 3"
                className="h-12 rounded-xl bg-slate-50 border-none text-lg font-bold focus-visible:ring-orange-500"
                onChange={(e) => setRestaurantFormData(prev => ({ ...prev, info_text: e.target.value }))}
              />
            </div>

            {/* QR-код для оплаты */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">QR-КОД ДЛЯ ОПЛАТЫ (PROMPT PAY)</Label>
              <div className="space-y-3">
                {restaurantFormData.payment_qr_url && (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-slate-200">
                    <img
                      src={getImageUrl(restaurantFormData.payment_qr_url, photoTimestamp)}
                      className="w-full h-full object-contain bg-white p-1"
                      alt="Payment QR"
                      onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="restaurant-qr-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleUploadPaymentQr(file);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-slate-300"
                  onClick={() => document.getElementById('restaurant-qr-upload')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" /> Загрузить QR
                </Button>
              </div>
            </div>

            {/* Администраторы */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">АДМИНИСТРАТОРЫ (Telegram ID через запятую)</Label>
              <Input
                value={(restaurantFormData.admin_ids || []).join(', ')}
                placeholder="5244326802, 123456789"
                className="h-12 rounded-xl bg-slate-50 border-none text-lg font-bold focus-visible:ring-orange-500"
                onChange={(e) => {
                  const val = e.target.value;
                  const ids = val.split(',').map(s => s.trim()).filter(Boolean);
                  setRestaurantFormData(prev => ({ ...prev, admin_ids: ids }));
                }}
              />
            </div>

            {/* Менеджер (Telegram username) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">МЕНЕДЖЕР (Telegram @username для связи клиентов)</Label>
              <Input
                value={restaurantFormData.manager_username || ''}
                placeholder="LoftFireBot"
                className="h-12 rounded-xl bg-slate-50 border-none text-lg font-bold focus-visible:ring-orange-500"
                onChange={(e) => setRestaurantFormData(prev => ({ ...prev, manager_username: e.target.value }))}
              />
            </div>

            {/* Логотип */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">ЛОГОТИП РЕСТОРАНА</Label>
              <div className="space-y-3">
                {restaurantFormData.logo && (
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-slate-200">
                    <img
                      src={getImageUrl(restaurantFormData.logo, photoTimestamp)}
                      className="w-full h-full object-cover"
                      alt="Logo"
                      onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="restaurant-logo-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleUploadRestaurantLogo(file);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-slate-300"
                  onClick={() => document.getElementById('restaurant-logo-upload')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" /> Загрузить логотип
                </Button>
                {uploadStatus && (
                  <p className="text-xs font-bold text-slate-600">{uploadStatus}</p>
                )}
              </div>
            </div>

            {/* Дата создания (Read-only) */}
            {restaurantFormData.created_at && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 ml-1">ДАТА СОЗДАНИЯ</Label>
                <Input
                  value={new Date(restaurantFormData.created_at).toLocaleString()}
                  disabled
                  className="h-12 rounded-xl bg-slate-100 border-none text-lg font-bold text-slate-400"
                />
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-bold text-slate-500" onClick={() => setIsEditRestaurantOpen(false)}>
                ОТМЕНА
              </Button>
              <Button
                className="flex-[2] h-14 rounded-2xl bg-orange-600 hover:bg-orange-700 font-black text-lg shadow-xl shadow-orange-200 active:scale-95 transition-all"
                onClick={handleSaveRestaurant}
              >
                <Save className="h-5 w-5 mr-2" /> СОХРАНИТЬ
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* CREATE RESTAURANT MODAL */}
      <CreateRestaurantModal
        open={isCreateRestaurantOpen}
        onOpenChange={setIsCreateRestaurantOpen}
        onRestaurantCreated={fetchRestaurants}
      />
    </div>
  );
}
