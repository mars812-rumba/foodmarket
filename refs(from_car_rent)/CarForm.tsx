import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash, Check, Sparkles, User, Info, Image, DollarSign, X, Plus, Camera, FolderOpen, Loader2, Tag, Hash, Car, Palette, Calendar, Layers, ToggleLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import imageCompression from 'browser-image-compression';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const BRANDS = ["Toyota", "Mitsubishi", "Mazda", "MG5", "Honda", "Ford", "Nissan", "BMW", "ISUZU", "Mersdes", "Suzuki", "BYD","Yamaha"];
const YEARS = Array.from({ length: 10 }, (_, i) => (2025 - i).toString());
const CLASSES = ["compact", "sedan", "suv", "7s", "bikes"];
const DEPOSIT_MAP: Record<string, number> = { compact: 5000, sedan: 5000, suv: 10000, "7s": 10000, bikes: 5000 };

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.85
};
const getImageUrl = (path: string | undefined, timestamp?: number): string => {
  if (!path) return "/placeholder.svg";
  if (path.startsWith("http")) return path;
  if (path.startsWith("images_web/")) {
    const url = `${API_URL}/${path}`;
    return timestamp ? `${url}?t=${timestamp}` : url;
  }
  const ts = timestamp !== undefined ? timestamp : Date.now();
  return `${API_URL}/images_web/${path}?t=${ts}`;
};

const getClassLabel = (className: string) => {
  switch (className) {
    case "compact": return "Компакт";
    case "sedan": return "Седан";
    case "suv": return "Кроссовер";
    case "7s": return "7-местный";
    case "bikes": return "Байк";
    default: return className;
  }
};

export default function CarForm({
  car,
  onSave,
  onCancel,
  onPhotoUpload
}: {
  car?: any;
  onSave: (car: any) => void;
  onCancel: () => void;
  onPhotoUpload?: () => void;
}) {

  const [form, setForm] = useState({
    id: car?.id || "",
    name: car?.name || "",
    brand: car?.brand || "",
    model: car?.model || "",
    year: car?.year || "",
    class: car?.class || "compact",
    color: car?.color || "",
    available: car?.available ?? true,
    photos: car?.photos || { main: "", gallery: [] },
    pricing: car?.pricing || {
      low_season: { price_1_6: 800, price_7_14: 800, price_15_29: 700, price_30: 500 },
      high_season: { price_1_6: 900, price_7_14: 800, price_15_29: 700, price_30: 600 },
      deposit: 5000
    },
    quick_id: car?.quick_id || "",
    rating: car?.rating || 4.5
  });

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "photos" | "pricing">("info");
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);
  const [photoTimestamp, setPhotoTimestamp] = useState<number>(Date.now());
  const [ownerData, setOwnerData] = useState<any>(null);
  const [allOwners, setAllOwners] = useState<any[]>([]);
  const [ownerFormData, setOwnerFormData] = useState<any>({
    owner_id: "",
    facebook_url: "",
    available_until: "",
    notes: []
  });
  const [showNewOwnerForm, setShowNewOwnerForm] = useState(false);
  const [newOwnerData, setNewOwnerData] = useState({
    id: "",
    name: "",
    contact: "",
    facebook_url: ""
  });
  const [creatingOwner, setCreatingOwner] = useState(false);

  useEffect(() => {
    if (form.brand && form.model && form.year) {
      const name = `${form.brand} ${form.model} ${form.year} ${form.color || ""}`.trim();
      setForm(prev => ({ ...prev, name }));
    }
  }, [form.brand, form.model, form.year, form.color]);

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      pricing: { ...prev.pricing, deposit: DEPOSIT_MAP[form.class] }
    }));
  }, [form.class]);

  useEffect(() => {
    const loadOwnerData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/car-owners`);
        if (res.ok) {
          const data = await res.json();
          const owners = data.owners || [];
          setAllOwners(owners);

          if (car?.id) {
            for (const owner of owners) {
              if (owner.car_ids && owner.car_ids[car.id]) {
                const carData = owner.car_ids[car.id];
                setOwnerData({
                  owner_id: owner.id,
                  owner_name: owner.name,
                  owner_contact: owner.contact,
                  owner_facebook: owner.facebook_url,
                  car_status: carData.status,
                  car_available_until: carData.available_until,
                  car_notes: carData.notes || []
                });
                setOwnerFormData({
                  owner_id: owner.id,
                  facebook_url: carData.facebook_url || "",
                  available_until: carData.available_until || "",
                  notes: carData.notes || []
                });
                break;
              }
            }
          }
        }
      } catch (error) {
        console.error("Error loading owner data:", error);
      }
    };
    loadOwnerData();
  }, [car?.id]);

  const compressImage = async (file: File): Promise<File> => {
    try {
      // Проверяем поддержку imageCompression (может не работать на мобильных/PWA)
      if (typeof imageCompression !== 'function') {
        console.warn('⚠️ imageCompression не доступен, пропускаем сжатие');
        return file;
      }

      const originalSize = (file.size / 1024 / 1024).toFixed(2);
      console.log(`🔄 Сжимаю ${file.name}: ${originalSize}MB`);
      const compressedFile = await imageCompression(file, COMPRESSION_OPTIONS);
      const newSize = (compressedFile.size / 1024 / 1024).toFixed(2);
      console.log(`✅ Сжато: ${originalSize}MB → ${newSize}MB`);
      return compressedFile;
    } catch (error) {
      console.error(`❌ Ошибка сжатия ${file.name}:`, error);
      return file;
    }
  };

  // Upload single photo
const uploadSinglePhoto = async (file: File, retries = 3): Promise<string | null> => {
  const formData = new FormData();
  formData.append("photos", file);
  formData.append("car_id", form.id);
  formData.append("car_class", form.class);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_URL}/api/admin/upload-photos`, {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Ошибка загрузки");
      }
      
      const data = await res.json();
      if (data.uploaded && data.uploaded.length > 0) {
        return data.uploaded[0];
      }
      return null;
    } catch (err: any) {
      console.error(`❌ Попытка ${attempt}/${retries} не удалась:`, err.message);
      if (attempt === retries) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  return null;
};

const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  if (!files.length || !form.id) return;

  setUploading(true);
  setUploadProgress(0);
  setUploadStatus("Сжимаю изображения...");

  try {
    const compressionPromises = files.map(file => compressImage(file));
    const compressedFiles = await Promise.all(compressionPromises);
    
    const totalOriginal = files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024;
    const totalCompressed = compressedFiles.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024;
    
    console.log(`📦 Общее сжатие: ${totalOriginal.toFixed(2)}MB → ${totalCompressed.toFixed(2)}MB`);
    setUploadStatus(`Сжато: ${totalOriginal.toFixed(1)}MB → ${totalCompressed.toFixed(1)}MB`);
    
    const uploadedUrls: string[] = [];
    const totalFiles = compressedFiles.length;

    for (let i = 0; i < compressedFiles.length; i++) {
      const file = compressedFiles[i];
      setUploadStatus(`Загружаю фото ${i + 1} из ${totalFiles}...`);
      const url = await uploadSinglePhoto(file);
      if (url) {
        uploadedUrls.push(url);
      }
      const progress = Math.round(((i + 1) / totalFiles) * 100);
      setUploadProgress(progress);
    }

    if (uploadedUrls.length > 0) {
      const newTimestamp = Date.now();
      setPhotoTimestamp(newTimestamp);

      setForm(prev => {
        const newGallery = [...(prev.photos.gallery || []), ...uploadedUrls];
        return {
          ...prev,
          photos: {
            main: newGallery[0],
            gallery: newGallery
          }
        };
      });

      setUploadStatus(`✅ Загружено: ${uploadedUrls.length} фото`);
      
      if (onPhotoUpload) {
        onPhotoUpload();
      }
      
      setTimeout(() => setUploadStatus(""), 3000);
    }

  } catch (err: any) {
    console.error("❌ Ошибка загрузки:", err);
    setUploadStatus(`❌ Ошибка: ${err.message}`);
    setTimeout(() => setUploadStatus(""), 5000);
  } finally {
    setUploading(false);
    setUploadProgress(0);
    e.target.value = "";
  }
};

const removePhoto = (index: number) => {
  setForm(prev => ({
    ...prev,
    photos: { ...prev.photos, gallery: prev.photos.gallery.filter((_, i) => i !== index) }
  }));
};

const handleCreateOwner = async () => {
  if (!newOwnerData.id || !newOwnerData.name || !newOwnerData.contact) {
    return alert("ID, имя и контакт обязательны");
  }

  setCreatingOwner(true);
  try {
    const res = await fetch(`${API_URL}/api/admin/car-owners`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: newOwnerData.id,
        name: newOwnerData.name,
        contact: newOwnerData.contact,
        facebook_url: newOwnerData.facebook_url || null
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Ошибка создания владельца");
    }

    const createdOwner = await res.json();
    setAllOwners(prev => [...prev, createdOwner]);
    setOwnerFormData(prev => ({ ...prev, owner_id: newOwnerData.id }));
    setOwnerData({
      owner_id: newOwnerData.id,
      owner_name: newOwnerData.name,
      owner_contact: newOwnerData.contact,
      owner_facebook: newOwnerData.facebook_url,
      car_status: 'available',
      car_available_until: null,
      car_notes: []
    });

    setNewOwnerData({ id: "", name: "", contact: "", facebook_url: "" });
    setShowNewOwnerForm(false);
    alert("Владелец создан!");
  } catch (err: any) {
    alert(`Ошибка: ${err.message}`);
  } finally {
    setCreatingOwner(false);
  }
};

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!form.id || !form.name) return alert("ID и название обязательны");

  const method = car ? "PUT" : "POST";
  const url = car
    ? `${API_URL}/api/admin/cars/${form.id}`
    : `${API_URL}/api/admin/cars`;

  const payload = {
    id: form.id,
    name: form.name,
    class: form.class,
    brand: form.brand,
    model: form.model,
    year: form.year,
    color: form.color,
    available: form.available,
    supplier: "namo",
    photos: form.photos,
    pricing: form.pricing,
    quick_id: form.quick_id,
    rating: form.rating
  };

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Ошибка сохранения");
    }

    if (car?.id && ownerFormData.owner_id) {
      const ownerRes = await fetch(`${API_URL}/api/admin/cars/${form.id}/owner-info`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          owner_id: ownerFormData.owner_id,
          facebook_url: ownerFormData.facebook_url || null,
          available_until: ownerFormData.available_until || null,
          notes: ownerFormData.notes || []
        })
      });

      if (!ownerRes.ok) {
        const err = await ownerRes.json();
        throw new Error(err.detail || "Ошибка сохранения информации о владельце");
      }
    }

    onSave(payload);
    alert(car ? "Изменения сохранены!" : "Машина создана!");
    onCancel();
  } catch (err: any) {
    alert(`Ошибка: ${err.message}`);
  }
};

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        {/* Табы */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
          {[
            { id: "info", label: "Инфо", icon: Info },
            { id: "photos", label: "Фото", icon: Image },
            { id: "pricing", label: "Цены", icon: DollarSign }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id as any);
                setShowOwnerPanel(false);
              }}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-1.5 ${
                activeTab === tab.id && !showOwnerPanel
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Кнопка владелец */}
        <Button
          type="button"
          onClick={() => {
            setShowOwnerPanel(!showOwnerPanel);
            if (!showOwnerPanel) {
              setActiveTab("info");
            }
          }}
          variant={showOwnerPanel ? "default" : "outline"}
          className={`w-full ${showOwnerPanel ? "bg-blue-600 text-white" : "text-gray-600 hover:text-gray-900"}`}
        >
          <User className="h-4 w-4 mr-2" />
          Владелец
        </Button>
      </div>

      {/* ✅ TAB: INFO с фото */}
      {!showOwnerPanel && activeTab === "info" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <Label className="text-sm font-semibold text-blue-900">Превью названия</Label>
            </div>
            <p className="text-lg font-bold text-blue-700">{form.name || "Заполните поля ниже"}</p>
          </div>

          {/* ✅ Сетка: форма слева, фото справа */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Левая колонка - Форма */}
            <div className="space-y-3">
              {/* ID машины и Quick ID */}
              <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-blue-600" />
                  <Label className="text-sm font-medium text-gray-700">ID машины</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Input
                      value={form.id}
                      onChange={e => setForm(prev => ({ ...prev, id: e.target.value }))}
                      disabled={!!car?.id}
                      placeholder="ID"
                      className="h-9"
                    />
                    {!car?.id && <p className="text-[10px] text-amber-600">После создания нельзя изменить</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Input
                      value={form.quick_id}
                      onChange={e => setForm(prev => ({ ...prev, quick_id: e.target.value }))}
                      placeholder="Quick ID"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Бренд и Модель */}
              <div className="p-4 bg-white rounded-xl space-y-3 border border-gray-100">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-blue-600" />
                  <Label className="text-sm font-medium text-gray-700">Бренд и модель</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Select value={form.brand} onValueChange={val => setForm(prev => ({ ...prev, brand: val }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Бренд" /></SelectTrigger>
                      <SelectContent>{BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Input
                      value={form.model}
                      onChange={e => setForm(prev => ({ ...prev, model: e.target.value }))}
                      placeholder="Модель"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Год, Цвет и Класс */}
              <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-600" />
                  <Label className="text-sm font-medium text-gray-700">Параметры</Label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Select value={form.year} onValueChange={val => setForm(prev => ({ ...prev, year: val }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Год" /></SelectTrigger>
                      <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Input
                      value={form.color}
                      onChange={e => setForm(prev => ({ ...prev, color: e.target.value }))}
                      placeholder="Цвет"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Select value={form.class} onValueChange={val => setForm(prev => ({ ...prev, class: val }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Класс" /></SelectTrigger>
                      <SelectContent>
                        {CLASSES.map(c => <SelectItem key={c} value={c}>{getClassLabel(c)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Доступность */}
              <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100">
                <div>
                  <Label>Доступность</Label>
                  <p className="text-xs text-gray-500">Показывать клиентам</p>
                </div>
                <Switch
                  checked={form.available}
                  onCheckedChange={val => setForm(prev => ({ ...prev, available: val }))}
                />
              </div>
            </div>

            {/* ✅ Правая колонка - Фото */}
            <div className="space-y-4">
              <div className="border-2 border-slate-200 rounded-xl p-4 bg-gradient-to-br from-slate-50 to-blue-50">
                <Label className="text-sm font-semibold mb-3 block">Фотографии авто</Label>
                
                {form.photos?.main ? (
                  <div className="space-y-3">
                    {/* Главное фото */}
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Главное фото</p>
                      <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden border-2 border-slate-200">
                        <img 
                          src={getImageUrl(form.photos.main, photoTimestamp)}
                          alt="Главное фото"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.svg";
                          }}
                        />
                      </div>
                    </div>

                    {/* Галерея (остальные фото) */}
                    {form.photos.gallery && form.photos.gallery.length > 1 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Галерея ({form.photos.gallery.length - 1})</p>
                        <div className="grid grid-cols-3 gap-2">
                          {form.photos.gallery.slice(1, 4).map((photo, i) => (
                            <div key={i} className="aspect-video bg-slate-100 rounded overflow-hidden border border-slate-200">
                              <img 
                                src={getImageUrl(photo, photoTimestamp)}
                                alt={`Фото ${i + 2}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = "/placeholder.svg";
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        {form.photos.gallery.length > 4 && (
                          <p className="text-xs text-slate-500 mt-2 text-center">
                            +{form.photos.gallery.length - 4} еще
                          </p>
                        )}
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("photos")}
                      className="w-full"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Управление фото
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <p className="text-sm mb-2">Нет фотографий</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("photos")}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Загрузить фото
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PHOTOS */}
      {!showOwnerPanel && activeTab === "photos" && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-blue-400 bg-gradient-to-br from-gray-50 to-blue-50">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-blue-100 rounded-full">
                <Upload className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <Label className="cursor-pointer">Загрузить фотографии</Label>
                <p className="text-xs text-gray-500 mt-1">
                  {form.id ? "PNG, JPG — автосжатие до 800KB" : "Сначала укажите ID"}
                </p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleUpload}
                disabled={uploading || !form.id}
                className="hidden"
                id="photo-upload"
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploading || !form.id}
                onClick={() => document.getElementById("photo-upload")?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Обработка...
                  </>
                ) : (
                  <>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Выбрать файлы
                  </>
                )}
              </Button>
            </div>
          </div>

          {uploading && (
            <div className="space-y-2 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-blue-900">{uploadStatus}</span>
                <span className="text-blue-600">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {!uploading && uploadStatus && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-800">
              <Check className="h-4 w-4" />
              {uploadStatus}
            </div>
          )}

          {form.photos.gallery?.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Загруженные фото ({form.photos.gallery.length})</Label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {form.photos.gallery.map((url, i) => (
                  <div key={`${url}-${i}`} className="relative group aspect-video bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200 hover:border-blue-400">
                    <img
                      src={getImageUrl(url, photoTimestamp)}
                      alt={`Фото ${i + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = getImageUrl(url);
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removePhoto(i)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                    {i === 0 && (
                      <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                        Главное
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: PRICING */}
      {!showOwnerPanel && activeTab === "pricing" && (
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-blue-500"></div>
              <h4 className="font-semibold">Низкий сезон</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: "price_1_6", label: "1-6 дней" },
                { key: "price_7_14", label: "7-14 дней" },
                { key: "price_15_29", label: "15-29 дней" },
                { key: "price_30", label: "30+ дней" }
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">฿</span>
                    <Input
                      type="number"
                      value={form.pricing.low_season[key as keyof typeof form.pricing.low_season]}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        pricing: {
                          ...prev.pricing,
                          low_season: { ...prev.pricing.low_season, [key]: Number(e.target.value) }
                        }
                      }))}
                      className="pl-8"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-orange-500"></div>
              <h4 className="font-semibold">Высокий сезон</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: "price_1_6", label: "1-6 дней" },
                { key: "price_7_14", label: "7-14 дней" },
                { key: "price_15_29", label: "15-29 дней" },
                { key: "price_30", label: "30+ дней" }
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">฿</span>
                    <Input
                      type="number"
                      value={form.pricing.high_season[key as keyof typeof form.pricing.high_season]}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        pricing: {
                          ...prev.pricing,
                          high_season: { ...prev.pricing.high_season, [key]: Number(e.target.value) }
                        }
                      }))}
                      className="pl-8"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-green-900">Депозит</Label>
                <p className="text-xs text-green-600">По классу</p>
              </div>
              <p className="text-2xl font-bold text-green-700">฿{form.pricing.deposit}</p>
            </div>
          </div>
        </div>
      )}

      {/* OWNER PANEL */}
      {showOwnerPanel && (
        <div className="space-y-4">
          <div className="space-y-4">
            {!showNewOwnerForm ? (
              <>
                <div className="space-y-2">
                  <Label>Владелец *</Label>
                  <Select
                    value={ownerFormData.owner_id}
                    onValueChange={(val) => {
                      setOwnerFormData(prev => ({ ...prev, owner_id: val }));
                      const selected = allOwners.find(o => o.id === val);
                      if (selected) {
                        setOwnerData({
                          owner_id: selected.id,
                          owner_name: selected.name,
                          owner_contact: selected.contact,
                          owner_facebook: selected.facebook_url,
                          car_status: 'available',
                          car_available_until: null,
                          car_notes: []
                        });
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Выберите владельца" /></SelectTrigger>
                    <SelectContent>
                      {allOwners.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {owner.name} ({owner.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewOwnerForm(true)}
                  className="w-full text-blue-600 border-blue-300"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить нового владельца
                </Button>
              </>
            ) : (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-blue-900">Создать нового владельца</h4>
                  <button
                    type="button"
                    onClick={() => setShowNewOwnerForm(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">ID владельца *</Label>
                  <Input
                    value={newOwnerData.id}
                    onChange={(e) => setNewOwnerData(prev => ({ ...prev, id: e.target.value }))}
                    placeholder="например: namo, ar, my_rental"
                    disabled={creatingOwner}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Имя владельца *</Label>
                  <Input
                    value={newOwnerData.name}
                    onChange={(e) => setNewOwnerData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="например: Namo Rentals"
                    disabled={creatingOwner}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Контакт (телефон) *</Label>
                  <Input
                    value={newOwnerData.contact}
                    onChange={(e) => setNewOwnerData(prev => ({ ...prev, contact: e.target.value }))}
                    placeholder="например: +66-98-234-5678"
                    disabled={creatingOwner}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Facebook URL</Label>
                  <Input
                    type="url"
                    value={newOwnerData.facebook_url}
                    onChange={(e) => setNewOwnerData(prev => ({ ...prev, facebook_url: e.target.value }))}
                    placeholder="https://facebook.com/..."
                    disabled={creatingOwner}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewOwnerForm(false)}
                    disabled={creatingOwner}
                    className="flex-1"
                  >
                    Отмена
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreateOwner}
                    disabled={creatingOwner || !newOwnerData.id || !newOwnerData.name || !newOwnerData.contact}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {creatingOwner ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Создание...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Создать
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {ownerFormData.owner_id && ownerData && (
              <>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-3">Информация о владельце</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Имя:</span>
                      <p className="font-medium">{ownerData.owner_name}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">ID владельца:</span>
                      <p className="font-medium">{ownerData.owner_id}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Контакт:</span>
                      <p className="font-medium">{ownerData.owner_contact}</p>
                    </div>
                    {ownerData.owner_facebook && (
                      <div>
                        <span className="text-gray-600">Facebook владельца:</span>
                        <a href={ownerData.owner_facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {ownerData.owner_facebook}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Ссылка на объявление Facebook (этого авто)</Label>
                  <Input
                    type="url"
                    value={ownerFormData.facebook_url}
                    onChange={(e) => setOwnerFormData(prev => ({ ...prev, facebook_url: e.target.value }))}
                    placeholder="https://facebook.com/..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Свободна до (дата)</Label>
                  <Input
                    type="date"
                    value={ownerFormData.available_until}
                    onChange={(e) => setOwnerFormData(prev => ({ ...prev, available_until: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Примечание (пометка)</Label>
                  <textarea
                    value={ownerFormData.notes && ownerFormData.notes.length > 0 ? ownerFormData.notes.join('\n') : ''}
                    onChange={(e) => setOwnerFormData(prev => ({
                      ...prev,
                      notes: e.target.value ? e.target.value.split('\n').filter(n => n.trim()) : []
                    }))}
                    placeholder="Введите пометку о машине..."
                    className="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm"
                    rows={4}
                  />
                  <p className="text-xs text-gray-500">Каждая строка - отдельная пометка</p>
                </div>
              </>
            )}

            {!ownerFormData.owner_id && (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p>Выберите владельца, чтобы заполнить данные</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4 pb-[6px] border-t">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Отмена
        </Button>
        <Button
          type="submit"
          disabled={!form.id || !form.name || uploading}
          className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
        >
          <Check className="mr-2 h-4 w-4" />
          {car ? "Сохранить" : "Создать"}
        </Button>
      </div>
    </form>
  );
}