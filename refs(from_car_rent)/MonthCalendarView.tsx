import React, { useMemo, useCallback, useEffect, memo, useState, useRef } from 'react';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  addDays, addMonths, isSameMonth, isToday 
} from 'date-fns';
import { ru } from 'date-fns/locale';
import useEmblaCarousel from 'embla-carousel-react';
import { LogisticsDate, Booking } from '@/api/api.ts'; 
import { cn } from '@/lib/utils';
import { DayDetailsModal } from './DayDetailsModal'; 

interface DayEvent {
  type: 'pickup' | 'return';
  time: string;
  carName: string;
  clientName: string;
  location: string;
  booking_id: string;
  booking: Booking;
}

interface MonthCalendarViewProps {
  currentDate: Date;
  bookings: Booking[];
  logisticsData: LogisticsDate[];
  onDateChange: (date: Date) => void;
  onBookingClick: (booking: Booking) => void;
  onDayClick?: (date: Date, events: DayEvent[]) => void;
  onCreateBooking?: (dateRange: { start: Date; end: Date }) => void;
}

const getMonthLetters = (date: Date) => {
  let name = format(date, 'LLLL', { locale: ru }).toUpperCase();
  if (name === 'СЕНТЯБРЬ') name = 'СЕНТЯБР'; 
  return name.split('');
};

const MonthGrid = memo(({ 
  date, 
  eventsByDay, 
  onDayClick,
  onBadgeClick
}: { 
  date: Date, 
  eventsByDay: Map<string, DayEvent[]>,
  onDayClick: (date: Date, events: DayEvent[]) => void,
  onBadgeClick: (event: DayEvent, e: React.MouseEvent) => void
}) => {
  const days = useMemo(() => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(monthStart);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const res = [];
    let d = start;
    while (d <= end) { res.push(d); d = addDays(d, 1); }
    return res;
  }, [date]);

  const monthLetters = useMemo(() => getMonthLetters(date), [date]);
  const yearString = format(date, 'yyyy');
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="flex-[0_0_100%] w-full relative">
      {/* ФОНОВАЯ ПОДЛОЖКА */}
      <div className="absolute inset-0 pointer-events-none select-none flex flex-col">
        <div className="h-[100px]" />
        <div className="h-[100px] flex items-center justify-center">
          <div className="flex justify-center items-center gap-4 px-4 text-slate-200/40 text-3xl font-black tracking-[0.2em] uppercase italic">
            {monthLetters.map((char, i) => <span key={i}>{char}</span>)}
          </div>
        </div>
        <div className="h-[100px] flex items-center justify-center text-slate-100/50 text-6xl font-black tracking-tighter italic">
          {yearString}
        </div>
      </div>

      <div className="relative z-10 grid grid-flow-row auto-rows-fr divide-y divide-gray-100 border-t border-gray-100">
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="grid grid-cols-7 divide-x divide-gray-100">
            {week.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const events = eventsByDay.get(dayKey) || [];
              const isCurrentMonth = isSameMonth(day, date);
              const dayIsToday = isToday(day);

              return (
                <div
                  key={dayKey}
                  className={cn(
                    "min-h-[100px] p-0.5 transition-colors cursor-pointer group bg-transparent",
                    !isCurrentMonth ? "opacity-60" : "hover:bg-blue-60/50"
                  )}
                  onClick={() => onDayClick(day, events, false)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={cn(
                      "text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full transition-colors",
                      dayIsToday ? "bg-blue-600 text-white shadow-md" : isCurrentMonth ? "text-slate-500" : "text-gray-300"
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  
                  <div className="space-y-0.5 overflow-hidden font-sans">
                    {events.slice(0, 4).map((ev, idx) => {
                      // Цвет в зависимости от статуса брони
                      const isPreBooking = ev.booking?.status === 'pre_booking';
                      const bgClass = isPreBooking
                        ? "bg-slate-200 text-slate-600"
                        : ev.type === 'pickup' 
                          ? "bg-green-400 text-green-900"
                          : "bg-yellow-400 text-yellow-900";
                      
                      return (
                        <div 
                          key={idx}
                          className={cn(
                            "w-full h-[13px] px-1 text-[6px] font-medium cursor-pointer hover:ring-1 hover:ring-blue-400 transition-all rounded-[2px] flex items-center justify-center",
                            bgClass
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onBadgeClick(ev, e);
                          }}
                        >
                          <span className="truncate tracking-tight">
                            {ev.carName}
                          </span>
                        </div>
                      );
                    })}
                    
                    {events.length > 4 && (
                      <div 
                        className="text-[7px] text-blue-500 font-bold pl-1 cursor-pointer hover:text-blue-700" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          // Открыть popup только с теми бейджами которые не влезли
                          onDayClick && onDayClick(new Date(dayKey), events.slice(4), true);
                        }}
                      >
                        + ещё {events.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});

export function MonthCalendarView({
  currentDate,
  bookings,
  logisticsData,
  onDateChange,
  onBookingClick,
  onDayClick,
  onCreateBooking,
}: MonthCalendarViewProps) {
  
  const [selectedDayData, setSelectedDayData] = useState<{
    isOpen: boolean;
    date: Date | null;
    events: DayEvent[];
  }>({ isOpen: false, date: null, events: [] });

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, startIndex: 1, duration: 30 });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    if (!logisticsData || !bookings) return map;

    logisticsData.forEach((item) => {
      // Ищем реальную бронь в массиве актуальных броней
      const fullBooking = bookings.find(b => b.booking_id === item.booking_id);

      // КРИТИЧЕСКИЙ МОМЕНТ: Если брони нет в списке активных, 
      // значит она удалена — игнорируем её для календаря
      if (!fullBooking) return; 

      // Фильтруем отмененные и отклоненные брони
      if (fullBooking.status === 'cancelled' || fullBooking.status === 'rejected') return;

      const baseEvent = {
        carName: item.car_name,
        clientName: item.client_name,
        location: item.location || 'Не указано',
        booking_id: item.booking_id,
        booking: fullBooking,
        bookingStatus: fullBooking.status  // для определения цвета
      };

      const pDate = item.pickup_date ? new Date(item.pickup_date) : null;
      const rDate = item.return_date ? new Date(item.return_date) : null;

      if (!pDate || isNaN(pDate.getTime())) {
        // Пропускаем если нет pickup даты
      } else {
        const pKey = format(pDate, 'yyyy-MM-dd');
        if (!map.has(pKey)) map.set(pKey, []);
        map.get(pKey)!.push({ ...baseEvent, type: 'pickup', time: format(pDate, 'HH:mm') });
      }

      if (rDate && !isNaN(rDate.getTime())) {
        const rKey = format(rDate, 'yyyy-MM-dd');
        if (!map.has(rKey)) map.set(rKey, []);
        map.get(rKey)!.push({ ...baseEvent, type: 'return', time: format(rDate, 'HH:mm') });
      }
    });

    return map;
  }, [logisticsData, bookings]);

  const handleInnerDayClick = useCallback((date: Date, events: DayEvent[], isOverflowClick = false) => {
    // Click on empty space - create booking immediately (только если не overflow click)
    if (onCreateBooking && !isOverflowClick) {
      onCreateBooking({ start: date, end: date });
    }
    if (onDayClick) onDayClick(date, events);
  }, [onDayClick, onCreateBooking]);

  const handleBadgeClick = useCallback((event: DayEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    // Click on badge - open booking for editing
    if (event.booking) {
      onBookingClick(event.booking);
    }
  }, [onBookingClick]);

  // Защита от двойного переключения
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = async () => {
      if (isAnimatingRef.current) return;
      const index = emblaApi.selectedScrollSnap();
      if (index === 0) {
        isAnimatingRef.current = true;
        onDateChange(addMonths(currentDate, -1));
        await emblaApi.scrollTo(1, true);
        isAnimatingRef.current = false;
      } else if (index === 2) {
        isAnimatingRef.current = true;
        onDateChange(addMonths(currentDate, 1));
        await emblaApi.scrollTo(1, true);
        isAnimatingRef.current = false;
      }
    };
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, currentDate, onDateChange]);

  return (
    <div className="bg-white min-h-[600px] w-full flex flex-col select-none overflow-hidden relative">
      <div className="grid grid-cols-7 bg-white relative z-20 pt-2 border-b border-gray-50 font-sans">
        {[
          { name: 'Пн', isWeekend: false },
          { name: 'Вт', isWeekend: false },
          { name: 'Ср', isWeekend: false },
          { name: 'Чт', isWeekend: false },
          { name: 'Пт', isWeekend: false },
          { name: 'Сб', isWeekend: true },
          { name: 'Вс', isWeekend: true }
        ].map((day, i) => (
          <div key={i} className={cn(
            "py-2 text-center text-[10px] font-bold uppercase",
            day.isWeekend ? "text-red-400" : "text-slate-500"
          )}>{day.name}</div>
        ))}
      </div>

      <div className="overflow-hidden flex-1 cursor-grab active:cursor-grabbing w-full" ref={emblaRef}>
        <div className="flex h-full">
          <MonthGrid date={addMonths(currentDate, -1)} eventsByDay={eventsByDay} onDayClick={handleInnerDayClick} onBadgeClick={handleBadgeClick} />
          <MonthGrid date={currentDate} eventsByDay={eventsByDay} onDayClick={handleInnerDayClick} onBadgeClick={handleBadgeClick} />
          <MonthGrid date={addMonths(currentDate, 1)} eventsByDay={eventsByDay} onDayClick={handleInnerDayClick} onBadgeClick={handleBadgeClick} />
        </div>
      </div>

      <DayDetailsModal 
        isOpen={selectedDayData.isOpen}
        onClose={() => setSelectedDayData(prev => ({ ...prev, isOpen: false }))}
        date={selectedDayData.date}
        events={selectedDayData.events}
        onBookingClick={(booking) => {
          onBookingClick(booking);
          setSelectedDayData(prev => ({ ...prev, isOpen: false }));
        }}
      />
    </div>
  );
}