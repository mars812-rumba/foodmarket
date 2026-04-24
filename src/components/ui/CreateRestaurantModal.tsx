import { useState } from 'react';
import { Loader2, Upload, Image as ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API_URL = import.meta.env.VITE_API_URL || "https://weldwood.sunny-rentals.online";

interface Restaurant {
  restaurant_id: string;
  name: string;
  address: string;
  phone: string;
}

interface CreateRestaurantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (restaurant: Restaurant) => void;
}

export function CreateRestaurantModal({
  open,
  onOpenChange,
  onCreated,
}: CreateRestaurantModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setAddress('');
    setPhone('');
    setLogo(null);
    setLogoPreview(null);
    setError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !address.trim() || !phone.trim()) {
      setError('Заполните все обязательные поля');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('address', address.trim());
      formData.append('phone', phone.trim());
      if (logo) {
        formData.append('logo', logo);
      }

      const res = await fetch(`${API_URL}/api/admin/restaurants`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Ошибка создания ресторана');
      }

      const data = await res.json();
      resetForm();
      onCreated(data);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Создать ресторан</DialogTitle>
            <DialogDescription>
              Заполните данные нового ресторана
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-bold text-slate-500 ml-1">
                НАЗВАНИЕ
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="PIZZA PENTA"
                className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold"
                disabled={loading}
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-xs font-bold text-slate-500 ml-1">
                АДРЕС
              </Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Patong Beach, Phuket"
                className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold"
                disabled={loading}
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-bold text-slate-500 ml-1">
                ТЕЛЕФОН
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+66912345678"
                className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold"
                disabled={loading}
              />
            </div>

            {/* Logo Upload */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">
                ЛОГОТИП
              </Label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                  disabled={loading}
                />
                
                {logoPreview ? (
                  <div className="relative">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-24 w-24 object-contain mx-auto rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setLogo(null);
                        setLogoPreview(null);
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      disabled={loading}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="logo-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-slate-400" />
                    </div>
                    <span className="text-xs text-slate-500">PNG, JPG — до 5MB</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1 rounded-lg border-slate-300"
                      disabled={loading}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById('logo-upload')?.click();
                      }}
                    >
                      <Upload className="h-4 w-4 mr-2" /> Загрузить
                    </Button>
                  </label>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
              className="rounded-xl"
            >
              ОТМЕНА
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-orange-600 hover:bg-orange-700 font-bold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Создание...
                </>
              ) : (
                'Создать'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
