import { useState } from 'react';
import { Plus, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const API_URL = import.meta.env.VITE_API_URL || "https://weldwood.sunny-rentals.online";

const slugify = (text: string) => {
  const ru = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ы': 'y', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  return text.toLowerCase().split('').map(c => ru[c] || (/[a-z0-9]/.test(c) ? c : '_')).join('').replace(/_+/g, '_');
};

interface CreateRestaurantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestaurantCreated: () => void;
}

export default function CreateRestaurantModal({ open, onOpenChange, onRestaurantCreated }: CreateRestaurantModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Выберите изображение');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Файл больше 5MB');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target?.result as string);
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Введите название ресторана');
      return;
    }
    if (!formData.address.trim()) {
      setError('Введите адрес');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Введите телефон');
      return;
    }
    if (!logoFile) {
      setError('Загрузите логотип');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const restaurantId = slugify(formData.name);
      
      // Создаём ресторан с логотипом в одном запросе
      const createFormData = new FormData();
      createFormData.append('restaurant_id', restaurantId);
      createFormData.append('name', formData.name);
      createFormData.append('address', formData.address);
      createFormData.append('phone', formData.phone);
      if (logoFile) {
        createFormData.append('logo', logoFile);
      }

      const createRes = await fetch(`${API_URL}/api/restaurants`, {
        method: 'POST',
        body: createFormData,
      });

      if (!createRes.ok) {
        const errorData = await createRes.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Ошибка создания ресторана');
      }

      // Успех
      setFormData({ name: '', address: '', phone: '' });
      setLogoFile(null);
      setLogoPreview('');
      onOpenChange(false);
      onRestaurantCreated();
    } catch (err: any) {
      setError(err.message || 'Ошибка при создании ресторана');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto sm:max-w-2xl rounded-t-2xl">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-4" />
        <SheetHeader className="pb-4">
          <SheetTitle className="text-2xl font-black flex items-center gap-2">
            <Plus className="text-orange-600" />
            НОВЫЙ РЕСТОРАН
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500">НАЗВАНИЕ РЕСТОРАНА</Label>
            <Input
              value={formData.name}
              placeholder="PIZZA LOFT"
              className="h-12 rounded-xl bg-slate-50 border-none text-lg font-bold focus-visible:ring-orange-500"
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500">АДРЕС</Label>
            <Input
              value={formData.address}
              placeholder="Patong, Gay Bay"
              className="h-12 rounded-xl bg-slate-50 border-none font-bold focus-visible:ring-orange-500"
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500">ТЕЛЕФОН</Label>
            <Input
              value={formData.phone}
              placeholder="+6678786969"
              className="h-12 rounded-xl bg-slate-50 border-none font-bold focus-visible:ring-orange-500"
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500">ЛОГОТИП</Label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="hidden"
              id="logo-upload"
            />
            
            {logoPreview ? (
              <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-slate-100 border-2 border-orange-200">
                <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => {
                    setLogoFile(null);
                    setLogoPreview('');
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => document.getElementById('logo-upload')?.click()}
                className="w-full h-24 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 hover:border-orange-500 hover:bg-orange-50 transition-all"
              >
                <Upload className="h-6 w-6 text-slate-400" />
                <span className="text-xs font-bold text-slate-500">Загрузить логотип</span>
              </button>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="ghost"
              className="flex-1 h-12 rounded-xl font-bold text-slate-500"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              ОТМЕНА
            </Button>
            <Button
              className="flex-[2] h-12 rounded-xl bg-orange-600 hover:bg-orange-700 font-black text-base shadow-xl shadow-orange-200 active:scale-95 transition-all"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? '⏳ СОЗДАНИЕ...' : '✓ СОЗДАТЬ'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
