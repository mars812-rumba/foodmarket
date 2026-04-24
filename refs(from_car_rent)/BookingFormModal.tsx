import React, { useState, useEffect, useMemo } from 'react';
import { format, addDays, parse, eachDayOfInterval } from 'date-fns';
import { 
  Calendar, MapPin, Trash2, X, Car as CarIcon, 
  Search, Plus, CircleDollarSign, User as UserIcon, Clock, ChevronRight,
  Copy, Check, Filter, Camera
} from 'lucide-react';
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
import { PICKUP_LOCATIONS, generateTimeOptions, submitBooking } from '@/api/api';

const getSeason = (date: Date): 'high_season' | 'low_season' => {
  const month = date.getMonth();
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
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
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
  
  // Editable Pricing State
  const [manualRental, setManualRental] = useState<string>('');
  const [manualDelivery, setManualDelivery] = useState<string>('');
  const [manualDeposit, setManualDeposit] = useState<string>('');

  const [manualData, setManualData] = useState({ name: '', brand: '', model: '', year: '', dailyRate: '', deposit: '5000' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const timeOptions = useMemo(() => generateTimeOptions(), []);

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
        } finally { setLoadingData(false); }
      };
      fetchData();
    }
  }, [isOpen]);

  // Инициализация полей при редактировании или выборе
  useEffect(() => {
    if (isOpen && booking) {
      const fd = booking.form_data;
      setManualRental(fd.pricing?.totalRental?.toString() || '');
      setManualDelivery(fd.pricing?.totalDelivery?.toString() || '');
      setManualDeposit(fd.pricing?.deposit?.toString() || '');
    } else {
      setManualRental('');
      setManualDelivery('');
      setManualDeposit('');
    }
  }, [isOpen, booking, selectedVehicleId, selectedTab]);

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
        const dayInterval = eachDayOfInterval({ start: startDate, end: endDate });
        const activeDays = dayInterval.length > 1 ? dayInterval.slice(0, -1) : dayInterval;
        activeDays.forEach(day => {
          const season = getSeason(day);
          calcRental += v.pricing[season]?.[tierKey] || v.pricing['low_season']?.[tierKey] || 0;
        });
        avgDailyRate = Math.round(calcRental / days);
      }
    } else {
      avgDailyRate = parseInt(manualData.dailyRate) || 0;
      calcRental = avgDailyRate * days;
      calcDeposit = parseInt(manualData.deposit) || 5000;
    }

    const baseDelivery = (pickupLocation === 'airport' ? 0 : 500) + (returnLocation === 'airport' ? 0 : 500);

    const finalRental = manualRental !== '' ? parseInt(manualRental) : calcRental;
    const finalDelivery = manualDelivery !== '' ? parseInt(manualDelivery) : baseDelivery;
    const finalDeposit = manualDeposit !== '' ? parseInt(manualDeposit) : calcDeposit;

    return {
      days, 
      dailyRate: avgDailyRate, 
      deposit: finalDeposit, 
      totalRental: finalRental,
      totalDelivery: finalDelivery,
      grandTotal: (finalRental || 0) + finalDelivery
    };
  }, [startDate, endDate, selectedVehicleId, selectedTab, manualData, pickupLocation, returnLocation, vehicles, manualRental, manualDelivery, manualDeposit]);

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
           start: startDateTime.toISOString(), end: endDateTime.toISOString(), days: Math.round(pricing.days)
         },
         locations: {
           pickupLocation: String(pickupLocation), returnLocation: String(returnLocation),
           pickupAddress: String(pickupAddress || ""), returnAddress: String(returnAddress || "")
         },
         pricing: {
           dailyRate: Math.round(pricing.dailyRate), totalRental: Math.round(pricing.totalRental),
           deposit: Math.round(pricing.deposit), deliveryPickup: Math.round((pricing as any).deliveryPickup || 0),
           deliveryReturn: Math.round((pricing as any).deliveryReturn || 0), totalDelivery: Math.round(pricing.totalDelivery),
           grandTotal: Math.round(pricing.grandTotal)
         },
         contact: {
           value: String(customerContact), type: String(contactType), name: String(customerName || ""),
           phone: contactType === 'phone' ? String(customerContact) : ""
         },
         timestamp: new Date().toISOString()
       };
 
       const bId = booking?.booking_id || booking?.id || null;
       await submitBooking(formDataForApi as any, bId, 'admin', userId); // Admin создает брони через admin эндпоинт
 
       toast.success(isEditing ? "Обновлено" : "Создано");
       onSuccess();
       onClose();
     } catch (e: any) {
       toast.error(e.message || "Ошибка");
     } finally {
       setIsSubmitting(false);
     }
   };
 
   const handleDelete = async () => {
     if (!booking?.booking_id || !confirm(`Удалить бронь?`)) return;
     setIsDeleting(true);
     try {
       const res = await fetch(`/api/admin/bookings/${booking.booking_id}`, { method: 'DELETE' });
       if (!res.ok) throw new Error("Ошибка API");
       toast.success("Удалено");
       onSuccess();
       onClose();
     } catch (e: any) {
       toast.error(e.message);
     } finally {
       setIsDeleting(false);
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
        <div className="px-8 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-[#f8b515] p-2 rounded-xl text-white">
              <CarIcon size={24} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800">
              {isEditing ? 'Редактирование брони' : 'Оформление новой брони'}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100 h-12 w-12">
            <X className="h-6 w-6 text-slate-400" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 h-full">
            
            {/* LEFT PANEL: SELECTION */}
            <div className="p-8 bg-slate-50/50 border-r border-slate-100 flex flex-col space-y-6">
              <Tabs value={selectedTab} onValueChange={(v: any) => setSelectedTab(v)} className="w-full">
                <TabsList className="bg-slate-200/60 p-1.5 rounded-2xl w-full mb-6">
                  <TabsTrigger value="fleet" className="flex-1 font-black uppercase text-xs rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">Автопарк</TabsTrigger>
                  <TabsTrigger value="manual" className="flex-1 font-black uppercase text-xs rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">Вручную</TabsTrigger>
                </TabsList>

                <TabsContent value="fleet" className="space-y-6 mt-0">
                  {/* FILTERS */}
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setCategoryFilter(cat.id)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2",
                            categoryFilter === cat.id 
                              ? "bg-[#f8b515] border-[#f8b515] text-white shadow-lg shadow-orange-100" 
                              : "border-white bg-white text-slate-400 hover:border-slate-200"
                          )}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                        <Input 
                          placeholder="ПОИСК МОДЕЛИ..." 
                          className="pl-10 font-bold uppercase text-[11px] h-12 rounded-2xl bg-white border-none shadow-sm"
                          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                        <SelectTrigger className="h-12 text-[11px] font-bold rounded-2xl bg-white border-none shadow-sm">
                          <SelectValue placeholder="ВЛАДЕЛЕЦ" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="all">Все владельцы</SelectItem>
                          {owners.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* VEHICLE LIST */}
                  <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {vehicles
                      .filter(v => 
                        v.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
                        (categoryFilter === 'all' || v.class === categoryFilter) &&
                        (ownerFilter === 'all' || carOwnerMap[v.id] === ownerFilter)
                      ).map(v => (
                      <div 
                        key={v.id} onClick={() => setSelectedVehicleId(v.id)}
                        className={cn(
                          "p-4 rounded-[28px] border-2 transition-all cursor-pointer flex items-center gap-4 bg-white",
                          selectedVehicleId === v.id ? "border-[#f8b515] shadow-xl shadow-orange-50" : "border-transparent hover:border-slate-100"
                        )}
                      >
<div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-slate-100 border-4 border-white shadow-xl group mb-4">
                      <div className="w-full h-full" style={{ backgroundImage: `url(${getPhotoUrl(v.photos?.main)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-4">
                        <Badge className="w-fit bg-[#f8b515] text-white border-none text-[10px] font-black uppercase mb-1">{v.class}</Badge>
                        <h3 className="text-white font-black text-lg uppercase leading-none">{v.name}</h3>
                      </div>
                    </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm uppercase text-slate-800 truncate leading-tight">{v.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className="bg-slate-100 text-slate-500 text-[8px] px-1.5 h-4 border-none uppercase">{v.class}</Badge>
                            <span className="text-[9px] font-bold text-slate-300 uppercase truncate">ID: {carOwnerMap[v.id] || 'Sunny'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-slate-900 leading-none">{v.pricing?.low_season?.price_1_6 || 0}฿</p>
                          <p className="text-[9px] font-bold text-slate-300 uppercase">в день</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="manual" className="space-y-4 mt-0 bg-white p-6 rounded-[32px] shadow-sm">
                  <Input placeholder="МАРКА И МОДЕЛЬ" className="font-bold h-14 rounded-2xl border-slate-100" value={manualData.name} onChange={e => setManualData({...manualData, name: e.target.value})} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-300 uppercase ml-2">Цена в день</label>
                      <Input placeholder="ЦЕНА" className="font-bold h-14 rounded-2xl border-slate-100" value={manualData.dailyRate} onChange={e => setManualData({...manualData, dailyRate: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-300 uppercase ml-2">Залог</label>
                      <Input placeholder="ЗАЛОГ" className="font-bold h-14 rounded-2xl border-slate-100" value={manualData.deposit} onChange={e => setManualData({...manualData, deposit: e.target.value})} />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>


            {/* RIGHT PANEL: LOGISTICS & CUSTOMER */}
            <div className="p-8 space-y-10 bg-white overflow-y-auto custom-scrollbar">
              {/* DATE SELECTION */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#f8b515]" /> Дата выдачи
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full text-sm font-black h-14 rounded-2xl border-slate-100 shadow-sm bg-white hover:bg-slate-50">
                        {startDate ? format(startDate, 'dd MMMM yyyy') : 'ВЫБРАТЬ'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 border-none shadow-2xl rounded-3xl overflow-hidden"><CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} /></PopoverContent>
                  </Popover>
                  <Select value={pickupTime} onValueChange={setPickupTime}>
                    <SelectTrigger className="h-12 text-sm font-black rounded-2xl bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl">{timeOptions.map(t => <SelectItem key={t} value={t} className="font-bold">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Дата возврата
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full text-sm font-black h-14 rounded-2xl border-slate-100 shadow-sm bg-white hover:bg-slate-50">
                        {endDate ? format(endDate, 'dd MMMM yyyy') : 'ВЫБРАТЬ'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 border-none shadow-2xl rounded-3xl overflow-hidden"><CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} /></PopoverContent>
                  </Popover>
                  <Select value={returnTime} onValueChange={setReturnTime}>
                    <SelectTrigger className="h-12 text-sm font-black rounded-2xl bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl">{timeOptions.map(t => <SelectItem key={t} value={t} className="font-bold">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* LOCATIONS */}
              <div className="grid grid-cols-2 gap-6 p-8 bg-slate-50 rounded-[40px]">
                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase ml-1">Где выдаем</h4>
                    <Select value={pickupLocation} onValueChange={setPickupLocation}>
                      <SelectTrigger className="font-black uppercase text-[10px] h-12 rounded-2xl bg-white border-none shadow-sm"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-2xl">{PICKUP_LOCATIONS.map(l => <SelectItem key={l.id} value={l.id} className="text-[10px] font-bold uppercase">{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input placeholder="АДРЕС ВЫДАЧИ" className="text-xs font-bold h-12 rounded-2xl bg-white border-none shadow-sm" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} />
                 </div>
                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase ml-1">Куда возврат</h4>
                    <Select value={returnLocation} onValueChange={setReturnLocation}>
                      <SelectTrigger className="font-black uppercase text-[10px] h-12 rounded-2xl bg-white border-none shadow-sm"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-2xl">{PICKUP_LOCATIONS.map(l => <SelectItem key={l.id} value={l.id} className="text-[10px] font-bold uppercase">{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input placeholder="АДРЕС ВОЗВРАТА" className="text-xs font-bold h-12 rounded-2xl bg-white border-none shadow-sm" value={returnAddress} onChange={e => setReturnAddress(e.target.value)} />
                 </div>
              </div>

              {/* CUSTOMER INFO */}
              <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 ml-1">Данные клиента</h3>
                <div className="space-y-3">
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-200" />
                    <Input placeholder="ФИО КЛИЕНТА" className="font-black uppercase text-sm h-16 pl-12 rounded-[24px] bg-slate-50 border-none" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                  </div>
                  <div className="flex gap-3">
                    <Select value={contactType} onValueChange={(v: any) => setContactType(v)}>
                      <SelectTrigger className="w-[120px] font-black text-xs h-16 rounded-[24px] bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        <SelectItem value="telegram">TELEGRAM</SelectItem>
                        <SelectItem value="whatsapp">WHATSAPP</SelectItem>
                        <SelectItem value="phone">PHONE</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="КОНТАКТНЫЕ ДАННЫЕ" className="flex-1 font-bold text-sm h-16 rounded-[24px] bg-slate-50 border-none" value={customerContact} onChange={e => setCustomerContact(e.target.value)} />
                  </div>
                </div>
              </div>
              {/* BILLING SECTION */}
              <div className="mt-auto p-8 bg-slate-900 rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8">
                  <Button variant="ghost" size="icon" onClick={copyToClipboard} className="text-white/30 hover:text-[#f8b515] hover:bg-white/10 rounded-full">
                    <Copy size={20} />
                  </Button>
                </div>
                
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-full bg-[#f8b515] flex items-center justify-center text-slate-900">
                    <CircleDollarSign size={20} />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-white/40 leading-none mb-1">Финальный расчет</h3>
                    <p className="text-xs font-bold text-[#f8b515] uppercase">{pricing?.days} Дней аренды</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center group/item">
                    <span className="text-[11px] font-black uppercase text-white/30 group-hover/item:text-white/60 transition-colors">Аренда авто</span>
                    <input 
                      className="bg-transparent text-right font-black text-lg w-24 outline-none focus:text-[#f8b515] transition-colors"
                      value={pricing?.totalRental}
                      onChange={(e) => setManualRental(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-between items-center group/item">
                    <span className="text-[11px] font-black uppercase text-white/30 group-hover/item:text-white/60 transition-colors">Доставка / Возврат</span>
                    <input 
                      className="bg-transparent text-right font-black text-lg w-24 outline-none focus:text-[#f8b515] transition-colors"
                      value={pricing?.totalDelivery}
                      onChange={(e) => setManualDelivery(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-between items-center group/item pb-4 border-b border-white/5">
                    <span className="text-[11px] font-black uppercase text-white/30 group-hover/item:text-white/60 transition-colors">Сумма депозита</span>
                    <input 
                      className="bg-transparent text-right font-black text-lg w-24 outline-none focus:text-green-400 transition-colors"
                      value={pricing?.deposit}
                      onChange={(e) => setManualDeposit(e.target.value)}
                    />
                  </div>
                  <div className="pt-4 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black text-[#f8b515] uppercase mb-1">Итого к оплате</p>
                      <p className="text-5xl font-black tracking-tighter">{pricing?.grandTotal.toLocaleString()} <span className="text-xl">฿</span></p>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400 border-none font-black text-[10px] mb-2 px-3 py-1">READY</Badge>
                  </div>
                </div>
              </div>
            </div>

              {/* FINAL ACTIONS */}
              <div className="flex gap-4 pt-6">
                {isEditing && (
                  <Button variant="outline" size="lg" className="h-20 px-10 border-2 border-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-[32px] transition-all" disabled={isDeleting} onClick={handleDelete}>
                    <Trash2 size={24} />
                  </Button>
                )}
                <Button 
                  className="flex-1 h-20 bg-[#f8b515] hover:bg-[#e2a412] text-white text-xl font-black rounded-[32px] shadow-2xl shadow-orange-100 transition-all active:scale-[0.98]" 
                  disabled={isSubmitting} 
                  onClick={handleSubmit}
                >
                  {isSubmitting ? '...' : isEditing ? 'ОБНОВИТЬ БРОНЬ' : 'ПОДТВЕРДИТЬ И СОЗДАТЬ'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}