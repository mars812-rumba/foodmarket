import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfDay, startOfMonth } from 'date-fns';
import { Filter, LayoutGrid, List, ZoomIn, ZoomOut, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { SchedulerCalendar } from '@/components/admin/SchedulerCalendar';
import { MonthCalendarView } from '@/components/admin/MonthCalendarView';
import { BookingFormDialog } from '@/components/admin/BookingFormDialog';
import { DayDetailsModal } from '@/components/admin/DayDetailsModal';
import { fetchCars, fetchBookings, fetchCarOwners, Car, Booking, fetchBookingsLogistics, fetchOwnersList } from '@/api/api.ts';
import logo from '@/assets/logo.png';

const CAR_CLASSES = [
  { id: 'all', name: 'Все классы' },
  { id: 'compact', name: 'Компакт' },
  { id: 'sedan', name: 'Седан' },
  { id: 'suv', name: 'SUV' },
  { id: '7s', name: '7 мест' },
  { id: 'bikes', name: 'Байки' },
];

type ViewMode = 'month' | 'gantt';
const DOUBLE_TAP_DELAY = 300;

export default function AdminScheduler() {
  const [currentDate, setCurrentDate] = useState<Date>(startOfMonth(new Date()));
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedOwner, setSelectedOwner] = useState<string>('all');
  const [daysToShow, setDaysToShow] = useState(30);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [carOwnersMap, setCarOwnersMap] = useState<Record<string, string>>({});
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [ownersList, setOwnersList] = useState<{ id: string; name: string }[]>([]);

  const { data: logisticsData = [], isLoading: logisticsLoading, refetch: refetchLogistics } = useQuery({
    queryKey: ['admin-logistics'],
    queryFn: fetchBookingsLogistics,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [initialDateRange, setInitialDateRange] = useState<{ start: Date; end: Date } | undefined>();

  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<any[]>([]);

  const [lastTap, setLastTap] = useState<{
    id: string;
    timestamp: number;
  } | null>(null);

  const { data: cars = [], isLoading: carsLoading, refetch: refetchCars } = useQuery({
    queryKey: ['admin-cars'],
    queryFn: () => fetchCars(),
  });

  const { data: bookings = [], isLoading: bookingsLoading, refetch: refetchBookings } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: () => fetchBookings(),
  });

  useEffect(() => {
    fetchCarOwners().then(setCarOwnersMap);
    fetchOwnersList().then(setOwnersList).catch(() => setOwnersList([]));
  }, []);

  const filteredCars = cars.filter(car => {
    const matchesClass = selectedClass === 'all' || car.class === selectedClass;
    const carOwnerId = carOwnersMap[car.id];
    const matchesOwner = selectedOwner === 'all' || carOwnerId === selectedOwner;
    return matchesClass && matchesOwner;
  });

  const filteredBookings = bookings.filter(booking => {
    const car = cars.find(c => c.id === booking.form_data.car.id);
    const matchesClass = selectedClass === 'all' || car?.class === selectedClass;
    const carOwnerId = car ? carOwnersMap[car.id] : undefined;
    const matchesOwner = selectedOwner === 'all' || carOwnerId === selectedOwner;
    return matchesClass && matchesOwner;
  });

  const filteredLogisticsData = logisticsData.filter(item => {
    const matchesClass = selectedClass === 'all' || cars.find(c => c.id === item.car_id)?.class === selectedClass;
    const carOwnerId = carOwnersMap[item.car_id];
    const matchesOwner = selectedOwner === 'all' || carOwnerId === selectedOwner;
    return matchesClass && matchesOwner;
  });

  const handleBookingClick = (booking: Booking) => {
    const car = cars.find(c => c.id === booking.form_data.car.id);
    setSelectedCar(car || null);
    setSelectedBooking(booking);
    setIsModalOpen(true);
  };

  const handleCreateBooking = (carId: string, dateRange: { start: Date; end: Date }) => {
    const now = Date.now();
    const tapId = `gantt-${carId}-${dateRange.start.getTime()}`;

    if (lastTap && lastTap.id === tapId && (now - lastTap.timestamp) < DOUBLE_TAP_DELAY) {
      const car = cars.find(c => c.id === carId);
      if (car) {
        setSelectedCar(car);
        setSelectedBooking(null);
        setInitialDateRange(dateRange);
        setIsModalOpen(true);
      }
      setLastTap(null);
    } else {
      setLastTap({ id: tapId, timestamp: now });
    }
  };

  const handleMonthCreateBooking = (dateRange: { start: Date; end: Date }) => {
    setSelectedCar(null);
    setSelectedBooking(null);
    setInitialDateRange(dateRange);
    setIsModalOpen(true);
  };

  const handleDayClick = (date: Date, events: any[]) => {
    const now = Date.now();
    const tapId = `month-${date.getTime()}`;

    if (lastTap && lastTap.id === tapId && (now - lastTap.timestamp) < DOUBLE_TAP_DELAY) {
      if (events.length > 0) {
        setSelectedDate(date);
        setSelectedDayEvents(events);
        setIsDayModalOpen(true);
      } else {
        setSelectedCar(null);
        setSelectedBooking(null);
        setInitialDateRange({ start: date, end: date });
        setIsModalOpen(true);
      }
      setLastTap(null);
    } else {
      setLastTap({ id: tapId, timestamp: now });
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCar(null);
    setSelectedBooking(null);
    setInitialDateRange(undefined);
  };

  const handleDayModalClose = () => {
    setIsDayModalOpen(false);
    setSelectedDate(null);
    setSelectedDayEvents([]);
  };

  const handleBookingSuccess = () => {
    refetchBookings();
    refetchCars();
    refetchLogistics();
  };

  useEffect(() => {
    const updateDaysToShow = () => {
      const width = window.innerWidth;
      setDaysToShow(width < 768 ? 14 : 30);
    };
    updateDaysToShow();
    window.addEventListener('resize', updateDaysToShow);
    return () => window.removeEventListener('resize', updateDaysToShow);
  }, []);

  const isLoading = carsLoading || bookingsLoading || logisticsLoading;

  const resetFilters = () => {
    setSelectedClass('all');
    setSelectedOwner('all');
  };

  const hasActiveFilters = selectedClass !== 'all' || selectedOwner !== 'all';

  return (
    <div className="w-full min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-2 shadow-md">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-7 w-auto" />
            <span className="text-sm font-semibold text-gray-900">Занятость</span>
          </div>

          {/* Переключатель вида */}
          <div className="flex bg-gray-100 rounded-md p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('month')}
              className={`h-7 px-2 text-xs font-medium ${
                viewMode === 'month'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="h-3 w-3 mr-1" />
              Месяц
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('gantt')}
              className={`h-7 px-2 text-xs font-medium ${
                viewMode === 'gantt'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="h-3 w-3 mr-1" />
              Гант
            </Button>
          </div>
        </div>
      </div>

{/* Фильтры */}
<div className="sticky top-[50px] z-30 bg-gray-100 border-b border-gray-200 px-3 py-2">
  {/* Строка 1: фильтры */}
  <div className="flex items-center gap-2 mb-2">
    <Filter className="h-3 w-3 text-gray-500 shrink-0" />
    <Select value={selectedClass} onValueChange={setSelectedClass}>
      <SelectTrigger className="flex-1 h-8 text-xs bg-white border-gray-300">
        <SelectValue placeholder="Все классы" />
      </SelectTrigger>
      <SelectContent>
        {CAR_CLASSES.map(cls => (
          <SelectItem key={cls.id} value={cls.id}>
            {cls.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Select value={selectedOwner} onValueChange={setSelectedOwner}>
      <SelectTrigger className="flex-1 h-8 text-xs bg-white border-gray-300">
        <SelectValue placeholder="Все владельцы" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Все владельцы</SelectItem>
        {ownersList.map(owner => (
          <SelectItem key={owner.id} value={owner.id}>
            {owner.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* Строка 2: счётчик + сброс */}
  <div className="flex items-center justify-between">
    <span className="text-xs text-gray-500">
      {filteredCars.length} авто / {filteredLogisticsData.length} доставок
    </span>
    {hasActiveFilters && (
      <Button
        variant="ghost"
        size="sm"
        onClick={resetFilters}
        className="h-6 px-2 text-xs text-gray-500 hover:text-gray-900"
      >
        ✕ Сбросить
      </Button>
    )}
  </div>
</div>

      <main className="w-full p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-[80vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : viewMode === 'month' ? (
          <MonthCalendarView
            currentDate={currentDate}
            bookings={filteredBookings}
            logisticsData={filteredLogisticsData}
            onDateChange={setCurrentDate}
            onBookingClick={handleBookingClick}
            onDayClick={handleDayClick}
            onCreateBooking={handleMonthCreateBooking}
          />
        ) : (
          <SchedulerCalendar
            cars={filteredCars}
            bookings={filteredBookings}
            startDate={startDate}
            daysToShow={daysToShow}
            onDateChange={setStartDate}
            onBookingClick={handleBookingClick}
            onCreateBooking={handleCreateBooking}
            selectedClass={selectedClass}
            carOwnersMap={carOwnersMap}
            isCompactMode={isCompactMode}
          />
        )}
      </main>

      <BookingFormDialog
        key={selectedBooking?.booking_id || 'new'}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        booking={selectedBooking}
        initialDateRange={initialDateRange}
        onSuccess={handleBookingSuccess}
      />

      <DayDetailsModal
        isOpen={isDayModalOpen}
        onClose={handleDayModalClose}
        date={selectedDate}
        events={selectedDayEvents}
        onBookingClick={handleBookingClick}
      />
    </div>
  );
}