import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, Users, AlertCircle, Plus, Edit, Trash2, LogOut, Check, X, Fuel, Settings, Zap, Bike, TrendingUp, TrendingDown, User, Calendar as CalendarIcon, DollarSign, Sun, Cloud } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import CarForm from "@/components/admin/CarForm";
import { useCars } from "@/contexts/CarsContext";

// Функции для расчёта цены аренды (low: Апрель-Октябрь, high: остальное)
const determineSeason = (date: Date) => {
  const month = date.getMonth() + 1; // 1-12
  if (month >= 4 && month <= 10) {
    return 'low_season';
  }
  return 'high_season';
};

const getPriceForPeriod = (pricing: any, days: number, startDate: Date) => {
  if (!pricing) return 0;
  const season = determineSeason(startDate);
  const seasonPrices = pricing[season];
  if (!seasonPrices) return 0;
  
  if (days >= 30) return seasonPrices.price_30 || 0;
  if (days >= 15) return seasonPrices.price_15_29 || 0;
  if (days >= 7) return seasonPrices.price_7_14 || 0;
  return seasonPrices.price_1_6 || 0;
};

const calculateTotalPrice = (car: any, startDate?: Date, endDate?: Date) => {
  if (!startDate || !endDate) return null;
  
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return null;
  
  const pricePerDay = getPriceForPeriod(car.pricing, days, startDate);
  return pricePerDay * days;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  // Утилита для получения токена (добавь в начало файла)
const getAuthToken = (): string => {
  const token = localStorage.getItem('authToken');
  if (!token) {
    // Редирект на логин или показать alert
    window.location.href = '/login';
    throw new Error('Auth token not found. Please login.');
  }
  return token;
};

// Компонент массового изменения цен
function BulkPriceEditor({ onClose, onSave }) {
  const [category, setCategory] = useState('all');
  const [adjustmentType, setAdjustmentType] = useState('percent');
  const [adjustmentValue, setAdjustmentValue] = useState<number>(0);
  const [season, setSeason] = useState('both');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApply = async () => {
    if (adjustmentValue === 0) {
      alert('Введите значение изменения');
      return;
    }

    setIsProcessing(true);
    try {
      await onSave({
        category,
        adjustment_type: adjustmentType,
        adjustment_value: adjustmentValue,
        season
      });
      onClose();
    } catch (error) {
      console.error('Error applying bulk price update:', error);
      alert('Ошибка при применении изменений');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800 font-semibold">
          ⚠️ Это действие изменит цены для всех машин выбранной категории!
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-bold">Категория</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            <SelectItem value="compact">Компакт</SelectItem>
            <SelectItem value="sedan">Седаны</SelectItem>
            <SelectItem value="suv">SUV</SelectItem>
            <SelectItem value="7s">7 мест</SelectItem>
            <SelectItem value="bikes">Байки</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-bold">Сезон</Label>
        <Select value={season} onValueChange={setSeason}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="both">Оба сезона</SelectItem>
            <SelectItem value="low_season">Низкий сезон</SelectItem>
            <SelectItem value="high_season">Высокий сезон</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-bold">Тип изменения</Label>
        <Select value={adjustmentType} onValueChange={setAdjustmentType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="percent">Процент (%)</SelectItem>
            <SelectItem value="fixed">Фиксированная сумма (฿)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-bold">
          Значение {adjustmentType === 'percent' ? '(%)' : '(฿)'}
        </Label>
        <div className="flex gap-2 items-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdjustmentValue(adjustmentValue - (adjustmentType === 'percent' ? 5 : 50))}
          >
            <TrendingDown className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            value={adjustmentValue}
            onChange={(e) => setAdjustmentValue(parseFloat(e.target.value) || 0)}
            className="text-center text-lg font-bold"
            step={adjustmentType === 'percent' ? 5 : 50}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdjustmentValue(adjustmentValue + (adjustmentType === 'percent' ? 5 : 50))}
          >
            <TrendingUp className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {adjustmentType === 'percent'
            ? `${adjustmentValue > 0 ? 'Увеличение' : 'Уменьшение'} на ${Math.abs(adjustmentValue)}%`
            : `${adjustmentValue > 0 ? 'Добавить' : 'Вычесть'} ${Math.abs(adjustmentValue)}฿`
          }
        </p>
      </div>

      <div className="flex gap-2 pt-4">
        <Button
          onClick={handleApply}
          disabled={isProcessing || adjustmentValue === 0}
          className="flex-1"
        >
          {isProcessing ? 'Применяю...' : 'Применить изменения'}
        </Button>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isProcessing}
        >
          Отмена
        </Button>
      </div>
    </div>
  );
}

// Компонент отображения спецификаций
function SpecsBadges({ specs }) {
  if (!specs) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {specs.fuel && (
        <Badge variant="outline" className="text-xs px-2 py-0.5">
          <Fuel className="h-3 w-3 mr-1" />
          {specs.fuel}
        </Badge>
      )}
      {specs.transmission && (
        <Badge variant="outline" className="text-xs px-2 py-0.5">
          <Settings className="h-3 w-3 mr-1" />
          {specs.transmission}
        </Badge>
      )}
      {specs.power && (
        <Badge variant="outline" className="text-xs px-2 py-0.5">
          <Zap className="h-3 w-3 mr-1" />
          {specs.power}
        </Badge>
      )}
      {specs.engine && (
        <Badge variant="outline" className="text-xs px-2 py-0.5">
          {specs.engine}
        </Badge>
      )}
    </div>
  );
}

// Компонент редактирования спецификаций
function SpecsEditor({ car, onSave, onCancel }) {
  const [specs, setSpecs] = useState({
    fuel: car.specs?.fuel || "Бензин",
    transmission: car.specs?.transmission || "Автомат",
    power: car.specs?.power || "",
    engine: car.specs?.engine || ""
  });

  const handleChange = (field, value) => {
    setSpecs(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave({ ...car, specs });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-medium text-gray-700">Топливо</Label>
        <Select value={specs.fuel} onValueChange={(value) => handleChange('fuel', value)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Бензин">Бензин</SelectItem>
            <SelectItem value="Дизель">Дизель</SelectItem>
            <SelectItem value="Электро">Электро</SelectItem>
            <SelectItem value="Гибрид">Гибрид</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-gray-700">Коробка передач</Label>
        <Select value={specs.transmission} onValueChange={(value) => handleChange('transmission', value)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Автомат">Автомат</SelectItem>
            <SelectItem value="Механика">Механика</SelectItem>
            <SelectItem value="CVT">Вариатор</SelectItem>
            <SelectItem value="Робот">Робот</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-gray-700">Мощность (л.с.)</Label>
        <Input
          type="text"
          value={specs.power}
          onChange={(e) => handleChange('power', e.target.value)}
          placeholder="91 л.с."
          className="h-9"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-gray-700">Объем двигателя</Label>
        <Input
          type="text"
          value={specs.engine}
          onChange={(e) => handleChange('engine', e.target.value)}
          placeholder="1.2L"
          className="h-9"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={handleSave} className="flex-1 h-9">
          <Check className="h-4 w-4 mr-2" />
          Сохранить
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="flex-1 h-9">
          <X className="h-4 w-4 mr-2" />
          Отмена
        </Button>
      </div>
    </div>
  );
}

// Компонент редактирования цен
function PriceEditor({ car, onSave, onCancel }) {
  const [prices, setPrices] = useState({
    low_season: {
      price_1_6: car.pricing?.low_season?.price_1_6 || 400,
      price_7_14: car.pricing?.low_season?.price_7_14 || 400,
      price_15_29: car.pricing?.low_season?.price_15_29 || 400,
      price_30: car.pricing?.low_season?.price_30 || 400,
    },
    high_season: {
      price_1_6: car.pricing?.high_season?.price_1_6 || 400,
      price_7_14: car.pricing?.high_season?.price_7_14 || 400,
      price_15_29: car.pricing?.high_season?.price_15_29 || 400,
      price_30: car.pricing?.high_season?.price_30 || 400,
    },
    deposit: car.pricing?.deposit || 5000
  });

  const handleChange = (season, period, value) => {
    const numValue = parseInt(value) || 0;
    setPrices(prev => ({
      ...prev,
      [season]: {
        ...prev[season],
        [period]: numValue
      }
    }));
  };

  const handleDepositChange = (value) => {
    const numValue = parseInt(value) || 0;
    setPrices(prev => ({
      ...prev,
      deposit: numValue
    }));
  };

  const handleSave = () => {
    onSave({ ...car, pricing: { ...car.pricing, ...prices } });
  };

  const periods = [
    { key: 'price_1_6', label: '1-6 дней', placeholder: '800' },
    { key: 'price_7_14', label: '7-14 дней', placeholder: '700' },
    { key: 'price_15_29', label: '15-29 дней', placeholder: '650' },
    { key: 'price_30', label: '30+ дней', placeholder: '550' }
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-3 p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
          <Cloud className="h-4 w-4 text-blue-500" />
          Низкий сезон
        </div>
        <div className="grid grid-cols-2 gap-3">
          {periods.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">{label}</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={prices.low_season[key]}
                  onChange={(e) => handleChange('low_season', key, e.target.value)}
                  placeholder={placeholder}
                  className="h-10 pr-8 text-sm"
                  min="0"
                  step="50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">฿</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-200">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
          <Sun className="h-4 w-4 text-orange-500" />
          Высокий сезон
        </div>
        <div className="grid grid-cols-2 gap-3">
          {periods.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">{label}</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={prices.high_season[key]}
                  onChange={(e) => handleChange('high_season', key, e.target.value)}
                  placeholder={placeholder}
                  className="h-10 pr-8 text-sm"
                  min="0"
                  step="50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">฿</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200">
        <Label className="flex items-center gap-2 text-sm font-bold text-gray-800">
          <DollarSign className="h-4 w-4 text-purple-500" />
          Депозит
        </Label>
        <div className="relative">
          <Input
            type="number"
            value={prices.deposit}
            onChange={(e) => handleDepositChange(e.target.value)}
            placeholder="5000"
            className="h-10 pr-8 text-sm"
            min="0"
            step="500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">฿</span>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={handleSave} className="flex-1 h-10">
          <Check className="h-4 w-4 mr-2" />
          Сохранить
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="flex-1 h-10">
          <X className="h-4 w-4 mr-2" />
          Отмена
        </Button>
      </div>
    </div>
  );
}

export default function CarsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingCar, setEditingCar] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [editingSpecsId, setEditingSpecsId] = useState(null);
  const [isSpecsDialogOpen, setIsSpecsDialogOpen] = useState(false);
  const [isBulkPriceDialogOpen, setIsBulkPriceDialogOpen] = useState(false);
  const [owners, setOwners] = useState([]);
  const [isQuickOwnerDialogOpen, setIsQuickOwnerDialogOpen] = useState(false);
  const [quickOwnerCar, setQuickOwnerCar] = useState(null);
  const [quickOwnerFormData, setQuickOwnerFormData] = useState({
    owner_id: "",
    facebook_url: "",
    available_until: "",
    notes: [],
    status: "available"
  });
  const [isOwnersManagementOpen, setIsOwnersManagementOpen] = useState(false);
  const [selectedOwnerForEdit, setSelectedOwnerForEdit] = useState(null);
  const [newOwnerData, setNewOwnerData] = useState({
    id: "",
    name: "",
    contact: "",
    facebook_url: ""
  });
  const [creatingOwner, setCreatingOwner] = useState(false);

  // ✅ Фильтры
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const { refetchCars: refetchGlobalCars } = useCars();



// Убираем проверку ADMIN_KEY из URL параметров
// const isAdmin = searchParams.get("key") === ADMIN_KEY; 
// Теперь isAdmin определяется наличием токена
const isAdmin = !!localStorage.getItem('authToken');

useEffect(() => {
  fetchCars();
  fetchOwners();
}, []);

const fetchOwners = async () => {
  try {
    const res = await fetch(`${API_URL}/api/car-owners`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      setOwners(data.owners || []);
    }
  } catch (error) {
    console.error("Error fetching owners:", error);
  }
};

const getOwnerForCar = (carId: string) => {
  for (const owner of owners) {
    if (owner.car_ids && owner.car_ids[carId]) {
      return { owner, carInfo: owner.car_ids[carId] };
    }
  }
  return null;
};

const handleQuickOwnerSave = async () => {
  if (!quickOwnerFormData.owner_id || !quickOwnerCar) {
    alert('Выберите владельца');
    return;
  }

  try {
    const res = await fetch(
      `${API_URL}/api/admin/cars/${quickOwnerCar.id}/owner-info`,
      {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          owner_id: quickOwnerFormData.owner_id,
          facebook_url: quickOwnerFormData.facebook_url || null,
          available_until: quickOwnerFormData.available_until || null,
          notes: quickOwnerFormData.notes || [],
          status: quickOwnerFormData.status
        })
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Ошибка сохранения");
    }

    alert('Данные владельца сохранены!');
    await fetchOwners();
    await fetchCars();
    setIsQuickOwnerDialogOpen(false);
  } catch (err: any) {
    alert(`Ошибка: ${err.message}`);
  }
};

const handleCreateOwner = async () => {
  if (!newOwnerData.id || !newOwnerData.name || !newOwnerData.contact) {
    alert("ID, имя и контакт обязательны");
    return;
  }

  setCreatingOwner(true);
  try {
    const res = await fetch(`${API_URL}/api/admin/car-owners`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
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

    alert("Владелец создан!");
    await fetchOwners();
    setNewOwnerData({ id: "", name: "", contact: "", facebook_url: "" });
  } catch (err: any) {
    alert(`Ошибка: ${err.message}`);
  } finally {
    setCreatingOwner(false);
  }
};

const handleUpdateOwner = async () => {
  if (!selectedOwnerForEdit) return;

  try {
    const res = await fetch(`${API_URL}/api/admin/car-owners/${selectedOwnerForEdit.id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        name: selectedOwnerForEdit.name,
        contact: selectedOwnerForEdit.contact,
        facebook_url: selectedOwnerForEdit.facebook_url || null
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Ошибка обновления");
    }

    alert("Владелец обновлен!");
    await fetchOwners();
    setSelectedOwnerForEdit(null);
  } catch (err: any) {
    alert(`Ошибка: ${err.message}`);
  }
};

const handleDeleteOwner = async (ownerId: string) => {
  try {
    const res = await fetch(`${API_URL}/api/admin/car-owners/${ownerId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Ошибка удаления");
    }

    alert("Владелец удален!");
    await fetchOwners();
  } catch (err: any) {
    alert(`Ошибка: ${err.message}`);
  }
};

const fetchCars = async () => {
  try {
    if (cars.length === 0) {
      setLoading(true);
    }
    
    const endpoint = isAdmin ? `/api/admin/cars` : `/api/cars`;
    const headers = isAdmin 
      ? { "Authorization": `Bearer ${getAuthToken()}` }
      : {};
      
    const res = await fetch(`${API_URL}${endpoint}`, { headers });
    if (!res.ok) throw new Error("Не удалось загрузить машины");
    const data = await res.json();
    
    const carsList = isAdmin ? Object.values(data.cars || {}) : (data.cars || []);
    setCars(carsList);
  } catch (err: any) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

const getImageUrl = (path: string, lastUpdated?: string) => {
  if (!path) return "/placeholder.svg";
  if (path.startsWith("http")) return path;

  const cacheBuster = lastUpdated 
    ? new Date(lastUpdated).getTime() 
    : Date.now();

  if (path.startsWith("images_web/")) {
    return `${API_URL}/${path}?v=${cacheBuster}`;
  }

  return `${API_URL}/images_web/${path}?v=${cacheBuster}`;
};

const handleSave = async (car: any) => {
  const method = editingCar ? "PUT" : "POST";
  const url = editingCar 
    ? `${API_URL}/api/admin/cars/${car.id}`
    : `${API_URL}/api/admin/cars`;
  
  try {
    await fetch(url, {
      method,
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(car),
    });
    
    await fetchCars();
    refetchGlobalCars();
    setIsDialogOpen(false);
    setEditingCar(null);
  } catch (error) {
    console.error("Error saving car:", error);
  }
};

const handlePriceSave = async (updatedCar: any) => {
  try {
    await fetch(`${API_URL}/api/admin/cars/${updatedCar.id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(updatedCar),
    });
    
    setCars(prev => prev.map(c => c.id === updatedCar.id ? updatedCar : c));
    refetchGlobalCars();
    setEditingPriceId(null);
    setIsPriceDialogOpen(false);
  } catch (error) {
    console.error("Error updating prices:", error);
  }
};

const handleSpecsSave = async (updatedCar: any) => {
  try {
    await fetch(`${API_URL}/api/admin/cars/${updatedCar.id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(updatedCar),
    });
    
    setCars(prev => prev.map(c => c.id === updatedCar.id ? updatedCar : c));
    refetchGlobalCars();
    setEditingSpecsId(null);
    setIsSpecsDialogOpen(false);
  } catch (error) {
    console.error("Error updating specs:", error);
  }
};

const handleDelete = async (id: string) => {
  if (!confirm("Удалить машину?")) return;
  
  try {
    await fetch(`${API_URL}/api/admin/cars/${id}`, { 
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    await fetchCars();
    refetchGlobalCars();
  } catch (error) {
    console.error("Error deleting car:", error);
  }
};

const handleToggleAvailability = async (car: any) => {
  try {
    const updatedCar = { ...car, available: !car.available };
    await fetch(`${API_URL}/api/admin/cars/${car.id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(updatedCar),
    });

    setCars(prev => prev.map(c => c.id === car.id ? updatedCar : c));
    refetchGlobalCars();
  } catch (error) {
    console.error("Error toggling availability:", error);
  }
};

const handleBulkPriceUpdate = async (updateData: any) => {
  try {
    const response = await fetch(`${API_URL}/api/admin/bulk-price-update`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      throw new Error("Failed to update prices");
    }

    const result = await response.json();
    alert(`✅ ${result.message}`);

    await fetchCars();
    refetchGlobalCars();
    setIsBulkPriceDialogOpen(false);
  } catch (error) {
    console.error("Error in bulk price update:", error);
    throw error;
  }
};

  const filteredCars = useMemo(() => {
    let result = [...cars];

    // Фильтр по категории (используем поле class)
    if (selectedCategory !== "all") {
      result = result.filter(car => car.class === selectedCategory);
    }

    // ❌ УБРАЛИ Фильтр по датам - показываем все авто, цена рассчитывается отдельно
    // if (startDate && endDate) { ... }

    // ❌ УБРАЛИ ФИЛЬТР ПО ДОСТУПНОСТИ - он ломал брони!
    // result = result.filter(car => car.available === true);

    return result;
  }, [cars, selectedCategory, startDate, endDate, owners]);

  if (loading) {
    return (
      <div className="p-4 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-48 mb-4" />
        <Skeleton className="h-12 w-full mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-32 w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-6 w-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={fetchCars} className="mt-4">Попробовать снова</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ Компактный Sticky Header */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto p-3">
          {/* Первая строка: Даты (слева) + Категории (справа) */}
          <div className="flex gap-3 mb-3">
            {/* Левая половина - Даты */}
            <div className="flex gap-2 flex-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 w-1/4 flex-1 justify-start text-sm">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd.MM.yy", { locale: ru }) : "Нач"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => { console.log('Start date selected:', date); setStartDate(date); }}
                    locale={ru}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 w-1/4 flex-1 justify-start text-sm">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd.MM.yy", { locale: ru }) : "Кон"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => { console.log('End date selected:', date); setEndDate(date); }}
                    locale={ru}
                    initialFocus
                    disabled={(date) => startDate ? date < startDate : false}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Правая половина - Категории */}
            <div className="flex-1">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Все категории" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  <SelectItem value="compact">Компакт</SelectItem>
                  <SelectItem value="sedan">Седаны</SelectItem>
                  <SelectItem value="suv">SUV</SelectItem>
                  <SelectItem value="7s">7 мест</SelectItem>
                  <SelectItem value="bikes">Байки</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Вторая строка: Владельцы + Изменить цены + Сброс */}
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOwnersManagementOpen(true)}
              className="h-8 text-xs"
            >
              <Users className="h-3 w-3 mr-1" />
              Владельцы
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkPriceDialogOpen(true)}
              className="h-8 text-xs"
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              Изменить цены
            </Button>

            {(selectedCategory !== "all" || startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCategory("all");
                  setStartDate(undefined);
                  setEndDate(undefined);
                }}
                className="h-8 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
   
              </Button>
            )}

         
          </div>

          {/* Счетчик */}
          <p className="text-xs text-gray-500 mt-2">
            Показано: {filteredCars.length} из {cars.length}
          </p>
        </div>
      </div>

      {/* ✅ Список машин (компактные вертикальные карточки) */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredCars.map((car) => {
            const ownerInfo = getOwnerForCar(car.id);
            const deposit = car.pricing?.deposit || 0;
            
            // ✅ Получаем текущий сезон (low: Апрель-Октябрь, high: остальное)
            const getCurrentSeason = () => {
              const month = new Date().getMonth() + 1; // 1-12
              return (month >= 4 && month <= 10) ? 'low_season' : 'high_season';
            };
            const currentSeason = getCurrentSeason();
            const seasonPrices = car.pricing?.[currentSeason] || {};
            
            // ✅ Две важные цены: 1-6 дней и 15-29 дней
            const price1_6 = seasonPrices.price_1_6 || 0;
            const price15_29 = seasonPrices.price_15_29 || 0;

            return (
              <Card key={car.id} className="overflow-hidden hover:shadow-md transition-shadow group relative">
                {/* ✅ Фото */}
                <div className="relative h-32 bg-muted">
                  <img
                    src={getImageUrl(car.photos?.main, car.updated_at)}
                    alt={car.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/placeholder.svg";
                    }}
                  />
                  
                  {/* Бейдж владельца */}
                  {ownerInfo && (
                    <div className="absolute top-2 left-2 bg-purple-500/95 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 shadow-sm">
                      <User className="h-3 w-3 text-white" />
                      <span className="text-xs font-bold text-white">{ownerInfo.owner.id}</span>
                    </div>
                  )}

                  {/* Дата доступности */}
                  {ownerInfo?.carInfo?.available_until && (
                    <div className="absolute top-2 right-2 bg-blue-500/95 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 shadow-sm">
                      <CalendarIcon className="h-3 w-3 text-white" />
                      <span className="text-[10px] font-medium text-white">
                        {new Date(ownerInfo.carInfo.available_until).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  )}

                  {/* Админ кнопки */}
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        setEditingCar(car);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(car.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* ✅ Контент */}
                <CardContent className="p-3 space-y-2">
                  {/* Название */}
                  <div>
                    <h3 className="font-semibold text-sm leading-tight line-clamp-1">
                      {car.brand} {car.model}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {car.year} • {car.color}
                    </p>
                  </div>

                  {/* ✅ Цены (1-6д и 15-29д) */}
                  <div className="flex items-center gap-1 text-xs font-semibold text-blue-600">
                    <DollarSign className="h-3 w-3" />
                    <span>{price1_6}฿ • {price15_29}฿</span>
                  </div>

                  {/* ✅ Рассчитанная цена на период */}
                  {startDate && endDate && (
                    <div className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                      <span>На {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} дн:</span>
                      <span>{calculateTotalPrice(car, startDate, endDate)?.toLocaleString()}฿</span>
                    </div>
                  )}

                  {/* ✅ 3 кнопки */}
                  <div className="flex items-center gap-1">
                    {/* Кнопка Цены */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs px-1"
                      onClick={() => {
                        setEditingPriceId(car.id);
                        setIsPriceDialogOpen(true);
                      }}
                    >
                      <DollarSign className="h-3 w-3" />
                    </Button>

                    {/* Кнопка Характеристики */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs px-1"
                      onClick={() => {
                        setEditingSpecsId(car.id);
                        setIsSpecsDialogOpen(true);
                      }}
                    >
                      <Settings className="h-3 w-3" />
                    </Button>

                    {/* Кнопка Владелец */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs px-1"
                      onClick={() => {
                        const ownerData = getOwnerForCar(car.id);
                        setQuickOwnerCar(car);
                        
                        if (ownerData) {
                          setQuickOwnerFormData({
                            owner_id: ownerData.owner.id,
                            facebook_url: ownerData.carInfo.facebook_url || "",
                            available_until: ownerData.carInfo.available_until || "",
                            notes: ownerData.carInfo.notes || [],
                            status: ownerData.carInfo.status || "available"
                          });
                        } else {
                          setQuickOwnerFormData({
                            owner_id: "",
                            facebook_url: "",
                            available_until: "",
                            notes: [],
                            status: "available"
                          });
                        }
                        
                        setIsQuickOwnerDialogOpen(true);
                      }}
                    >
                      <User className="h-3 w-3" />
                    </Button>

                    {/* ✅ Кнопка "Предложение" - всегда видна */}
                    <Button
                      size="sm"
                      variant="outline"
                      className={`flex-1 h-8 text-xs px-1 ${!startDate || !endDate ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-green-50'}`}
                      disabled={!startDate || !endDate}
                      onClick={() => {
                        if (startDate && endDate) {
                          window.location.href = `/admin/offer?car=${car.id}&start=${startDate.toISOString()}&end=${endDate.toISOString()}`;
                        }
                      }}
                      title={startDate && endDate ? "Создать предложение" : "Выберите даты"}
                    >
                      <span className={startDate && endDate ? "text-green-600" : "text-muted-foreground"}>📤</span>
                    </Button>
                  </div>

                  {/* ✅ Депозит + Switch в одну строку */}
                  <div className="pt-2 border-t flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Депозит: {deposit}฿
                    </div>
                    <Switch
                      checked={car.available}
                      onCheckedChange={() => handleToggleAvailability(car)}
                      className="data-[state=checked]:bg-green-500 scale-[0.65]"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Карточка "Добавить" */}
          <Card 
            className="overflow-hidden border-2 border-dashed border-gray-300 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => {
              setEditingCar(null);
              setIsDialogOpen(true);
            }}
          >
            <div className="h-full flex flex-col items-center justify-center p-6 min-h-[280px]">
              <div className="w-16 h-16 rounded-full bg-blue-100 group-hover:bg-blue-200 transition-colors flex items-center justify-center mb-3">
                <Plus className="h-8 w-8 text-blue-600" />
              </div>
              <p className="text-sm font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">
                Добавить авто
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Диалог редактирования/создания */}
      <Sheet open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <SheetContent side="bottom" className="h-[90dvh] sm:h-auto sm:max-h-[90dvh] overflow-y-auto p-0 sm:rounded-t-xl sm:max-w-2xl">
          <SheetHeader className="p-4 pb-2 border-b">
            <SheetTitle className="text-lg sm:text-xl">
              {editingCar ? "Редактировать авто" : "Новая машина"}
            </SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <CarForm 
              car={editingCar} 
              onSave={handleSave} 
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingCar(null);
              }}
              onPhotoUpload={() => {
                fetchCars();
                refetchGlobalCars();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Диалог редактирования цен */}
      <Sheet open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
        <SheetContent side="bottom" className="h-[80dvh] sm:h-auto sm:max-h-[80dvh] overflow-y-auto p-0 sm:rounded-t-xl sm:max-w-md">
          <SheetHeader className="p-4 pb-2 border-b">
            <SheetTitle className="text-lg sm:text-xl">Редактировать цены</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            {editingPriceId && (
              <PriceEditor
                car={cars.find(c => c.id === editingPriceId)}
                onSave={handlePriceSave}
                onCancel={() => {
                  setIsPriceDialogOpen(false);
                  setEditingPriceId(null);
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Диалог редактирования характеристик */}
      <Sheet open={isSpecsDialogOpen} onOpenChange={setIsSpecsDialogOpen}>
        <SheetContent side="bottom" className="h-[70dvh] sm:h-auto sm:max-h-[70dvh] overflow-y-auto p-0 sm:rounded-t-xl sm:max-w-md">
          <SheetHeader className="p-4 pb-2 border-b">
            <SheetTitle className="text-lg sm:text-xl">Редактировать характеристики</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            {editingSpecsId && (
              <SpecsEditor
                car={cars.find(c => c.id === editingSpecsId)}
                onSave={handleSpecsSave}
                onCancel={() => {
                  setIsSpecsDialogOpen(false);
                  setEditingSpecsId(null);
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Диалог массового изменения цен */}
      <Sheet open={isBulkPriceDialogOpen} onOpenChange={setIsBulkPriceDialogOpen}>
        <SheetContent side="bottom" className="h-[80dvh] sm:h-auto sm:max-h-[80dvh] overflow-y-auto p-0 sm:rounded-t-xl sm:max-w-md">
          <SheetHeader className="p-4 pb-2 border-b">
            <SheetTitle className="text-lg sm:text-xl">Массовое изменение цен</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <BulkPriceEditor
              onClose={() => setIsBulkPriceDialogOpen(false)}
              onSave={handleBulkPriceUpdate}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Диалог владельца */}
      <Sheet open={isQuickOwnerDialogOpen} onOpenChange={setIsQuickOwnerDialogOpen}>
        <SheetContent side="bottom" className="h-[85dvh] sm:h-auto sm:max-h-[85dvh] overflow-y-auto p-0 sm:rounded-t-xl sm:max-w-md">
          <SheetHeader className="p-4 pb-2 border-b">
            <SheetTitle className="text-lg sm:text-xl">Владелец: {quickOwnerCar?.name}</SheetTitle>
          </SheetHeader>
          
          <div className="space-y-3 sm:space-y-4 p-4">
            <div className="space-y-2">
              <Label>Владелец *</Label>
              <Select
                value={quickOwnerFormData.owner_id}
                onValueChange={(val) => {
                  setQuickOwnerFormData(prev => ({ ...prev, owner_id: val }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Выберите владельца" /></SelectTrigger>
                <SelectContent>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name} ({owner.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {quickOwnerFormData.owner_id && (() => {
              const selectedOwner = owners.find(o => o.id === quickOwnerFormData.owner_id);
              return selectedOwner ? (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2 text-sm">Информация</h4>
                  <div className="space-y-1 text-xs">
                    <p><span className="text-gray-600">Контакт:</span> {selectedOwner.contact}</p>
                    {selectedOwner.facebook_url && (
                      <p>
                        <span className="text-gray-600">Facebook:</span>{' '}
                        <a href={selectedOwner.facebook_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          Профиль
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              ) : null;
            })()}

            <div className="space-y-2">
              <Label>Ссылка на объявление Facebook</Label>
              <Input
                type="url"
                value={quickOwnerFormData.facebook_url}
                onChange={(e) => setQuickOwnerFormData(prev => ({ ...prev, facebook_url: e.target.value }))}
                placeholder="https://facebook.com/..."
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <Label className="text-sm font-medium">Статус</Label>
                <p className="text-xs text-gray-500">Доступна для аренды</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${quickOwnerFormData.status === 'available' ? 'text-gray-400' : 'text-red-600'}`}>
                  Занята
                </span>
                <Switch
                  checked={quickOwnerFormData.status === 'available'}
                  onCheckedChange={(checked) => 
                    setQuickOwnerFormData(prev => ({ 
                      ...prev, 
                      status: checked ? 'available' : 'rented' 
                    }))
                  }
                  className="data-[state=checked]:bg-green-500"
                />
                <span className={`text-sm font-medium ${quickOwnerFormData.status === 'available' ? 'text-green-600' : 'text-gray-400'}`}>
                  Свободна
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Свободна до (дата)</Label>
              <Input
                type="date"
                value={quickOwnerFormData.available_until}
                onChange={(e) => setQuickOwnerFormData(prev => ({ ...prev, available_until: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Примечание (пометка)</Label>
              <textarea
                value={quickOwnerFormData.notes && quickOwnerFormData.notes.length > 0 ? quickOwnerFormData.notes.join('\n') : ''}
                onChange={(e) => setQuickOwnerFormData(prev => ({
                  ...prev,
                  notes: e.target.value ? e.target.value.split('\n').filter(n => n.trim()) : []
                }))}
                placeholder="Каждая строка - отдельная пометка"
                className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                rows={4}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsQuickOwnerDialogOpen(false)}
                className="flex-1"
              >
                Отмена
              </Button>
              <Button
                onClick={handleQuickOwnerSave}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={!quickOwnerFormData.owner_id}
              >
                Сохранить
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ✅ Диалог управления владельцами */}
      <Sheet open={isOwnersManagementOpen} onOpenChange={setIsOwnersManagementOpen}>
        <SheetContent side="bottom" className="h-[90dvh] sm:h-auto sm:max-h-[90dvh] overflow-y-auto p-0 sm:rounded-t-xl sm:max-w-3xl">
          <SheetHeader className="p-4 pb-2 border-b">
            <SheetTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Users className="h-5 w-5" />
              Управление владельцами
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4 sm:space-y-6 p-4">
            {/* Форма создания нового владельца */}
            <div className="p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Добавить нового владельца
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">ID владельца *</Label>
                  <Input
                    value={newOwnerData.id}
                    onChange={(e) => setNewOwnerData(prev => ({ ...prev, id: e.target.value }))}
                    placeholder="namo, ar, den..."
                    disabled={creatingOwner}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Имя *</Label>
                  <Input
                    value={newOwnerData.name}
                    onChange={(e) => setNewOwnerData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Namo Rentals"
                    disabled={creatingOwner}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Контакт *</Label>
                  <Input
                    value={newOwnerData.contact}
                    onChange={(e) => setNewOwnerData(prev => ({ ...prev, contact: e.target.value }))}
                    placeholder="+66-98-234-5678"
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
              </div>

              <Button
                onClick={handleCreateOwner}
                disabled={creatingOwner || !newOwnerData.id || !newOwnerData.name || !newOwnerData.contact}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
              >
                {creatingOwner ? "Создание..." : "Создать владельца"}
              </Button>
            </div>

            {/* Список существующих владельцев */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Существующие владельцы ({owners.length})</h3>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {owners.map((owner) => (
                  <Card key={owner.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      {selectedOwnerForEdit?.id === owner.id ? (
                        // Режим редактирования
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-sm">ID</Label>
                              <Input value={owner.id} disabled className="bg-gray-50" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">Имя *</Label>
                              <Input
                                value={selectedOwnerForEdit.name}
                                onChange={(e) => setSelectedOwnerForEdit(prev => ({ ...prev, name: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">Контакт *</Label>
                              <Input
                                value={selectedOwnerForEdit.contact}
                                onChange={(e) => setSelectedOwnerForEdit(prev => ({ ...prev, contact: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">Facebook</Label>
                              <Input
                                type="url"
                                value={selectedOwnerForEdit.facebook_url || ""}
                                onChange={(e) => setSelectedOwnerForEdit(prev => ({ ...prev, facebook_url: e.target.value }))}
                              />
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleUpdateOwner}
                              className="flex-1"
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Сохранить
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedOwnerForEdit(null)}
                              className="flex-1"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Отмена
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // Режим просмотра
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-gray-800">{owner.name}</h4>
                              <Badge variant="outline" className="text-xs">
                                {owner.id}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">
                              📞 {owner.contact}
                            </p>
                            {owner.facebook_url && (
                              <a 
                                href={owner.facebook_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                📘 Facebook
                              </a>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              Машин: {Object.keys(owner.car_ids || {}).length}
                            </p>
                          </div>
                          
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedOwnerForEdit({ ...owner })}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm(`Удалить владельца ${owner.name}?`)) {
                                  handleDeleteOwner(owner.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}