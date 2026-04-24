import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, CreditCard, Clock, User, Phone, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { createBookingFromCRM } from '@/api/api';

interface Car {
  id: string;
  name: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  daily_rate: number;
  deposit: number;
  category: string;
}

interface BookingCreateForCRMProps {
  userId: number | string;
  userName?: string;
  userContact?: string;
  initialDateRange?: { start: Date; end: Date };
  onSuccess: () => void;
  onClose: () => void;
}

export function BookingCreateForCRM({
  userId,
  userName,
  userContact,
  initialDateRange,
  onSuccess,
  onClose
}: BookingCreateForCRMProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Car selection state
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [startDate, setStartDate] = useState<Date>(
    initialDateRange?.start || new Date()
  );
  const [endDate, setEndDate] = useState<Date>(
    initialDateRange?.end || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  );
  
  // Locations
  const [pickupLocation, setPickupLocation] = useState('airport');
  const [returnLocation, setReturnLocation] = useState('airport');
  const [pickupAddress, setPickupAddress] = useState('');
  const [returnAddress, setReturnAddress] = useState('');
  
  // Times
  const [pickupTime, setPickupTime] = useState('13:00');
  const [returnTime, setReturnTime] = useState('13:00');
  
  // Contact
  const [customerName, setCustomerName] = useState(userName || '');
  const [customerContact, setCustomerContact] = useState(userContact || '');
  const [contactType, setContactType] = useState<'telegram' | 'whatsapp' | 'phone'>('telegram');

  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;
  const rentalPrice = selectedCar ? selectedCar.daily_rate * days : 0;
  const deliveryPrice = (pickupLocation !== 'airport' ? 500 : 0) + (returnLocation !== 'airport' ? 500 : 0);
  const deposit = selectedCar?.deposit || 5000;
  const grandTotal = rentalPrice + deliveryPrice;

  const handleSubmit = async () => {
    if (!selectedCar) {
      toast.error('Выберите автомобиль');
      return;
    }
    
    setLoading(true);
    try {
      const carName = `${selectedCar.brand} ${selectedCar.model} ${selectedCar.year}`.trim();
      
      await createBookingFromCRM({
        user_id: userId,
        car_id: selectedCar.id,
        car_name: carName,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        days: days,
        total_rental: rentalPrice,
        total_delivery: deliveryPrice,
        deposit: deposit,
        pickup_location: pickupLocation,
        return_location: returnLocation,
        source: 'crm_admin',
      });
      
      toast.success('Бронь создана!');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка создания брони');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold">Создание брони</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Дата выдачи</label>
              <Input 
                type="date" 
                value={startDate.toISOString().split('T')[0]}
                onChange={(e) => setStartDate(new Date(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Дата возврата</label>
              <Input 
                type="date" 
                value={endDate.toISOString().split('T')[0]}
                onChange={(e) => setEndDate(new Date(e.target.value))}
                className="mt-1"
              />
            </div>
          </div>
          
          {/* Car (simplified - in real app would show car list) */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Автомобиль</label>
            <Input 
              placeholder="Введите ID или название авто"
              value={selectedCar ? `${selectedCar.brand} ${selectedCar.model}` : ''}
              onChange={(e) => {
                if (!e.target.value) setSelectedCar(null);
              }}
              className="mt-1"
            />
            <p className="text-xs text-slate-400 mt-1">В реальном приложении здесь будет список машин</p>
          </div>
          
          {/* Locations */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Место выдачи</label>
              <select 
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg"
              >
                <option value="airport">Аэропорт</option>
                <option value="hotel">Отель</option>
                <option value="office">Офис</option>
                <option value="other">Другое</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Место возврата</label>
              <select 
                value={returnLocation}
                onChange={(e) => setReturnLocation(e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg"
              >
                <option value="airport">Аэропорт</option>
                <option value="hotel">Отель</option>
                <option value="office">Офис</option>
                <option value="other">Другое</option>
              </select>
            </div>
          </div>
          
          {/* Contact */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Имя клиента</label>
            <Input 
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Имя"
              className="mt-1"
            />
          </div>
          
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Контакт</label>
            <Input 
              value={customerContact}
              onChange={(e) => setCustomerContact(e.target.value)}
              placeholder="Телефон или username"
              className="mt-1"
            />
          </div>
          
          {/* Pricing summary */}
          <Card className="bg-slate-50">
            <CardContent className="p-4">
              <div className="flex justify-between text-sm">
                <span>Аренда ({days} дн.):</span>
                <span className="font-bold">{rentalPrice.toLocaleString()} ฿</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Доставка:</span>
                <span className="font-bold">{deliveryPrice.toLocaleString()} ฿</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Депозит:</span>
                <span className="font-bold">{deposit.toLocaleString()} ฿</span>
              </div>
              <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t">
                <span>Итого:</span>
                <span className="text-blue-600">{grandTotal.toLocaleString()} ฿</span>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="p-4 border-t sticky bottom-0 bg-white">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Отмена
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !selectedCar}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Создание...' : 'Создать бронь'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
