import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Car, Booking } from '@/api/api';
import { cn } from '@/lib/utils';
import { useCalendarGrid } from '@/hooks/useCalendarGrid';

// 🎨 Получить URL фото
const getPhotoUrl = (filename: string | null | undefined): string | null => {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;
  
  const API_BASE = import.meta.env.VITE_API_URL || '';
  return `${API_BASE}/images_web/${filename}`;
};

interface SchedulerCalendarProps {
  cars: Car[];
  bookings: Booking[];
  startDate: Date;
  daysToShow: number;
  onDateChange: (date: Date) => void;
  onBookingClick: (booking: Booking) => void;
  onCreateBooking: (carId: string, dateRange: { start: Date; end: Date }) => void;
  selectedClass?: string;
  carOwnersMap?: Record<string, string>;
  isCompactMode?: boolean; // 🆕 Компактный режим
}

const DAY_WIDTH = 24;
const HEADER_HEIGHT = 32;
const SIDEBAR_WIDTH = 60;
const TOTAL_DAYS = 97;

// 🆕 Динамическая высота строк
const getRowHeight = (isCompact: boolean) => isCompact ? 24 : 40;

// 🎨 Цвета для месяцев
const MONTH_COLORS: Record<number, string> = {
  0: '#f8f9fa', 1: '#f1f3f5', 2: '#e9ecef', 3: '#dee2e6',
  4: '#ced4da', 5: '#adb5bd', 6: '#ced4da', 7: '#dee2e6',
  8: '#e9ecef', 9: '#f1f3f5', 10: '#f8f9fa', 11: '#f1f3f5'
};

export function SchedulerCalendar({
  cars,
  bookings,
  startDate,
  onBookingClick,
  onCreateBooking,
  carOwnersMap = {},
  isCompactMode = false, // 🆕 Дефолтное значение
}: SchedulerCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredBooking, setHoveredBooking] = useState<string | null>(null);
  const [selectedCarInfo, setSelectedCarInfo] = useState<{car: Car, owner: string | null} | null>(null);
  const [lastBookingTap, setLastBookingTap] = useState<{
    bookingId: string;
    timestamp: number;
  } | null>(null);
  const DOUBLE_TAP_DELAY = 300;

  // 🆕 Динамическая высота
  const CAR_ROW_HEIGHT = getRowHeight(isCompactMode);

  const {
    dates,
    bookingsByCarId,
    phantomRange,
    hoveredCell,
    setHoveredCell,
    getBookingPosition,
    handleCellTouchStart,
    handleCellTouchMove,
    handleCellTouchEnd,
    isInSelection
  } = useCalendarGrid(startDate, bookings, onCreateBooking);

  useEffect(() => {
    if (scrollRef.current) {
      const today = new Date();
      const todayIndex = dates.findIndex(date => isSameDay(date, today));
      
      if (todayIndex !== -1) {
        const scrollPosition = Math.max(0, (todayIndex - 5) * DAY_WIDTH);
        scrollRef.current.scrollLeft = scrollPosition;
      }
    }
  }, [dates]);

  const handleBookingClick = (booking: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const now = Date.now();
    if (lastBookingTap && lastBookingTap.bookingId === booking.booking_id 
        && (now - lastBookingTap.timestamp) < DOUBLE_TAP_DELAY) {
      onBookingClick(booking);
      setLastBookingTap(null);
    } else {
      setLastBookingTap({ bookingId: booking.booking_id, timestamp: now });
    }
  };

  const totalWidth = TOTAL_DAYS * DAY_WIDTH;

  const formatBookingBadge = (booking: Booking) => {
    const fd = booking.form_data;
    const start = new Date(fd.dates.start);
    const end = new Date(fd.dates.end);
    
    const startStr = `${String(start.getDate()).padStart(2, '0')}.${String(start.getMonth() + 1).padStart(2, '0')}`;
    const endStr = `${String(end.getDate()).padStart(2, '0')}.${String(end.getMonth() + 1).padStart(2, '0')}`;
    const pickupTime = format(start, 'HH:mm');
    
    const line1Parts = [];
    line1Parts.push(`${startStr}-${endStr}`);
    line1Parts.push(pickupTime);
    if (fd.locations?.pickupLocation) line1Parts.push(fd.locations.pickupLocation);
    line1Parts.push(fd.car.name || `${fd.car.brand} ${fd.car.model}`);
    
    const line2Parts = [];
    if (fd.contact?.name) line2Parts.push(fd.contact.name);
    if (fd.contact?.value) line2Parts.push(fd.contact.value);
    
    return {
      line1: line1Parts.join(' • '),
      line2: line2Parts.join(' • ')
    };
  };

 return (
  <div className="relative h-full">
    <div
      ref={scrollRef}
      className="overflow-x-auto overflow-y-auto"
      style={{ height: 'calc(100vh - 60px)' }}
      onMouseUp={() => handleCellTouchEnd()}
      onMouseLeave={() => handleCellTouchEnd()}
    >
      <div style={{ width: totalWidth + SIDEBAR_WIDTH }}>
        {/* Header dates */}
        <div className="sticky top-0 z-20 flex bg-white border-b border-gray-300 shadow-md">
          {/* Sidebar header */}
          <div
            className="sticky left-0 z-30 flex-shrink-0 border-r border-gray-300 px-1 flex items-center justify-center bg-white shadow-sm"
            style={{ width: SIDEBAR_WIDTH, height: HEADER_HEIGHT }}
          >
            <span className="text-[9px] font-bold text-gray-600">Авто</span>
          </div>

          {/* Date cells */}
          <div className="flex">
            {dates.map((date, i) => {
              const isToday = isSameDay(date, new Date());
              const isFirstOfMonth = date.getDate() === 1;

              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col items-center justify-center relative cursor-pointer hover:bg-gray-200 border-r border-gray-300/30",
                    isToday && "bg-blue-100 font-bold"
                  )}
                  style={{
                    width: DAY_WIDTH,
                    height: HEADER_HEIGHT
                  }}
                >
                  {isFirstOfMonth && (
                    <span className="absolute top-0 text-[7px] font-bold text-orange-600">
                      {format(date, 'MMM', { locale: ru })}
                    </span>
                  )}
                  <span className={cn(
                    "text-[8px] uppercase",
                    isToday ? "text-blue-700 font-bold" : "text-gray-500"
                  )}>
                    {format(date, 'EEEEEE', { locale: ru })}
                  </span>
                  <span className={cn(
                    "text-[10px] font-semibold",
                    isToday ? "text-blue-700" : "text-gray-700"
                  )}>
                    {format(date, 'd')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Car rows */}
        {cars.map((car) => {
          const carBookings = bookingsByCarId.get(car.id) || [];
          const ownerBadge = carOwnersMap[car.id];

          return (
            <div
              key={car.id}
              className={cn(
                "flex border-b border-gray-300/30 transition-all duration-200"
              )}
              style={{ height: CAR_ROW_HEIGHT }}
            >
              {/* Sidebar */}
              <div
                className={cn(
                  "sticky left-0 z-10 flex-shrink-0 flex items-center px-1 border-r border-gray-300 bg-white shadow-sm cursor-pointer hover:bg-gray-50 transition-all",
                  isCompactMode ? "flex-row gap-1 py-0.5" : "flex-col justify-center py-0.5"
                )}
                style={{ width: SIDEBAR_WIDTH }}
                onClick={() => {
                  setSelectedCarInfo({ car, owner: ownerBadge || null });
                }}
              >
                {/* 🆕 Фото - показываем только если НЕ компактный режим */}
                {!isCompactMode && (
                  <div className="relative w-full aspect-video rounded overflow-hidden bg-gray-200">
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundImage: car.photos?.main ? `url(${getPhotoUrl(car.photos.main)})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    />
                  </div>
                )}

                {/* Текст */}
                <div className={cn(
                  "w-full text-center",
                  isCompactMode ? "mt-0" : "mt-0.5"
                )}>
                  <div className={cn(
                    "font-bold text-gray-900 leading-none truncate",
                    isCompactMode ? "text-[6px]" : "text-[7px]"
                  )}>
                    {car.brand} {car.model}
                  </div>
                </div>
              </div>

              {/* Calendar cells */}
              <div className="flex-1 relative" style={{ height: CAR_ROW_HEIGHT }}>
                {/* Day cells */}
                <div className="absolute inset-0 flex">
                  {dates.map((date, i) => {
                    const monthBg = MONTH_COLORS[date.getMonth()];
                    const isToday = isSameDay(date, new Date());
                    const isSelected = isInSelection(car.id, i);
                    const isPhantomRangeInCell = phantomRange && car.id === phantomRange.carId && i >= phantomRange.start && i <= phantomRange.end;
                    const isHovered = !isSelected && !isPhantomRangeInCell && hoveredBooking === null && hoveredCell?.carId === car.id && hoveredCell?.dayIndex === i;

                    return (
                      <div
                        key={i}
                        className={cn(
                          "transition-colors border-r border-gray-300/30",
                          isToday && "bg-blue-100/50",
                          isSelected && "bg-orange-300/50",
                          isPhantomRangeInCell && "bg-orange-200/50",
                          isHovered && "bg-orange-100/30"
                        )}
                        style={{
                          width: DAY_WIDTH,
                          height: '100%',
                          backgroundColor:
                            !isToday &&
                              !isSelected &&
                              !isPhantomRangeInCell &&
                              !isHovered
                              ? monthBg
                              : undefined,
                        }}
                        onMouseDown={(e) => handleCellTouchStart(car.id, i, e)}
                        onMouseUp={handleCellTouchEnd}
                        onMouseEnter={() => { handleCellTouchMove(i); setHoveredCell({ carId: car.id, dayIndex: i }); }}
                        onMouseLeave={() => setHoveredCell(null)}
                        onTouchStart={(e) => handleCellTouchStart(car.id, i, e)}
                        onTouchEnd={handleCellTouchEnd}
                      />
                    );
                  })}
                </div>

                {/* Booking bars */}
                <div className="absolute inset-0 pointer-events-none">
                  {carBookings.map((booking) => {
                    const position = getBookingPosition(booking, DAY_WIDTH);
                    if (!position) return null;

                    const badgeData = formatBookingBadge(booking);
                    // Color coding for new booking status system
                    const bgColor =
                      booking.status === 'confirmed'
                        ? 'rgba(74, 227, 69, 0.9)'
                        : booking.status === 'rejected'
                          ? 'rgba(239, 68, 68, 0.15)'  // Очень прозрачный красный
                          : 'rgba(226, 221, 233, 0.89)';  // pre_booking - серый

                    return (
                      <div
  key={booking.booking_id}
  className={cn(
    "absolute top-[6px] bottom-[6px] pointer-events-auto cursor-pointer transition-all",
    hoveredBooking === booking.booking_id && "ring-1 ring-blue-400 z-10"
  )}
  style={{
    left: position.left + 2,
    width: position.width - 4,
    backgroundColor: bgColor,
    clipPath: "polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)",
    boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
  }}


                        onClick={(e) => handleBookingClick(booking, e)}
                        onMouseEnter={() => setHoveredBooking(booking.booking_id)}
                        onMouseLeave={() => setHoveredBooking(null)}
                      >
                        {booking.status === 'pre_booking' && (
                          <div className="absolute bottom-[1px] right-[6px] text-[6px] px-[2px] rounded-[1px] bg-gray-400/70 text-white font-semibold uppercase pointer-events-none">
                            ПРЕДБРОНЬ
                          </div>
                        )}
                        {booking.status === 'rejected' && (
                          <div className="absolute bottom-[1px] right-[6px] text-[6px] px-[2px] rounded-[1px] bg-red-500/30 text-red-600 font-semibold uppercase pointer-events-none">
                            ОТКЛОНЕН
                          </div>
                        )}

                        <div className="px-0.5 pl-[8px] pr-[2px] h-full flex flex-col justify-center overflow-hidden leading-tight">
                          <div className={cn(
                            "font-semibold text-white-800 whitespace-nowrap overflow-hidden text-ellipsis",
                            isCompactMode ? "text-[6px]" : "text-[7px]"
                          )}>
                            {badgeData.line1}
                          </div>

                          {!isCompactMode && (
                            <div className="text-[7px] font-medium text-white-700 whitespace-nowrap overflow-hidden text-ellipsis">
                              {badgeData.line2}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Диалог с инфо о машине */}
      {selectedCarInfo && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCarInfo(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Фото */}
            <div className="aspect-video rounded-xl overflow-hidden bg-gray-200 mb-4">
              <div
                className="w-full h-full"
                style={{
                  backgroundImage: selectedCarInfo.car.photos?.main
                    ? `url(${getPhotoUrl(selectedCarInfo.car.photos.main)})`
                    : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              />
            </div>

            {/* Инфо */}
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedCarInfo.car.brand} {selectedCarInfo.car.model}
                </h3>
                <p className="text-sm text-gray-600">{selectedCarInfo.car.year}</p>
              </div>

              {selectedCarInfo.owner && (
                <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                  <div>
                    <p className="text-xs text-gray-600">Владелец</p>
                    <p className="text-sm font-semibold text-purple-700">{selectedCarInfo.owner}</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedCarInfo(null)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
}