import { useEffect, useState, useMemo,useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
import { Car, Users, AlertCircle, Plus, Edit, Trash2, LogOut, Check, X, Fuel, Settings, Zap, Bike, TrendingUp, TrendingDown, User, Calendar as CalendarIcon, Wallet, UserPlus, ChevronRight, Tag, Wrench, Sun, Cloud, Wallet, Phone, Facebook, Hash, FileText, ToggleLeft, ToggleRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays } from "date-fns";
import { ru } from "date-fns/locale";
import CarForm from "@/components/admin/CarForm";
import { useCars } from "@/contexts/CarsContext";
import logo from '@/assets/logo.png';


const API_URL = import.meta.env.VITE_API_URL || "";
const ADMIN_KEY = "sunny2025";

// ─── SHEET HEADER ──────────────────────────────────────────────────────────────
function SheetSectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b bg-white">
      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
        <Icon className="h-4.5 w-4.5 text-blue-600" />
      </div>
      <div>
        <p className="text-[15px] font-semibold text-gray-900 leading-tight">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── SECTION DIVIDER ───────────────────────────────────────────────────────────
function SectionBlock({ title, icon: Icon, color = "blue", children }: { title: string; icon?: any; color?: "blue" | "orange" | "purple" | "green"; children: React.ReactNode }) {
  const colors = {
    blue:   "bg-blue-50 border-blue-200 text-blue-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    green:  "bg-green-50 border-green-200 text-green-700",
  };
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="h-4 w-4" />}
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="text-gray-800">
        {children}
      </div>
    </div>
  );
}

// ─── FIELD ROW ─────────────────────────────────────────────────────────────────
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

// ─── SHEET ACTION BUTTONS ──────────────────────────────────────────────────────
function SheetActions({ onSave, onCancel, saveLabel = "Сохранить", disabled = false, isProcessing = false }) {
  return (
    <div className="sticky bottom-0 bg-white border-t px-5 py-4 flex gap-3">
      <Button
        variant="outline"
        onClick={onCancel}
        disabled={isProcessing}
        className="flex-1 h-11 rounded-xl border-gray-200 text-gray-600"
      >
        <X className="h-4 w-4 mr-2" />
        Отмена
      </Button>
      <Button
        onClick={onSave}
        disabled={disabled || isProcessing}
        className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
      >
        <Check className="h-4 w-4 mr-2" />
        {isProcessing ? "Сохраняю..." : saveLabel}
      </Button>
    </div>
  );
}

// ─── BULK PRICE EDITOR ─────────────────────────────────────────────────────────
function BulkPriceEditor({ onClose, onSave }) {
  const [category, setCategory] = useState('all');
  const [adjustmentType, setAdjustmentType] = useState('percent');
  const [adjustmentValue, setAdjustmentValue] = useState<string>("0");
  const [season, setSeason] = useState('both');
  const [isProcessing, setIsProcessing] = useState(false);
  const [carOwnersMap, setCarOwnersMap] = useState<Record<string, object>>({});

  const tg = window.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user;
  useEffect(() => {
    if (tg) tg.ready();
    if (user) {
      setCarOwnersMap(prev => ({
        ...prev,
        telegramUser: { id: user.id, name: user.username || user.first_name || "" }
      }));
    }
  }, [user]);

  const adjustmentValueNum = parseFloat(adjustmentValue) || 0;

  // useCallback — стабильная ссылка, memo-компонент не перерендеривается
  const handleValueChange = useCallback((v: string) => setAdjustmentValue(v), []);

  const handleApply = async () => {
    if (adjustmentValueNum === 0) { alert('Введите значение изменения'); return; }
    setIsProcessing(true);
    try {
      await onSave({ category, adjustment_type: adjustmentType, adjustment_value: adjustmentValueNum, season });
      onClose();
    } catch (error) {
      console.error('Error applying bulk price update:', error);
      alert('Ошибка при применении изменений');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <SheetSectionHeader icon={TrendingUp} title="Массовое изменение цен" subtitle="Изменяет цены для всех машин категории" />

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Warning */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 font-medium leading-snug">
            Это действие изменит цены для всех машин выбранной категории
          </p>
        </div>

        <FieldRow label="Категория">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-11 rounded-xl border-gray-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              <SelectItem value="compact">Компакт</SelectItem>
              <SelectItem value="sedan">Седаны</SelectItem>
              <SelectItem value="suv">SUV</SelectItem>
              <SelectItem value="7s">7 мест</SelectItem>
              <SelectItem value="bikes">Байки</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Сезон">
          <Select value={season} onValueChange={setSeason}>
            <SelectTrigger className="h-11 rounded-xl border-gray-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Оба сезона</SelectItem>
              <SelectItem value="low_season">🌤 Низкий сезон</SelectItem>
              <SelectItem value="high_season">☀️ Высокий сезон</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Тип изменения">
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'percent', label: 'Процент', icon: '%' },
              { value: 'fixed', label: 'Сумма ฿', icon: '฿' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setAdjustmentType(opt.value)}
                className={`h-11 rounded-xl border-2 text-sm font-semibold transition-all ${
                  adjustmentType === opt.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label={`Значение ${adjustmentType === 'percent' ? '(%)' : '(฿)'}`}>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-11 w-11 rounded-xl shrink-0"
              onClick={() => setAdjustmentValue(String((parseFloat(adjustmentValue) || 0) - (adjustmentType === 'percent' ? 5 : 50)))}
            >
              <TrendingDown className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              value={adjustmentValue}
              onChange={(e) => setAdjustmentValue(e.target.value)}
              className="h-11 text-center text-xl font-bold rounded-xl border-gray-200"
              step={adjustmentType === 'percent' ? 5 : 50}
              inputMode="decimal"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-11 w-11 rounded-xl shrink-0"
              onClick={() => setAdjustmentValue(String((parseFloat(adjustmentValue) || 0) + (adjustmentType === 'percent' ? 5 : 50)))}
            >
              <TrendingUp className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-1">
            {adjustmentValueNum > 0 ? '↑ Увеличение' : '↓ Уменьшение'} на {Math.abs(adjustmentValueNum)}{adjustmentType === 'percent' ? '%' : '฿'}
          </p>
        </FieldRow>
      </div>

      <SheetActions
        onSave={handleApply}
        onCancel={onClose}
        saveLabel="Применить"
        disabled={adjustmentValueNum === 0}
        isProcessing={isProcessing}
      />
    </div>
  );
}

// ─── SPECS BADGES ──────────────────────────────────────────────────────────────
function SpecsBadges({ specs }) {
  if (!specs) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {specs.fuel && (
        <Badge variant="outline" className="text-xs px-2 py-0.5">
          <Fuel className="h-3 w-3 mr-1" />{specs.fuel}
        </Badge>
      )}
      {specs.transmission && (
        <Badge variant="outline" className="text-xs px-2 py-0.5">
          <Settings className="h-3 w-3 mr-1" />{specs.transmission}
        </Badge>
      )}
      {specs.power && (
        <Badge variant="outline" className="text-xs px-2 py-0.5">
          <Zap className="h-3 w-3 mr-1" />{specs.power}
        </Badge>
      )}
      {specs.engine && (
        <Badge variant="outline" className="text-xs px-2 py-0.5">{specs.engine}</Badge>
      )}
    </div>
  );
}

// ─── SPECS EDITOR ──────────────────────────────────────────────────────────────
function SpecsEditor({ car, onSave, onCancel }) {
  const [specs, setSpecs] = useState({
    fuel: car.specs?.fuel || "Бензин",
    transmission: car.specs?.transmission || "Автомат",
    power: car.specs?.power || "",
    engine: car.specs?.engine || ""
  });

  const handleChange = (field, value) => setSpecs(prev => ({ ...prev, [field]: value }));
  const handleSave = () => onSave({ ...car, specs });

  return (
    <div className="flex flex-col h-full">
      <SheetSectionHeader icon={Wrench} title="Характеристики" subtitle={`${car.brand} ${car.model}`} />

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <FieldRow label="Топливо">
          <div className="grid grid-cols-2 gap-2">
            {['Бензин', 'Дизель', 'Электро', 'Гибрид'].map(f => (
              <button
                key={f}
                onClick={() => handleChange('fuel', f)}
                className={`h-11 rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  specs.fuel === f
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Fuel className="h-3.5 w-3.5" />
                {f}
              </button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Коробка передач">
          <div className="grid grid-cols-2 gap-2">
            {['Автомат', 'Механика', 'CVT', 'Робот'].map(t => (
              <button
                key={t}
                onClick={() => handleChange('transmission', t)}
                className={`h-11 rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  specs.transmission === t
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                {t}
              </button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Мощность (л.с.)">
          <div className="relative">
            <Zap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={specs.power}
              onChange={(e) => handleChange('power', e.target.value)}
              placeholder="91 л.с."
              className="h-11 pl-10 rounded-xl border-gray-200"
            />
          </div>
        </FieldRow>

        <FieldRow label="Объём двигателя">
          <div className="relative">
            <Settings className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={specs.engine}
              onChange={(e) => handleChange('engine', e.target.value)}
              placeholder="1.2L"
              className="h-11 pl-10 rounded-xl border-gray-200"
            />
          </div>
        </FieldRow>
      </div>

      <SheetActions onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}

// ─── PRICE EDITOR ──────────────────────────────────────────────────────────────
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
    setPrices(prev => ({ ...prev, [season]: { ...prev[season], [period]: numValue } }));
  };

  
  const handleDepositChange = (value) => {
    setPrices(prev => ({ ...prev, deposit: parseInt(value) || 0 }));
  };

const handleSave = useCallback(() => {
  onSave({ ...car, pricing: prices });
}, [onSave, car, prices]);


  const periods = [
    { key: 'price_1_6', label: '1–6 дней' },
    { key: 'price_7_14', label: '7–14 дней' },
    { key: 'price_15_29', label: '15–29 дней' },
    { key: 'price_30', label: '30+ дней' }
  ];

  return (
    <div className="flex flex-col h-full">
      <SheetSectionHeader icon={Wallet} title="Цены" subtitle={`${car.brand} ${car.model}`} />

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Низкий сезон */}
        <div className="rounded-xl border p-4 space-y-3 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
            <Cloud className="h-4 w-4" />
            Низкий сезон
          </div>
          <div className="grid grid-cols-2 gap-2">
            {periods.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <p className="text-[11px] text-gray-500 font-medium">{label}</p>
                <div className="relative">
                  <Input
                    type="number"
                    value={prices.low_season[key]}
                    onChange={(e) => handleChange('low_season', key, e.target.value)}
                    className="h-10 pr-7 text-sm rounded-lg border-white bg-white shadow-sm"
                    min="0"
                    step="50"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">฿</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Высокий сезон */}
        <div className="rounded-xl border p-4 space-y-3 bg-orange-50 border-orange-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
            <Sun className="h-4 w-4" />
            Высокий сезон
          </div>
          <div className="grid grid-cols-2 gap-2">
            {periods.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <p className="text-[11px] text-gray-500 font-medium">{label}</p>
                <div className="relative">
                  <Input
                    type="number"
                    value={prices.high_season[key]}
                    onChange={(e) => handleChange('high_season', key, e.target.value)}
                    className="h-10 pr-7 text-sm rounded-lg border-white bg-white shadow-sm"
                    min="0"
                    step="50"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">฿</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-purple-700 mb-3">
            <Wallet className="h-4 w-4" />
            Депозит
          </div>
          <div className="relative">
            <Input
              type="number"
              value={prices.deposit}
              onChange={(e) => handleDepositChange(e.target.value)}
              className="h-10 pr-7 text-sm rounded-lg border-white bg-white shadow-sm"
              min="0"
              step="500"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">฿</span>
          </div>
        </div>
      </div>

      <SheetActions onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}

interface CarsPageProps {
  userId?: string | null;
}

export default function CarsPage({ userId }: CarsPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [targetUserId, setTargetUserId] = useState(userId || '');
  useEffect(() => {
    const urlUserId = searchParams.get('user_id');
    if (urlUserId) setTargetUserId(urlUserId);
    else if (userId) setTargetUserId(userId);
  }, [searchParams, userId]);

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
  const [newOwnerData, setNewOwnerData] = useState({ id: "", name: "", contact: "", facebook_url: "" });
  const [creatingOwner, setCreatingOwner] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedOwner, setSelectedOwner] = useState("all");
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(addDays(new Date(), 7));

  const { refetchCars: refetchGlobalCars } = useCars();
  const isAdmin = searchParams.get("key") === ADMIN_KEY;

  useEffect(() => {
    fetchCars();
    fetchOwners();
  }, []);

  const fetchOwners = async () => {
    try {
      const res = await fetch(`${API_URL}/api/car-owners`);
      if (res.ok) { const data = await res.json(); setOwners(data.owners || []); }
    } catch (error) { console.error("Error fetching owners:", error); }
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
    if (!quickOwnerFormData.owner_id || !quickOwnerCar) { alert('Выберите владельца'); return; }
    try {
      const res = await fetch(`${API_URL}/api/admin/cars/${quickOwnerCar.id}/owner-info?key=${ADMIN_KEY}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_id: quickOwnerFormData.owner_id,
          facebook_url: quickOwnerFormData.facebook_url || null,
          available_until: quickOwnerFormData.available_until || null,
          notes: quickOwnerFormData.notes || [],
          status: quickOwnerFormData.status
        })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Ошибка сохранения"); }
      alert('Данные владельца сохранены!');
      await fetchOwners(); await fetchCars(); setIsQuickOwnerDialogOpen(false);
    } catch (err) { alert(`Ошибка: ${err.message}`); }
  };

  const handleCreateOwner = async () => {
    if (!newOwnerData.id || !newOwnerData.name || !newOwnerData.contact) { alert("ID, имя и контакт обязательны"); return; }
    setCreatingOwner(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/car-owners?key=${ADMIN_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newOwnerData.id, name: newOwnerData.name, contact: newOwnerData.contact, facebook_url: newOwnerData.facebook_url || null })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Ошибка создания владельца"); }
      alert("Владелец создан!");
      await fetchOwners(); setNewOwnerData({ id: "", name: "", contact: "", facebook_url: "" });
    } catch (err) { alert(`Ошибка: ${err.message}`); } finally { setCreatingOwner(false); }
  };

  const handleUpdateOwner = async () => {
    if (!selectedOwnerForEdit) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/car-owners/${selectedOwnerForEdit.id}?key=${ADMIN_KEY}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedOwnerForEdit.name, contact: selectedOwnerForEdit.contact, facebook_url: selectedOwnerForEdit.facebook_url || null })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Ошибка обновления"); }
      alert("Владелец обновлен!"); await fetchOwners(); setSelectedOwnerForEdit(null);
    } catch (err) { alert(`Ошибка: ${err.message}`); }
  };

  const handleDeleteOwner = async (ownerId: string) => {
    if (!confirm("Удалить владельца? Все его машины будут перемещены в 'Не назначен'.")) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/car-owners/${ownerId}?key=${ADMIN_KEY}`, { method: "DELETE" });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Ошибка удаления"); }
      alert("Владелец удален!"); await fetchOwners(); setSelectedOwnerForEdit(null);
    } catch (err) { alert(`Ошибка: ${err.message}`); }
  };

  const fetchCars = async () => {
    try {
      if (cars.length === 0) setLoading(true);
      const endpoint = isAdmin ? `/api/admin/cars?key=${ADMIN_KEY}` : `/api/cars`;
      const res = await fetch(`${API_URL}${endpoint}`);
      if (!res.ok) throw new Error("Не удалось загрузить машины");
      const data = await res.json();
      const carsList = isAdmin ? Object.values(data.cars || {}) : (data.cars || []);
      setCars(carsList);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const getImageUrl = (path, lastUpdated) => {
    if (!path) return "/placeholder.svg";
    if (path.startsWith("http")) return path;
    const cacheBuster = lastUpdated ? new Date(lastUpdated).getTime() : Date.now();
    if (path.startsWith("images_web/")) return `${API_URL}/${path}?v=${cacheBuster}`;
    return `${API_URL}/images_web/${path}?v=${cacheBuster}`;
  };

  const handleSave = async (car) => {
    const method = editingCar ? "PUT" : "POST";
    const url = editingCar ? `${API_URL}/api/admin/cars/${car.id}?key=${ADMIN_KEY}` : `${API_URL}/api/admin/cars?key=${ADMIN_KEY}`;
    try {
      await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(car) });
      await fetchCars(); refetchGlobalCars(); setIsDialogOpen(false); setEditingCar(null);
    } catch (error) { console.error("Error saving car:", error); }
  };

  const handlePriceSave = async (updatedCar) => {
    try {
      await fetch(`${API_URL}/api/admin/cars/${updatedCar.id}?key=${ADMIN_KEY}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedCar)
      });
      setCars(prev => prev.map(c => c.id === updatedCar.id ? updatedCar : c));
      refetchGlobalCars(); setEditingPriceId(null); setIsPriceDialogOpen(false);
    } catch (error) { console.error("Error updating prices:", error); }
  };

  const handleSpecsSave = async (updatedCar) => {
    try {
      await fetch(`${API_URL}/api/admin/cars/${updatedCar.id}?key=${ADMIN_KEY}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedCar)
      });
      setCars(prev => prev.map(c => c.id === updatedCar.id ? updatedCar : c));
      refetchGlobalCars(); setEditingSpecsId(null); setIsSpecsDialogOpen(false);
    } catch (error) { console.error("Error updating specs:", error); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Удалить машину?")) return;
    try {
      await fetch(`${API_URL}/api/admin/cars/${id}?key=${ADMIN_KEY}`, { method: "DELETE" });
      await fetchCars(); refetchGlobalCars();
    } catch (error) { console.error("Error deleting car:", error); }
  };

  const handleToggleAvailability = async (car) => {
    try {
      const updatedCar = { ...car, available: !car.available };
      await fetch(`${API_URL}/api/admin/cars/${car.id}?key=${ADMIN_KEY}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedCar)
      });
      setCars(prev => prev.map(c => c.id === car.id ? updatedCar : c));
      refetchGlobalCars();
    } catch (error) { console.error("Error toggling availability:", error); }
  };

  const handleBulkPriceUpdate = async (updateData) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/bulk-price-update?key=${ADMIN_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updateData)
      });
      if (!response.ok) throw new Error("Failed to update prices");
      const result = await response.json();
      alert(`✅ ${result.message}`);
      await fetchCars(); refetchGlobalCars(); setIsBulkPriceDialogOpen(false);
    } catch (error) { console.error("Error in bulk price update:", error); throw error; }
  };

  const handleOfferClick = (car: any) => {
    const startDateStr = startDate ? format(startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const endDateStr = endDate ? format(endDate, 'yyyy-MM-dd') : format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    const params = new URLSearchParams();
    params.set('car', car.id); params.set('start', startDateStr); params.set('end', endDateStr);
    if (targetUserId) params.set('user_id', targetUserId);
    navigate(`/admin/offer?${params.toString()}`);
  };

  const filteredCars = useMemo(() => {
    let result = [...cars];
    if (selectedCategory !== "all") result = result.filter(car => car.class === selectedCategory);
    if (selectedOwner !== "all") result = result.filter(car => { const ownerInfo = getOwnerForCar(car.id); return ownerInfo?.owner?.id === selectedOwner; });
    // ❌ УБРАН: фильтр по available_until - машины показываем все, просто помечаем недоступные
    return result;
  }, [cars, selectedCategory, selectedOwner, owners]);

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

  // ─── shared sheet content wrapper classname ───────────────────────────────
  const sheetCls = "h-[100dvh] sm:h-auto sm:max-h-[100dvh] overflow-y-auto p-0 sm:rounded-t-xl sm:max-w-md animate-slide-in-from-bottom";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header — не трогаем */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto p-3">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <img src={logo} alt="" className="h-7 w-auto" />
              <span className="text-sm font-semibold text-gray-900">Парк</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsOwnersManagementOpen(true)} className="h-8">
                <UserPlus className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsBulkPriceDialogOpen(true)} className="h-8">
                <TrendingUp className="h-3 w-3" />
              </Button>
              {(selectedCategory !== "all" || selectedOwner !== "all" || startDate || endDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setSelectedCategory("all"); setSelectedOwner("all"); setStartDate(new Date()); setEndDate(addDays(new Date(), 7)); }} className="h-8">
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex gap-2 mb-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-8 flex-1 justify-start text-xs">
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  с {startDate ? format(startDate, "dd.MM.yy") : "?"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} locale={ru} initialFocus disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-8 flex-1 justify-start text-xs">
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  по {endDate ? format(endDate, "dd.MM.yy") : "?"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} locale={ru} initialFocus disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) || (startDate ? date < startDate : false)} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-2">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-8 text-xs bg-white border-gray-300 shrink-0 flex-1"><SelectValue placeholder="Категория" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                <SelectItem value="compact">Компакт</SelectItem>
                <SelectItem value="sedan">Седаны</SelectItem>
                <SelectItem value="suv">SUV</SelectItem>
                <SelectItem value="7s">7 мест</SelectItem>
                <SelectItem value="bikes">Байки</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedOwner} onValueChange={setSelectedOwner}>
              <SelectTrigger className="h-8 text-xs bg-white border-gray-300 shrink-0 flex-1"><SelectValue placeholder="Владелец" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все владельцы</SelectItem>
                {owners.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-gray-500 mt-3">Показано: {filteredCars.length} из {cars.length}</p>
        </div>
      </div>

      {/* Car grid — не трогаем */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredCars.map((car) => {
            const ownerInfo = getOwnerForCar(car.id);
            const deposit = car.pricing?.deposit || 0;
            const getCurrentSeason = () => { const month = new Date().getMonth() + 1; return (month >= 4 && month <= 10) ? 'low_season' : 'high_season'; };
            const currentSeason = getCurrentSeason();
            const seasonPrices = car.pricing?.[currentSeason] || {};
            const price1_6 = seasonPrices.price_1_6 || 0;
            const price7_14 = seasonPrices.price_7_14 || 0;
            const price15_29 = seasonPrices.price_15_29 || 0;
            const price30 = seasonPrices.price_30 || 0;

            return (
              <Card key={car.id} className="overflow-hidden hover:shadow-md transition-shadow group relative">
                <div className="relative h-32 bg-muted">
                  <img src={getImageUrl(car.photos?.main, car.updated_at)} alt={car.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
                  {ownerInfo && (
                    <div className="absolute top-2 left-2 bg-purple-500/95 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 shadow-sm">
                      <User className="h-3 w-3 text-white" />
                      <span className="text-xs font-bold text-white">{ownerInfo.owner.id}</span>
                    </div>
                  )}
                  {ownerInfo?.carInfo?.available_until && (
                    <div className="absolute top-2 right-2 bg-blue-500/95 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 shadow-sm">
                      <CalendarIcon className="h-3 w-3 text-white" />
                      <span className="text-[10px] font-medium text-white">{new Date(ownerInfo.carInfo.available_until).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <Button size="sm" variant="secondary" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditingCar(car); setIsDialogOpen(true); }}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(car.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-3 space-y-2">
                  <div>
                    <h3 className="font-semibold text-sm leading-tight line-clamp-1">{car.brand} {car.model}</h3>
                    <p className="text-xs text-muted-foreground">{car.year} • {car.color}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-blue-600">
                    <Wallet className="h-3 w-3 shrink-0" />
                    <span>{price1_6} · {price7_14} · {price15_29} · {price30}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs px-1" onClick={() => { setEditingPriceId(car.id); setIsPriceDialogOpen(true); }}>
                      <Wallet className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs px-1" onClick={() => { setEditingSpecsId(car.id); setIsSpecsDialogOpen(true); }}>
                      <Settings className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs px-1" onClick={() => {
                      const ownerData = getOwnerForCar(car.id);
                      setQuickOwnerCar(car);
                      if (ownerData) {
                        setQuickOwnerFormData({ owner_id: ownerData.owner.id, facebook_url: ownerData.carInfo.facebook_url || "", available_until: ownerData.carInfo.available_until || "", notes: ownerData.carInfo.notes || [], status: ownerData.carInfo.status || "available" });
                      } else {
                        setQuickOwnerFormData({ owner_id: "", facebook_url: "", available_until: "", notes: [], status: "available" });
                      }
                      setIsQuickOwnerDialogOpen(true);
                    }}>
                      <User className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="default" className="flex-1 h-8 text-xs px-1 bg-blue-600 hover:bg-blue-700" onClick={() => handleOfferClick(car)} disabled={!startDate || !endDate}>
                      <Car className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="pt-2 border-t flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">Депозит: {deposit}฿</div>
                    <Switch checked={car.available} onCheckedChange={() => handleToggleAvailability(car)} className="data-[state=checked]:bg-green-500 scale-[0.65]" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <Card className="overflow-hidden border-2 border-dashed border-gray-300 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group" onClick={() => { setEditingCar(null); setIsDialogOpen(true); }}>
            <div className="h-full flex flex-col items-center justify-center p-6 min-h-[280px]">
              <div className="w-16 h-16 rounded-full bg-blue-100 group-hover:bg-blue-200 transition-colors flex items-center justify-center mb-3">
                <Plus className="h-8 w-8 text-blue-600" />
              </div>
              <p className="text-sm font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">Добавить авто</p>
            </div>
          </Card>
        </div>
      </div>

      {/* ═══ SHEET: Редактирование машины ═══ */}
      <Sheet open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <SheetContent side="bottom" className="h-[100dvh] sm:h-auto sm:max-h-[100dvh] overflow-y-auto p-0 px-[12px] sm:rounded-t-xl sm:max-w-md animate-slide-in-from-bottom">
          <SheetHeader className="p-0 pt-3 pb-2 border-b">
            <SheetTitle>{editingCar ? "Редактировать авто" : "Новая машина"}</SheetTitle>
          </SheetHeader>
          <CarForm
            car={editingCar}
            onSave={handleSave}
            onCancel={() => { setIsDialogOpen(false); setEditingCar(null); }}
            onPhotoUpload={() => { fetchCars(); refetchGlobalCars(); }}
          />
        </SheetContent>
      </Sheet>

      {/* ═══ SHEET: Цены ═══ */}
      <Sheet open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
        <SheetContent side="bottom" className={sheetCls}>
          {editingPriceId && (
            <PriceEditor
              car={cars.find(c => c.id === editingPriceId)}
              onSave={handlePriceSave}
              onCancel={() => { setIsPriceDialogOpen(false); setEditingPriceId(null); }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ SHEET: Характеристики ═══ */}
      <Sheet open={isSpecsDialogOpen} onOpenChange={setIsSpecsDialogOpen}>
        <SheetContent side="bottom" className={sheetCls}>
          {editingSpecsId && (
            <SpecsEditor
              car={cars.find(c => c.id === editingSpecsId)}
              onSave={handleSpecsSave}
              onCancel={() => { setIsSpecsDialogOpen(false); setEditingSpecsId(null); }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ SHEET: Массовое изменение цен ═══ */}
      <Sheet open={isBulkPriceDialogOpen} onOpenChange={setIsBulkPriceDialogOpen}>
        <SheetContent side="bottom" className={sheetCls}>
          <BulkPriceEditor
            onClose={() => setIsBulkPriceDialogOpen(false)}
            onSave={handleBulkPriceUpdate}
          />
        </SheetContent>
      </Sheet>

      {/* ═══ SHEET: Владелец машины ═══ */}
      <Sheet open={isQuickOwnerDialogOpen} onOpenChange={setIsQuickOwnerDialogOpen}>
        <SheetContent side="bottom" className={sheetCls}>
          <div className="flex flex-col h-full">
            <SheetSectionHeader
              icon={User}
              title={`Владелец: ${quickOwnerCar?.brand} ${quickOwnerCar?.model}`}
              subtitle={quickOwnerCar?.id}
            />

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              <FieldRow label="Владелец *">
                <Select value={quickOwnerFormData.owner_id} onValueChange={(val) => setQuickOwnerFormData(prev => ({ ...prev, owner_id: val }))}>
                  <SelectTrigger className="h-11 rounded-xl border-gray-200">
                    <SelectValue placeholder="Выберите владельца" />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>{owner.name} ({owner.id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>

              {quickOwnerFormData.owner_id && (() => {
                const sel = owners.find(o => o.id === quickOwnerFormData.owner_id);
                return sel ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Контакты владельца</p>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Phone className="h-4 w-4 text-blue-400 shrink-0" />
                      {sel.contact}
                    </div>
                    {sel.facebook_url && (
                      <a href={sel.facebook_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                        <Facebook className="h-4 w-4 shrink-0" />
                        Facebook профиль
                      </a>
                    )}
                  </div>
                ) : null;
              })()}

              <FieldRow label="Ссылка на объявление Facebook">
                <div className="relative">
                  <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="url"
                    value={quickOwnerFormData.facebook_url}
                    onChange={(e) => setQuickOwnerFormData(prev => ({ ...prev, facebook_url: e.target.value }))}
                    placeholder="https://facebook.com/..."
                    className="h-11 pl-10 rounded-xl border-gray-200"
                  />
                </div>
              </FieldRow>

              {/* Статус */}
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Статус машины</p>
                  <p className="text-xs text-gray-400 mt-0.5">Доступна для аренды</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold ${quickOwnerFormData.status !== 'available' ? 'text-red-500' : 'text-gray-300'}`}>Занята</span>
                  <Switch
                    checked={quickOwnerFormData.status === 'available'}
                    onCheckedChange={(checked) => setQuickOwnerFormData(prev => ({ ...prev, status: checked ? 'available' : 'rented' }))}
                    className="data-[state=checked]:bg-green-500"
                  />
                  <span className={`text-xs font-semibold ${quickOwnerFormData.status === 'available' ? 'text-green-600' : 'text-gray-300'}`}>Свободна</span>
                </div>
              </div>

              <FieldRow label="Свободна до (дата)">
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="date"
                    value={quickOwnerFormData.available_until}
                    onChange={(e) => setQuickOwnerFormData(prev => ({ ...prev, available_until: e.target.value }))}
                    className="h-11 pl-10 rounded-xl border-gray-200"
                  />
                </div>
              </FieldRow>

              <FieldRow label="Примечания">
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <textarea
                    value={quickOwnerFormData.notes?.length ? quickOwnerFormData.notes.join('\n') : ''}
                    onChange={(e) => setQuickOwnerFormData(prev => ({ ...prev, notes: e.target.value ? e.target.value.split('\n').filter(n => n.trim()) : [] }))}
                    placeholder="Каждая строка — отдельная пометка"
                    className="w-full pl-10 pr-3 pt-2.5 pb-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    rows={4}
                  />
                </div>
              </FieldRow>
            </div>

            <SheetActions
              onSave={handleQuickOwnerSave}
              onCancel={() => setIsQuickOwnerDialogOpen(false)}
              disabled={!quickOwnerFormData.owner_id}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ SHEET: Управление владельцами ═══ */}
      <Sheet open={isOwnersManagementOpen} onOpenChange={setIsOwnersManagementOpen}>
        <SheetContent side="bottom" className={sheetCls}>
          <div className="flex flex-col h-full">
            <SheetSectionHeader icon={Users} title="Владельцы" subtitle={`${owners.length} владельцев в базе`} />

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* ── Добавить нового ── */}
              <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 space-y-3">
                <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-blue-500" />
                  Добавить владельца
                </p>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 font-medium">ID *</Label>
                    <div className="relative">
                      <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input value={newOwnerData.id} onChange={(e) => setNewOwnerData(p => ({ ...p, id: e.target.value }))} placeholder="namo, ar..." disabled={creatingOwner} className="h-10 pl-8 rounded-xl border-white bg-white text-sm shadow-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 font-medium">Имя *</Label>
                    <div className="relative">
                      <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input value={newOwnerData.name} onChange={(e) => setNewOwnerData(p => ({ ...p, name: e.target.value }))} placeholder="Namo Rentals" disabled={creatingOwner} className="h-10 pl-8 rounded-xl border-white bg-white text-sm shadow-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 font-medium">Контакт *</Label>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input value={newOwnerData.contact} onChange={(e) => setNewOwnerData(p => ({ ...p, contact: e.target.value }))} placeholder="+66-98-..." disabled={creatingOwner} className="h-10 pl-8 rounded-xl border-white bg-white text-sm shadow-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 font-medium">Facebook</Label>
                    <div className="relative">
                      <Facebook className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input type="url" value={newOwnerData.facebook_url} onChange={(e) => setNewOwnerData(p => ({ ...p, facebook_url: e.target.value }))} placeholder="https://..." disabled={creatingOwner} className="h-10 pl-8 rounded-xl border-white bg-white text-sm shadow-sm" />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleCreateOwner}
                  disabled={creatingOwner || !newOwnerData.id || !newOwnerData.name || !newOwnerData.contact}
                  className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold"
                >
                  {creatingOwner ? "Создание..." : "Создать владельца"}
                </Button>
              </div>

              {/* ── Список владельцев ── */}
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide px-1 mb-3">
                  Все владельцы
                </p>
                <div className="space-y-2">
                  {owners.map((owner) => (
                    <div key={owner.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      {selectedOwnerForEdit?.id === owner.id ? (
                        // ── Режим редактирования ──
                        <div className="p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">ID</Label>
                              <Input value={owner.id} disabled className="h-10 rounded-xl bg-gray-50 border-gray-200 text-sm" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">Имя *</Label>
                              <Input value={selectedOwnerForEdit.name} onChange={(e) => setSelectedOwnerForEdit(p => ({ ...p, name: e.target.value }))} className="h-10 rounded-xl border-gray-200 text-sm" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">Контакт *</Label>
                              <Input value={selectedOwnerForEdit.contact} onChange={(e) => setSelectedOwnerForEdit(p => ({ ...p, contact: e.target.value }))} className="h-10 rounded-xl border-gray-200 text-sm" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">Facebook</Label>
                              <Input type="url" value={selectedOwnerForEdit.facebook_url || ""} onChange={(e) => setSelectedOwnerForEdit(p => ({ ...p, facebook_url: e.target.value }))} className="h-10 rounded-xl border-gray-200 text-sm" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleUpdateOwner} className="flex-1 h-9 rounded-xl text-xs font-semibold">
                              <Check className="h-3.5 w-3.5 mr-1.5" />Сохранить
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setSelectedOwnerForEdit(null)} className="flex-1 h-9 rounded-xl text-xs">
                              <X className="h-3.5 w-3.5 mr-1.5" />Отмена
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // ── Режим просмотра ──
                        <div className="flex items-center px-4 py-3 gap-3">
                          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-purple-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-gray-900 truncate">{owner.name}</span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{owner.id}</Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Phone className="h-3 w-3" />{owner.contact}
                              </span>
                              <span className="text-xs text-gray-400">{Object.keys(owner.car_ids || {}).length} авто</span>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="ghost" onClick={() => setSelectedOwnerForEdit({ ...owner })} className="h-8 w-8 p-0 rounded-lg hover:bg-blue-50 hover:text-blue-600">
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteOwner(owner.id)} className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 hover:text-red-600">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Закрыть */}
            <div className="sticky bottom-0 bg-white border-t px-5 py-4">
              <Button variant="outline" onClick={() => setIsOwnersManagementOpen(false)} className="w-full h-11 rounded-xl border-gray-200 text-gray-600">
                Закрыть
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}