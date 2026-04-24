import React, { useState, useEffect, useMemo } from 'react';
import { format, addDays, parse, eachDayOfInterval } from 'date-fns';
import { Settings2, MapPinned, Trash2, X, Car as CarIcon, Search, Copy,Plus, Contact2, User as UserIcon, Clock, ChevronRight,  Receipt, Check, Filter, Camera } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// API и утилиты
import { PICKUP_LOCATIONS, generateTimeOptions, submitBooking, deleteBooking, confirmBooking, createBookingFromCRMForm } from '@/api/api';

// --- УТИЛИТЫ СЕЗОННОСТИ ---
const getSeason = (date: Date): 'high_season' | 'low_season' => {
  const month = date.getMonth(); // 0 - Январь, 10 - Ноябрь
  // High Season: Ноябрь (10) - Апрель (3)
  return (month >= 10 || month <= 3) ? 'high_season' : 'low_season';
};

const getPriceTierKey = (days: number): string => {
  if (days >= 30) return 'price_30';
  if (days >= 15) return 'price_15_29';
  if (days >= 7) return 'price_7_14';
  return 'price_1_6';
};

const getPhotoUrl = (filename: string | null | undefined): string => {
  if (!filename) return '';
  if (filename.startsWith('http')) return filename;
  const API_BASE = import.meta.env.VITE_API_URL || '';
  return `${API_BASE}/images_web/${filename}`;
};

interface BookingFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: number | string;
  userName?: string;
  userContact?: string;
  initialDateRange?: { start: Date; end: Date };
  carId?: string;
  booking?: any;
  onSuccess: () => void;
}

// ... (все импорты остаются прежними)

export function BookingFormDialog({
  isOpen, onClose, userId, userName, userContact,
  initialDateRange, carId, booking, onSuccess
}: BookingFormDialogProps) {
   
  const isEditing = !!booking;
  
  // Data State
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [carOwnerMap, setCarOwnerMap] = useState<Record<string, string>>({});
  const [owners, setOwners] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // UI State
  const [selectedTab, setSelectedTab] = useState<'fleet' | 'manual'>('fleet');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  
  // Editable Pricing State
  const [manualRental, setManualRental] = useState<string>('');
  const [manualDelivery, setManualDelivery] = useState<string>('');
  const [manualDeposit, setManualDeposit] = useState<string>('');

  // Loaded prices from booking (don't recalculate)
  const [loadedRental, setLoadedRental] = useState<number>(0);
  const [loadedDelivery, setLoadedDelivery] = useState<number>(0);
  const [loadedDeposit, setLoadedDeposit] = useState<number>(0);

  // Form State
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(addDays(new Date(), 3));
  const [pickupTime, setPickupTime] = useState('13:00');
  const [returnTime, setReturnTime] = useState('13:00');
  const [pickupLocation, setPickupLocation] = useState('airport');
  const [returnLocation, setReturnLocation] = useState('airport');
  const [pickupAddress, setPickupAddress] = useState('');
  const [returnAddress, setReturnAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [contactType, setContactType] = useState<'telegram' | 'whatsapp' | 'phone'>('telegram');
  const [manualData, setManualData] = useState({ name: '', brand: '', model: '', year: '', dailyRate: '', deposit: '5000' });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const timeOptions = useMemo(() => generateTimeOptions(), []);

  // 1. Загрузка справочников
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setLoadingData(true);
        try {
          const [vRes, oRes, mRes] = await Promise.all([
            fetch('/api/fleet'), fetch('/api/car-owners'), fetch('/api/car-owners-map')
          ]);
          const vData = await vRes.json();
          setVehicles(Object.values(vData.vehicles || {}));
          setOwners((await oRes.json()).owners || []);
          setCarOwnerMap(await mRes.json() || {});
        } catch (e) {
          console.error("Data load error", e);
        } finally { setLoadingData(false); }
      };
      fetchData();
    }
  }, [isOpen]);

  // 2. ИСПРАВЛЕННАЯ ЛОГИКА ИНИЦИАЛИЗАЦИИ
  useEffect(() => {
    if (isOpen) {
      if (booking) {
        const fd = booking.form_data;
        const bCarId = fd.car?.id || '';
        
        // Определяем вкладку на основе ID
        const isManual = bCarId.startsWith('manual_');
        setSelectedTab(isManual ? 'manual' : 'fleet');
        
        if (!isManual) {
          setSelectedVehicleId(bCarId);
        }

        setStartDate(new Date(fd.dates.start));
        setEndDate(new Date(fd.dates.end));
        setCustomerName(fd.contact.name || '');
        setCustomerContact(fd.contact.value || '');
        setContactType(fd.contact.type || 'telegram');
        setPickupLocation(fd.locations?.pickupLocation || 'airport');
        setReturnLocation(fd.locations?.dropoffLocation || 'airport');
        setPickupAddress(fd.locations?.pickupAddress || '');
        setReturnAddress(fd.locations?.dropoffAddress || '');
        setPickupTime(fd.dates?.pickupTime || '13:00');
        setReturnTime(fd.dates?.returnTime || '13:00');
        
        // Initialize manual pricing fields
        setManualRental(fd.pricing?.totalRental?.toString() || '');
        setManualDelivery(fd.pricing?.totalDelivery?.toString() || '');
        setManualDeposit(fd.pricing?.deposit?.toString() || '');
        setLoadedRental(fd.pricing?.totalRental || 0);
        setLoadedDelivery(fd.pricing?.totalDelivery || 0);
        setLoadedDeposit(fd.pricing?.deposit || 0);
        
        // Всегда заполняем manualData для корректного отображения и редактирования
        setManualData({
          name: fd.car.name || '',
          brand: fd.car.brand || '',
          model: fd.car.model || '',
          year: fd.car.year || '',
          dailyRate: (fd.pricing?.dailyRate || 0).toString(),
          deposit: (fd.pricing?.deposit || 5000).toString()
        });
      } else {
        // Логика для новой брони
        if (carId) { 
          setSelectedVehicleId(carId); 
          setSelectedTab('fleet'); 
        }
        if (initialDateRange) { 
          setStartDate(initialDateRange.start); 
          setEndDate(initialDateRange.end); 
        }
        if (userName) setCustomerName(userName);
        if (userContact) setCustomerContact(userContact);
        
        // Reset manual pricing fields
        setManualRental('');
        setManualDelivery('');
        setManualDeposit('');
        setLoadedRental(0);
        setLoadedDelivery(0);
        setLoadedDeposit(0);
      }
    }
  }, [isOpen, booking, carId]);

  // Синхронизация: если booking загружен, используем его цены по умолчанию
  useEffect(() => {
    if (booking && loadedRental > 0 && manualRental === '') {
      setManualRental(loadedRental.toString());
    }
    if (booking && loadedDelivery > 0 && manualDelivery === '') {
      setManualDelivery(loadedDelivery.toString());
    }
    if (booking && loadedDeposit > 0 && manualDeposit === '') {
      setManualDeposit(loadedDeposit.toString());
    }
  }, [booking, loadedRental, loadedDelivery, loadedDeposit, manualRental, manualDelivery, manualDeposit]);

  // 3. РАСЧЕТ СТОИМОСТИ (С защитой от пустых значений)
  const pricing = useMemo(() => {
    if (!startDate || !endDate) return null;
    
    const diffTime = endDate.getTime() - startDate.getTime();
    const days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    
    let calcRental = 0;
    let calcDeposit = 5000;
    let avgDailyRate = 0;

    if (selectedTab === 'fleet') {
      const v = vehicles.find(vec => vec.id === selectedVehicleId);
      if (v && v.pricing) {
        calcDeposit = v.pricing.deposit || 5000;
        const tierKey = getPriceTierKey(days);
        
        try {
          const dayInterval = eachDayOfInterval({ start: startDate, end: endDate });
          const activeDays = dayInterval.length > 1 ? dayInterval.slice(0, -1) : dayInterval;

          activeDays.forEach(day => {
            const season = getSeason(day);
            const dailyPrice = v.pricing[season]?.[tierKey] || v.pricing['low_season']?.[tierKey] || 0;
            calcRental += dailyPrice;
          });
          avgDailyRate = Math.round(calcRental / days);
        } catch (e) {
          calcRental = 0;
        }
      }
    } else {
      avgDailyRate = parseInt(manualData.dailyRate) || 0;
      calcRental = avgDailyRate * days;
      calcDeposit = parseInt(manualData.deposit) || 5000;
    }

    const baseDelivery = (pickupLocation === 'airport' ? 0 : 500) + (returnLocation === 'airport' ? 0 : 500);

    // Если manualRental пустой - используем loadedRental (при редактировании) или calcRental
    const finalRental = manualRental !== '' ? parseInt(manualRental) : (loadedRental || calcRental);
    const finalDelivery = manualDelivery !== '' ? parseInt(manualDelivery) : (loadedDelivery || baseDelivery);
    const finalDeposit = manualDeposit !== '' ? parseInt(manualDeposit) : calcDeposit;

    return {
      days, 
      dailyRate: avgDailyRate, 
      deposit: finalDeposit, 
      totalRental: finalRental,
      totalDelivery: finalDelivery,
      grandTotal: (finalRental || 0) + finalDelivery
    };
  }, [startDate, endDate, selectedVehicleId, selectedTab, manualData, pickupLocation, returnLocation, vehicles, manualRental, manualDelivery, manualDeposit, loadedRental, loadedDelivery]);
  
const currentCarName = useMemo(() => {
  if (selectedTab === 'fleet') {
    const v = vehicles.find(vec => vec.id === selectedVehicleId);
    return v ? v.name : 'Авто не выбрано';
  }
  return manualData.name || 'Введено вручную';
}, [selectedTab, selectedVehicleId, vehicles, manualData.name]);
  const copyToClipboard = () => {
    if (!pricing) return;
    const vehicle = selectedTab === 'fleet' ? vehicles.find(v => v.id === selectedVehicleId) : null;
    const carName = vehicle ? vehicle.name : manualData.name;
    const text = `
🚗 *Бронирование авто:* ${carName}
📅 *Даты:* ${format(startDate!, 'dd.MM')} - ${format(endDate!, 'dd.MM')} (${pricing.days} дн.)
💰 *Аренда:* ${pricing.totalRental} ฿
🚚 *Доставка:* ${pricing.totalDelivery} ฿
💵 *Депозит:* ${pricing.deposit} ฿
__________________
✅ *ИТОГО:* ${pricing.grandTotal} ฿
    `.trim();
    navigator.clipboard.writeText(text);
    toast.success("Данные скопированы для клиента");
  };

  const handleSubmit = async () => {
    if (!pricing || pricing.dailyRate === 0) {
      toast.error("Данные не полны");
      return;
    }

    setIsSubmitting(true);
    try {
      const startDateTime = parse(pickupTime, 'HH:mm', startDate!);
      const endDateTime = parse(returnTime, 'HH:mm', endDate!);
      const v = selectedTab === 'fleet' ? vehicles.find(vec => vec.id === selectedVehicleId) : null;
      const cId = isEditing && booking?.form_data?.car?.id ? booking.form_data.car.id : (selectedTab === 'fleet' ? v?.id : `manual_${Date.now()}`);

      const formDataForApi = {
        car: {
          id: String(cId),
          name: String(selectedTab === 'fleet' ? v?.name : manualData.name),
          brand: String(selectedTab === 'fleet' ? v?.brand : (manualData.brand || "")),
          model: String(selectedTab === 'fleet' ? v?.model : (manualData.model || "")),
          year: String(selectedTab === 'fleet' ? v?.year : (manualData.year || "")),
          color: String(selectedTab === 'fleet' ? (v?.color || "") : "")
        },
        dates: {
          start: startDateTime.toISOString(), end: endDateTime.toISOString(), days: Math.round(pricing.days),
          pickupTime: pickupTime, returnTime: returnTime
        },
        locations: {
          pickupLocation: String(pickupLocation), dropoffLocation: String(returnLocation),
          pickupAddress: String(pickupAddress || ""), dropoffAddress: String(returnAddress || "")
        },
        pricing: {
          dailyRate: Math.round(pricing.dailyRate), totalRental: Math.round(pricing.totalRental),
          deposit: Math.round(pricing.deposit), deliveryPickup: Math.round(pickupLocation === 'airport' ? 0 : 500),
          deliveryReturn: Math.round(returnLocation === 'airport' ? 0 : 500), totalDelivery: Math.round(pricing.totalDelivery),
          grandTotal: Math.round(pricing.grandTotal)
        },
        contact: {
          value: String(customerContact), type: String(contactType), name: String(customerName || ""),
          phone: contactType === 'phone' ? String(customerContact) : ""
        },
        timestamp: new Date().toISOString()
      };

      const bId = booking?.booking_id || booking?.id || null;
      console.log("📤 [BookingFormDialog] Saving booking:", { bId, userId, isEditing });
      
      if (isEditing && !bId) {
        // Редактирование без ID — это ошибка
        console.error("❌ [BookingFormDialog] Editing but no booking_id found!", booking);
        toast.error("Ошибка: не найден ID брони");
        setIsSubmitting(false);
        return;
      }
      
      if (isEditing && bId) {
        // Редактирование существующей брони
        console.log("📤 [BookingFormDialog] Editing booking, booking_id:", bId);
        await submitBooking(formDataForApi as any, bId, 'admin', userId);
      } else {
        // Создание новой брони из CRM
        console.log("📤 [BookingFormDialog] Creating new booking");
        await createBookingFromCRMForm(userId, formDataForApi);
      }
      console.log("✅ [BookingFormDialog] Booking saved successfully");

      toast.success("Сохранено");
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error("❌ [BookingFormDialog] Error saving booking:", e);
      toast.error(e.message || "Ошибка");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Удалить бронь?")) return;
    setIsSubmitting(true);
    try {
      const bId = booking?.booking_id || booking?.id;
      if (bId) {
        await deleteBooking(bId);
        toast.success("Удалено");
        onSuccess();
        onClose();
      }
    } catch (e: any) {
      toast.error(e.message || "Ошибка удаления");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const bId = booking?.booking_id || booking?.id;
      if (bId) {
        await confirmBooking(bId);
        toast.success("Подтверждено");
        onSuccess();
        onClose();
      }
    } catch (e: any) {
      toast.error(e.message || "Ошибка");
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { id: 'all', label: 'Все' },
    { id: 'compact', label: 'Compact' },
    { id: 'sedan', label: 'Sedan' },
    { id: 'SUV', label: 'SUV' },
    { id: '7s', label: '7 seats' },
    { id: 'bikes', label: 'Bikes' }
  ];
return (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="max-w-[100vw] w-screen h-screen m-0 rounded-none p-0 bg-white overflow-hidden flex flex-col border-none">
      
      {/* HEADER */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white z-20">
        <div className="flex items-center gap-3">

          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-none">
              {isEditing ? 'Правка бронирования' : 'Новое бронирование'}
            </h2>
            <p className="text-xs text-gray-500 mt-1">Phuket Management Terminal</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose} 
          className="rounded-lg hover:bg-gray-100"
        >
          <X size={20} />
        </Button>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* LEFT COLUMN: TRANSPORT */}
            <div className="space-y-6">
              
              {/* Выбор транспорта */}
              <div className="pb-6 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <Settings2 size={18} className="text-blue-700" />
                  <h3 className="font-semibold text-sm text-gray-900">Выбор транспорта</h3>
                </div>
                
                <Tabs value={selectedTab} onValueChange={(v: any) => setSelectedTab(v)} className="w-full">
                  <TabsList className="bg-gray-100 p-1 rounded-lg w-full mb-4">
                    <TabsTrigger 
                      value="fleet" 
                      className="flex-1 font-medium text-xs rounded-md py-2 data-[state=active]:bg-white data-[state=active]:text-gray-900"
                    >
                      Автопарк
                    </TabsTrigger>
                    <TabsTrigger 
                      value="manual" 
                      className="flex-1 font-medium text-xs rounded-md py-2 data-[state=active]:bg-white data-[state=active]:text-gray-900"
                    >
                      Вручную
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="fleet" className="space-y-4 mt-0">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-2">
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setCategoryFilter(cat.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                            categoryFilter === cat.id 
                              ? "bg-blue-900 text-white" 
                              : "bg-gray-100 text-gray-600 hover:bg-blue-200"
                          )}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Search */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input 
                          placeholder="Поиск..." 
                          className="pl-9 text-sm h-10 rounded-lg bg-gray-50 border-gray-200" 
                          value={searchQuery} 
                          onChange={e => setSearchQuery(e.target.value)} 
                        />
                      </div>
                      <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                        <SelectTrigger className="h-10 text-sm rounded-lg bg-gray-50 border-gray-200">
                          <SelectValue placeholder="Владелец" />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg">
                          <SelectItem value="all" className="text-sm">Все</SelectItem>
                          {owners.map(o => (
                            <SelectItem key={o.id} value={o.id} className="text-sm">
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Vehicle List */}
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {vehicles
                        .filter(v => 
                          v.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
                          (categoryFilter === 'all' || v.class === categoryFilter)
                        )
                        .map(v => (
                          <div
                            key={v.id}
                            onClick={() => setSelectedVehicleId(v.id)}
                            className={cn(
                              "p-3 rounded-lg border transition-all cursor-pointer flex items-center gap-3",
                              selectedVehicleId === v.id 
                                ? "border-gray-900 bg-gray-50" 
                                : "border-gray-200 hover:border-gray-300"
                            )}
                          >
                            <div className="relative w-16 h-12 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                              <div 
                                className="w-full h-full" 
                                style={{ 
                                  backgroundImage: `url(${getPhotoUrl(v.photos?.main)})`, 
                                  backgroundSize: 'cover', 
                                  backgroundPosition: 'center' 
                                }} 
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 truncate">{v.name}</p>
                              <p className="text-xs text-gray-500">Owner: {carOwnerMap[v.id] || 'Sunny'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900">
                                {v.pricing?.low_season?.price_1_6 || 0}฿
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="manual" className="space-y-3 mt-0">
                    <Input 
                      placeholder="Марка и модель" 
                      className="h-11 rounded-lg bg-gray-50 border-gray-200" 
                      value={manualData.name} 
                      onChange={e => setManualData({...manualData, name: e.target.value})} 
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input 
                        placeholder="Цена" 
                        className="h-11 rounded-lg bg-gray-50 border-gray-200" 
                        value={manualData.dailyRate} 
                        onChange={e => setManualData({...manualData, dailyRate: e.target.value})} 
                      />
                      <Input 
                        placeholder="Залог" 
                        className="h-11 rounded-lg bg-gray-50 border-gray-200" 
                        value={manualData.deposit} 
                        onChange={e => setManualData({...manualData, deposit: e.target.value})} 
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Логистика */}
              <div className="pb-6 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <MapPinned size={18} className="text-blue-700" />
                  <h3 className="font-semibold text-sm text-gray-900">Логистика</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Start */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Старт</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start text-left h-10 rounded-lg bg-gray-50 border-gray-200"
                        >
                          {startDate ? format(startDate, 'dd.MM.yyyy') : 'Выберите дату'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 border-none shadow-lg rounded-xl">
                        <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} />
                      </PopoverContent>
                    </Popover>
                    <Select value={pickupTime} onValueChange={setPickupTime}>
                      <SelectTrigger className="h-10 text-sm rounded-lg bg-gray-50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map(t => (
                          <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* End */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Конец</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start text-left h-10 rounded-lg bg-gray-50 border-gray-200"
                        >
                          {endDate ? format(endDate, 'dd.MM.yyyy') : 'Выберите дату'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 border-none shadow-lg rounded-xl">
                        <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} />
                      </PopoverContent>
                    </Popover>
                    <Select value={returnTime} onValueChange={setReturnTime}>
                      <SelectTrigger className="h-10 text-sm rounded-lg bg-gray-50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map(t => (
                          <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Locations */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="space-y-2">
                    <Select value={pickupLocation} onValueChange={setPickupLocation}>
                      <SelectTrigger className="text-sm h-10 rounded-lg bg-gray-50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PICKUP_LOCATIONS.map(l => (
                          <SelectItem key={l.id} value={l.id} className="text-sm">
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input 
                      placeholder="Адрес выдачи" 
                      className="text-sm h-10 rounded-lg bg-gray-50 border-gray-200" 
                      value={pickupAddress} 
                      onChange={e => setPickupAddress(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Select value={returnLocation} onValueChange={setReturnLocation}>
                      <SelectTrigger className="text-sm h-10 rounded-lg bg-gray-50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PICKUP_LOCATIONS.map(l => (
                          <SelectItem key={l.id} value={l.id} className="text-sm">
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input 
                      placeholder="Адрес возврата" 
                      className="text-sm h-10 rounded-lg bg-gray-50 border-gray-200" 
                      value={returnAddress} 
                      onChange={e => setReturnAddress(e.target.value)} 
                    />
                  </div>
                </div>
              </div>

              {/* Клиент */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Contact2 size={18} className="text-blue-700" />
                  <h3 className="font-semibold text-sm text-gray-900">Клиент</h3>
                </div>
                
                <div className="space-y-3">
                  <Input 
                    placeholder="ФИО клиента" 
                    className="text-sm h-11 rounded-lg bg-gray-50 border-gray-200" 
                    value={customerName} 
                    onChange={e => setCustomerName(e.target.value)} 
                  />
                  <div className="flex gap-2">
                    <Select value={contactType} onValueChange={(v: any) => setContactType(v)}>
                      <SelectTrigger className="w-[100px] text-sm h-11 rounded-lg bg-gray-50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="telegram">TG</SelectItem>
                        <SelectItem value="whatsapp">WA</SelectItem>
                        <SelectItem value="phone">PH</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input 
                      placeholder="Контакт" 
                      className="flex-1 text-sm h-11 rounded-lg bg-gray-50 border-gray-200" 
                      value={customerContact} 
                      onChange={e => setCustomerContact(e.target.value)} 
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: PRICING */}
            <div>
              <div className="sticky top-6">
                {/* Расчет стоимости */}
                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 relative">
                  <div className="absolute top-4 right-4">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={copyToClipboard} 
                      className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg h-8 w-8"
                    >
                      <Copy size={16} />
                    </Button>
                  </div>

                  <div className="flex items-center gap-3 mb-6">

                    <div>
                      <h3 className="text-sm font-medium text-gray-900">ДЕТАЛИ БРОНИРОВАНИЯ</h3>
                      <p className="text-xs font-semibold text-gray-600">Срок аренды  {pricing?.days} дн.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Авто с миниатюрой */}
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {selectedTab === 'fleet' && vehicles.length > 0 && vehicles.find(v => v.id === selectedVehicleId)?.photos?.main ? (
                        <div 
                          className="w-12 h-12 bg-cover bg-center rounded-md shrink-0"
                          style={{ backgroundImage: `url(${getPhotoUrl(vehicles.find(v => v.id === selectedVehicleId)?.photos?.main || '')})` }}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center text-gray-400 text-xs shrink-0">
                          🚗
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {selectedTab === 'fleet' 
                            ? vehicles.find(v => v.id === selectedVehicleId)?.name 
                            : manualData.name || '......'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {selectedTab === 'fleet' 
                            ? `${vehicles.find(v => v.id === selectedVehicleId)?.brand || ''} • ${vehicles.find(v => v.id === selectedVehicleId)?.class || ''}`
                            : ''}
                        </div>
                      </div>
                    </div>

                    {/* Аренда */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 w-20 shrink-0">Аренда</span>
                      <div className="flex-1 h-px" style={{ background: 'repeating-linear-gradient(to right, #9ca3af 0, #9ca3af 3px, transparent 3px, transparent 7px)' }} />
                      <div className="flex items-center text-gray-900">
                        <input 
                          className="bg-transparent text-right font-medium text-sm w-20 outline-none focus:text-gray-700" 
                          value={pricing?.totalRental} 
                          onChange={(e) => setManualRental(e.target.value)} 
                        />
                        <span className="text-sm ml-1">฿</span>
                      </div>
                    </div>

                    {/* Доставка */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 w-20 shrink-0">Доставка</span>
                      <div className="flex-1 h-px" style={{ background: 'repeating-linear-gradient(to right, #9ca3af 0, #9ca3af 3px, transparent 3px, transparent 7px)' }} />
                      <div className="flex items-center text-gray-900">
                        <input 
                          className="bg-transparent text-right font-medium text-sm w-20 outline-none focus:text-gray-700" 
                          value={pricing?.totalDelivery} 
                          onChange={(e) => setManualDelivery(e.target.value)} 
                        />
                        <span className="text-sm ml-1">฿</span>
                      </div>
                    </div>

                    {/* Депозит */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 w-20 shrink-0">Депозит</span>
                      <div className="flex-1 h-px" style={{ background: 'repeating-linear-gradient(to right, #9ca3af 0, #9ca3af 3px, transparent 3px, transparent 7px)' }} />
                      <div className="flex items-center text-gray-700">
                        <input 
                          className="bg-transparent text-right font-medium text-sm w-20 outline-none focus:text-gray-800" 
                          value={pricing?.deposit} 
                          onChange={(e) => setManualDeposit(e.target.value)} 
                        />
                        <span className="text-sm ml-1">฿</span>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="mt-6 pt-5 border-t border-gray-200 flex justify-between items-end">
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Итого к оплате</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {pricing?.grandTotal.toLocaleString()} 
                          <span className="text-xl text-gray-500 ml-1">฿</span>
                        </p>
                      </div>
                      <Badge className="bg-green-100 text-green-700 border-none font-medium text-xs px-3 py-1">
                        READY
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ACTION BUTTONS - Ряд 1: Удалить + Сохранить */}
          <div className="mt-8 flex gap-3 max-w-6xl mx-auto">
            {isEditing && (
              <Button 
                variant="destructive"
                size="lg" 
                className="h-12 px-6 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl" 
                disabled={isDeleting || isSubmitting} 
                onClick={handleDelete}
              >
                <Trash2 size={18} className="mr-2" />
                Удалить
              </Button>
            )}
            
            {isEditing ? (
              <Button
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all"
                disabled={isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? 'Обработка...' : 'Сохранить'}
              </Button>
            ) : (
              <Button
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all"
                disabled={isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? 'Обработка...' : 'Создать бронирование'}
              </Button>
            )}
          </div>

          {/* Ряд 2: Подтвердить + Отмена */}
          <div className="mt-3 flex gap-3 max-w-6xl mx-auto">
            {isEditing && (
              <Button
                variant="default"
                size="lg"
                className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all"
                disabled={isSubmitting}
                onClick={handleConfirm}
              >
                {isSubmitting ? '...' : '✓ Подтвердить'}
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className={`h-12 px-8 border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl ${isEditing ? 'flex-1' : 'w-full'}`}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Отмена
            </Button>
          </div>

          <div className="h-6" />
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
}
