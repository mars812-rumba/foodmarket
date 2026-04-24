import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Edit, Trash2, Search, Package, Upload, AlertCircle,
  Check, X, Settings, User, DollarSign, Tag, Info, FileText,
  Hammer, Maximize, Palette, Activity, LayoutGrid, ExternalLink,
  ChevronRight, Save, Image as ImageIcon, Loader2
} from 'lucide-react';
import { STANDARD_SIZES, STANDARD_COLORS, FINISHES, attributeMeta, attributesByCategory } from '@/data/attributeIcons';

// UI Components (предполагаем, что они у тебя в @/components/ui)
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from '@/components/ui/checkbox';
import { CreateRestaurantModal } from '@/components/ui/CreateRestaurantModal';

const API_URL = import.meta.env.VITE_API_URL || "https://weldwood.sunny-rentals.online";

// --- Хелперы ---
const getImageUrl = (path: string | undefined, timestamp?: number): string => {
  if (!path) return "/placeholder.svg";
  if (path.startsWith("http")) return path;
  
  // Всегда добавляем кешбастер для свежести фото
  const ts = timestamp !== undefined ? timestamp : Date.now();
  
  // Бекенд маунтит /images_web напрямую, поэтому используем абсолютный путь
  if (path.startsWith("images_web/")) {
    return `/images_web/${path.replace("images_web/", "")}?t=${ts}`;
  }
  
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

const CATEGORIES = {
  grill: 'Мангалы',
  dog_cage: 'Вольеры',
  garden_furniture: 'Садовая мебель',
  table_base: 'Подстолья',
  shelf: 'Стеллажи',
  stove: 'Печи под казан',
  computer_table: 'Компьютерные столы',
};

// --- Интерфейсы ---
interface FurnitureItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  old_price?: number;
  featured_attributes?: string[];
  stock: number;
  available: boolean;
  notes: string;
  dimensions?: {
    width: number;
    height: number;
    depth: number;
  };
  color?: string;
  finish?: string;
  weight?: number;
  general_specs: {
    dimensions: string;
    material: string;
    color: string;
    weight: string;
  };
  attributes: Record<string, string | boolean>;
  photos: { main?: string; gallery?: string[] };
  updated_at?: string;
}

export default function ProductsPage() {
  const [items, setItems] = useState<FurnitureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Состояния диалогов
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FurnitureItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [localPreviews, setLocalPreviews] = useState<string[]>([]);
  const [photoTimestamp, setPhotoTimestamp] = useState<number>(Date.now());
  const [showCreateRestaurant, setShowCreateRestaurant] = useState(false);

  // Форма нового/редактируемого товара
  const [formData, setFormData] = useState<Partial<FurnitureItem>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Добавляем кешбастер к API запросу чтобы получить свежие данные
      const timestamp = Date.now();
      const invRes = await fetch(`${API_URL}/api/admin/products?t=${timestamp}`);
      const invData = await invRes.json();
      setItems(invData.products || []);
      // Обновляем photoTimestamp для кешбастера фото
      setPhotoTimestamp(timestamp);
    } catch (e) {
      console.error("Ошибка загрузки данных", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (item: FurnitureItem | null) => {
    if (item) {
      setEditingItem(item);
      setFormData(item);
    } else {
      setEditingItem(null);
      setFormData({
        id: '',
        name: '',
        slug: '',
        category: 'grill',
        price: 0,
        old_price: 0,
        featured_attributes: [],
        stock: 1,
        available: true,
        notes: '',
        dimensions: { width: 0, height: 0, depth: 0 },
        color: 'black',
        finish: 'matte',
        weight: 0,
        general_specs: { dimensions: '', material: '', color: '', weight: '' },
        attributes: {},
        photos: { main: '', gallery: [] }
      });
    }
    setIsEditOpen(true);
  };

  const handleSaveProduct = async () => {
    const isNew = !editingItem;
    const finalId = isNew ? slugify(formData.name || '') : editingItem.id;
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew ? `${API_URL}/api/admin/products` : `${API_URL}/api/admin/products/${finalId}`;

    const payload = { ...formData, id: finalId, slug: finalId };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        // For new products, update editingItem so photo upload works
        if (isNew && data.product) {
          setEditingItem(data.product);
        }
        setIsEditOpen(false);
        fetchData();
      }
    } catch (e) {
      alert("Не удалось сохранить");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Удалить это изделие?")) return;
    try {
      await fetch(`${API_URL}/api/admin/products/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {
      alert("Ошибка при удалении");
    }
  };

  const handleToggleAvailable = async (item: FurnitureItem) => {
    const updated = { ...item, available: !item.available };
    try {
      await fetch(`${API_URL}/api/admin/products/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    } catch (e) { console.error(e); }
  };

  // Upload photos with retry logic for mobile
  const uploadProductPhotos = async (files: File[], productId: string, category: string, retryCount = 0): Promise<string[] | null> => {
    const maxRetries = 2;
    
    try {
      // Split large batches for mobile compatibility
      const isMobile = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
      const batchSize = isMobile ? 3 : 10; // Upload 3 files at a time on mobile
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
        uploadFormData.append('product_id', productId);
        uploadFormData.append('category', category);
        
        console.log(`📤 Uploading batch ${batchIdx + 1}/${batches.length} (${batch.length} files)...`);
        
        try {
          const res = await fetch(`${API_URL}/api/admin/upload-photos`, {
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
        return uploadProductPhotos(files, productId, category, retryCount + 1);
      }
      
      throw err;
    }
  };

  // Handle file selection and upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Используем product_id из formData (генерируется из названия)
    const productId = formData.id || slugify(formData.name || '');
    const category = formData.category;
    
    if (!productId || !category) {
      setUploadStatus('❌ Заполните название и категорию');
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
    setUploadProgress(0);
    setUploadStatus(`Загружаю ${validFiles.length} фото...`);

    try {
      const uploadedPaths = await uploadProductPhotos(validFiles, productId, category);
      
      console.log('📸 Uploaded paths:', uploadedPaths);
      console.log('📸 Product ID:', productId);
      console.log('📸 Category:', category);
      
      if (uploadedPaths && uploadedPaths.length > 0) {
        // Обновляем timestamp для кешбастера
        const newTimestamp = Date.now();
        setPhotoTimestamp(newTimestamp);
        
        const currentPhotos = formData.photos || { main: '', gallery: [] };
        const newPhotos = {
          main: currentPhotos.main || uploadedPaths[0],
          gallery: [...(currentPhotos.gallery || []), ...uploadedPaths.slice(1)]
        };
        
        console.log('📸 New photos:', newPhotos);
        
        setFormData(prev => ({
          ...prev,
          photos: newPhotos,
          updated_at: new Date(newTimestamp).toISOString()
        }));
        
        // Update editingItem if exists
        if (editingItem) {
          setEditingItem(prev => prev ? {
            ...prev,
            photos: newPhotos,
            updated_at: new Date(newTimestamp).toISOString()
          } : null);
        }
        
        setUploadStatus(`✅ Загружено: ${uploadedPaths.length} фото`);
        setTimeout(() => setUploadStatus(''), 3000);
      }
      
      // Refresh data with delay to ensure server has updated
      setTimeout(() => fetchData(), 1000);
    } catch (err: any) {
      console.error('❌ Ошибка загрузки:', err);
      const errorMsg = err.message || 'Неизвестная ошибка';
      setUploadStatus(`❌ Ошибка: ${errorMsg}`);
      setTimeout(() => setUploadStatus(''), 5000);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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
      {/* --- STICKY HEADER --- */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b shadow-sm p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                <Package className="text-white h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">RESTMANAGER <span className="text-orange-600">MENUS</span></h1>
            </div>
            <div>
            <Button onClick={() => setShowCreateRestaurant(true)} size="sm" className="h-9 bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-1" /> Ресторан
            </Button>
            <Button onClick={() => handleOpenEdit(null)} size="sm" className="h-9 bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4 mr-1" /> Блюдо
            </Button>
            </div>
          </div>

          <div className="flex gap-2">
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
              <SelectTrigger className="w-[140px] h-10 bg-slate-100 border-none">
                <SelectValue placeholder="Категория" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все товары</SelectItem>
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* --- PRODUCT GRID --- */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredItems.map(item => (
            <Card key={item.id} className="group relative overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl bg-white">
              {/* Image Section */}
              <div className="relative h-36 bg-slate-200 overflow-hidden">
                <img
                    src={getImageUrl(item.photos?.main, photoTimestamp)}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    alt={item.name}
                    onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
                  />
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {!item.available && <Badge variant="destructive" className="text-[10px] uppercase">Скрыт</Badge>}
                </div>
                
                {/* Quick Actions overlay */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full shadow-lg" onClick={() => handleOpenEdit(item)}>
                    <Edit className="h-4 w-4 text-slate-700" />
                  </Button>
                  <Button size="icon" variant="destructive" className="h-9 w-9 rounded-full shadow-lg" onClick={() => handleDeleteProduct(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <CardContent className="p-3 space-y-2">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-sm text-slate-800 line-clamp-1 leading-tight">{item.name}</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    {CATEGORIES[item.category as keyof typeof CATEGORIES]}
                  </p>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <div className="flex flex-col">
                    <span className="text-orange-600 font-extrabold text-base leading-none">
                      {item.price.toLocaleString()} ฿
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Склад: {item.stock}</span>
                  </div>
                  <Switch 
                    checked={item.available} 
                    onCheckedChange={() => handleToggleAvailable(item)}
                    className="data-[state=checked]:bg-green-500 scale-75"
                  />
                </div>

                {/* Offer Button - Интеграция диплинка */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-7 text-[10px] font-bold border-slate-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 rounded-lg mt-1"
                  onClick={() => window.location.href = `/admin/offer?item=${item.id}`}
                >
                  <ExternalLink className="h-3 w-3 mr-1" /> СОЗДАТЬ ОФФЕР
                </Button>
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
            <span className="text-xs font-bold text-slate-500 group-hover:text-orange-600">НОВОЕ ИЗДЕЛИЕ</span>
          </button>
        </div>
      </div>

      {/* --- EDIT SHEET (Шторка) --- */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent side="bottom" className="h-[85vh] sm:h-auto sm:max-h-[90vh] overflow-y-auto p-0 sm:rounded-t-xl sm:max-w-2xl">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-2" />
          <SheetHeader className="px-6 pb-2">
            <SheetTitle className="text-2xl font-black flex items-center gap-2">
              {editingItem ? <Edit className="text-orange-600" /> : <Plus className="text-orange-600" />}
              {editingItem ? 'РЕДАКТИРОВАНИЕ' : 'НОВЫЙ ЛОФТ'}
            </SheetTitle>
          </SheetHeader>

          <div className="px-6 py-4 space-y-6 pb-12">
            <Tabs defaultValue="main" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-slate-100 p-1 rounded-xl">
                <TabsTrigger value="main" className="rounded-lg font-bold text-xs">ОСНОВНОЕ</TabsTrigger>
                <TabsTrigger value="specs" className="rounded-lg font-bold text-xs">СПЕКИ</TabsTrigger>
                <TabsTrigger value="attrs" className="rounded-lg font-bold text-xs">АТРИБУТЫ</TabsTrigger>
                <TabsTrigger value="photos" className="rounded-lg font-bold text-xs">ФОТО</TabsTrigger>
              </TabsList>

              <TabsContent value="main" className="mt-4 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 ml-1">НАЗВАНИЕ</Label>
                    <Input 
                      value={formData.name} 
                      placeholder="Мангал Classic 800"
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
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 ml-1">ОПИСАНИЕ / ЗАМЕТКИ</Label>
                  <Textarea 
                    value={formData.notes} 
                    className="rounded-xl bg-slate-50 border-none min-h-[100px] font-medium"
                    placeholder="Укажи сроки производства или особенности..."
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </TabsContent>

              <TabsContent value="specs" className="mt-4 space-y-4">
                <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                  <h4 className="text-xs font-black text-orange-800 flex items-center gap-2 mb-4 uppercase tracking-widest">
                    <Maximize className="h-4 w-4" /> Габариты и материалы
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Стандартные размеры */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-400">РАЗМЕРЫ (ШxВxГ)</Label>
                      <Select
                        value={formData.dimensions ? `${formData.dimensions.width}x${formData.dimensions.height}x${formData.dimensions.depth}` : ''}
                        onValueChange={(v) => {
                          const sizes = STANDARD_SIZES[formData.category as keyof typeof STANDARD_SIZES] || [];
                          const selected = sizes.find(s => `${s.width}x${s.height}x${s.depth}` === v);
                          if (selected) {
                            setFormData(prev => ({
                              ...prev,
                              dimensions: { width: selected.width, height: selected.height, depth: selected.depth }
                            }));
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 rounded-lg bg-white border-slate-200 font-bold">
                          <SelectValue placeholder="Выбери размер" />
                        </SelectTrigger>
                        <SelectContent>
                          {(STANDARD_SIZES[formData.category as keyof typeof STANDARD_SIZES] || []).map((size) => (
                            <SelectItem key={size.label} value={`${size.width}x${size.height}x${size.depth}`}>
                              {size.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Цвет с цветным кружком */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-400">ЦВЕТ</Label>
                      <Select
                        value={formData.color || ''}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, color: v }))}
                      >
                        <SelectTrigger className="h-10 rounded-lg bg-white border-slate-200 font-bold flex items-center gap-2">
                          {formData.color && (
                            <div className="w-3 h-3 rounded-full border border-slate-300" style={{
                              backgroundColor: STANDARD_COLORS.find(c => c.value === formData.color)?.hex || '#000000'
                            }} />
                          )}
                          <SelectValue placeholder="Выбери цвет" />
                        </SelectTrigger>
                        <SelectContent>
                          {STANDARD_COLORS.map((color) => (
                            <SelectItem key={color.value} value={color.value}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full border border-slate-300" style={{ backgroundColor: color.hex }} />
                                {color.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Вес */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-400">ВЕС (КГ)</Label>
                      <Input
                        type="number"
                        value={formData.weight || ''}
                        placeholder="15"
                        className="h-10 rounded-lg bg-white border-slate-200 font-bold"
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          weight: Number(e.target.value) || 0
                        }))}
                      />
                    </div>

                    {/* Покрытие */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-400">ПОКРЫТИЕ</Label>
                      <Select
                        value={formData.finish || ''}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, finish: v }))}
                      >
                        <SelectTrigger className="h-10 rounded-lg bg-white border-slate-200 font-bold">
                          <SelectValue placeholder="Выбери покрытие" />
                        </SelectTrigger>
                        <SelectContent>
                          {FINISHES.map((finish) => (
                            <SelectItem key={finish.value} value={finish.value}>
                              {finish.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="attrs" className="mt-4 space-y-4">
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                  <h4 className="text-xs font-black text-blue-800 flex items-center gap-2 mb-4 uppercase tracking-widest">
                    <Tag className="h-4 w-4" /> Атрибуты товара
                  </h4>
                  <div className="space-y-4">
                    {formData.category ? (
                      <>
                        <p className="text-xs text-slate-600">
                          Атрибуты для категории: <span className="font-bold">{CATEGORIES[formData.category as keyof typeof CATEGORIES]}</span>
                        </p>
                        <div className="space-y-3">
                          {(attributesByCategory[formData.category] || []).map((attrKey) => {
                            const meta = attributeMeta[attrKey];
                            const hasSuffix = !!meta?.suffix;
                            const rawValue = formData.attributes?.[attrKey];
                            const isChecked = rawValue !== undefined && rawValue !== null && rawValue !== '';
                            const displayValue = typeof rawValue === 'string' ? rawValue : '';
                            
                            return (
                              <div key={attrKey} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-slate-200 hover:border-blue-300 transition-colors">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    const newAttrs = { ...formData.attributes };
                                    if (checked) {
                                      // For attributes with suffix: start with empty string (user will fill it)
                                      // For boolean attributes: set to true (boolean)
                                      newAttrs[attrKey] = hasSuffix ? '' : true;
                                    } else {
                                      delete newAttrs[attrKey];
                                    }
                                    setFormData(prev => ({ ...prev, attributes: newAttrs }));
                                  }}
                                  className="h-5 w-5"
                                />
                                <div className="flex-1">
                                  <Label className="text-sm font-bold text-slate-700 cursor-pointer">
                                    {meta?.label || attrKey}
                                  </Label>
                                </div>
                                {hasSuffix && isChecked && (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="text"
                                      value={displayValue}
                                      placeholder="Значение"
                                      className="h-9 w-24 rounded-lg bg-white border-slate-200 text-sm font-bold"
                                      onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        attributes: { ...prev.attributes!, [attrKey]: e.target.value }
                                      }))}
                                    />
                                    <span className="text-xs font-bold text-slate-500">{meta?.suffix}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500 italic">Выберите категорию для отображения атрибутов</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="photos" className="mt-4 space-y-4 py-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                {/* Hidden file input for gallery */}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={isUploading || !formData.name || !formData.category}
                  className="hidden"
                  id="photo-upload"
                  capture={false}
                />
                
                {/* Hidden file input for mobile camera */}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={isUploading || !formData.name || !formData.category}
                  className="hidden"
                  id="photo-upload-camera"
                  capture="environment"
                />
                
                <div className="text-center space-y-3">
                  <ImageIcon className="h-12 w-12 text-slate-300 mx-auto" />
                  <div className="space-y-1">
                    <p className="font-bold text-slate-600">Управление медиа</p>
                    <p className="text-xs text-slate-400">
                      {!formData.name || !formData.category ? 'Заполните название и категорию' : 'PNG, JPG — до 5MB'}
                    </p>
                  </div>
                  
                  {/* Upload buttons */}
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-slate-300"
                      disabled={isUploading || !formData.name || !formData.category}
                      onClick={() => document.getElementById('photo-upload')?.click()}
                    >
                      {isUploading ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          {uploadStatus || 'Загрузка...'}
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" /> Галерея
                        </>
                      )}
                    </Button>
                    
                    {/* Mobile camera button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-slate-300"
                      disabled={isUploading || !formData.name || !formData.category}
                      onClick={() => document.getElementById('photo-upload-camera')?.click()}
                    >
                      {isUploading ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          {uploadStatus || 'Загрузка...'}
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" /> Камера
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Progress bar */}
                  {isUploading && uploadProgress > 0 && (
                    <div className="w-full max-w-xs mx-auto">
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{uploadProgress}%</p>
                    </div>
                  )}
                </div>

                {/* Photo preview section */}
                {(formData.photos?.main || formData.photos?.gallery?.length > 0 || localPreviews.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-xs font-bold text-slate-500 mb-2">
                      {localPreviews.length > 0 ? `Новые фото (${localPreviews.length})` : 'Текущие фото:'}
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {/* Local previews (uploading) */}
                      {localPreviews.map((preview, idx) => (
                        <div key={`local-${idx}`} className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-200">
                          <img
                            src={preview}
                            className="w-full h-full object-cover"
                            alt={`New ${idx + 1}`}
                          />
                          <Badge className="absolute top-1 left-1 bg-blue-600 text-[8px] px-1">NEW</Badge>
                        </div>
                      ))}
                      {/* Saved main photo */}
                      {formData.photos?.main && (
                        <div className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-slate-200">
                          <img
                            src={getImageUrl(formData.photos.main, photoTimestamp)}
                            className="w-full h-full object-cover"
                            alt="Main"
                            onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
                          />
                          <Badge className="absolute top-1 left-1 bg-orange-600 text-[8px] px-1">MAIN</Badge>
                        </div>
                      )}
                      {/* Saved gallery photos */}
                      {formData.photos?.gallery?.map((photo, idx) => (
                        <div key={idx} className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-200">
                          <img
                            src={getImageUrl(photo, photoTimestamp)}
                            className="w-full h-full object-cover"
                            alt={`Gallery ${idx + 1}`}
                            onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
                          />
                        </div>
                      ))}
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
                className="flex-[2] h-14 rounded-2xl bg-orange-600 hover:bg-orange-700 font-black text-lg shadow-xl shadow-orange-200 active:scale-95 transition-all animate-pulse hover:animate-none"
                onClick={handleSaveProduct}
              >
                <Save className="h-5 w-5 mr-2" /> СОХРАНИТЬ
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* --- CREATE RESTAURANT MODAL --- */}
      <CreateRestaurantModal
        open={showCreateRestaurant}
        onOpenChange={setShowCreateRestaurant}
        onCreated={(newRest) => {
          console.log('Restaurant created:', newRest);
          // Refetch restaurants list if needed
        }}
      />

    </div>
  );
}

// Заглушка иконки Users
function Users(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}