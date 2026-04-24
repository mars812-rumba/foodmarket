// API service for FastAPI backend
// Должно быть:
const API_BASE_URL = import.meta.env.DEV 
  ? 'http://127.0.0.1:5000' 
  : 'https://sunny-rentals.online';  // или просто без порта, если nginx проксирует
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || 'sunny2025';
const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN || 'secret-auth-token-for-sunny-rentals';
import { differenceInDays } from 'date-fns';

// api.ts - добавить эти функции

export interface LogisticsDate {
  booking_id: string;
  car_id: string;
  car_name: string;
  pickup_date: string;
  return_date: string;
  client_name: string;
  location: string;
}

export interface LogisticsSummary {
  pickups: Record<string, number>; // { "2026-01-20": 3, ... }
  returns: Record<string, number>; // { "2026-01-25": 2, ... }
}

export async function fetchBookingsLogistics(): Promise<LogisticsDate[]> {
  // Добавляем /api перед путем, если твой API_PREFIX на бэкенде равен "/api"
  const response = await fetch(`${API_BASE_URL}/api/bookings/logistics?t=${Date.now()}`); 
  if (!response.ok) throw new Error('Failed to fetch logistics');
  return response.json();
}

export async function fetchLogisticsSummary(): Promise<LogisticsSummary> {
  const response = await fetch(`${API_BASE_URL}/api/bookings/logistics/summary`);
  if (!response.ok) throw new Error('Failed to fetch logistics summary');
  return response.json();
}

// ПРИМЕР ИСПОЛЬЗОВАНИЯ В КОМПОНЕНТЕ:

/*
import { useQuery } from '@tanstack/react-query';
import { fetchLogisticsSummary } from '@/api/api';

export function MonthCalendarView() {
  const { data: logisticsSummary } = useQuery({
    queryKey: ['logistics-summary'],
    queryFn: fetchLogisticsSummary,
  });

  // Теперь можно использовать для бейджей:
  const pickupsCount = logisticsSummary?.pickups['2026-01-20'] || 0;
  const returnsCount = logisticsSummary?.returns['2026-01-20'] || 0;
}
*/

export interface Car {
  id: string;
  name: string;
  class: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  available: boolean;
  photos: {
    main: string;
    gallery: string[];
  };
  pricing: {
    low_season: {
      price_1_6: number;
      price_7_14: number;
      price_15_29: number;
      price_30: number;
    };
    high_season: {
      price_1_6: number;
      price_7_14: number;
      price_15_29: number;
      price_30: number;
    };
    deposit: number;
  };
  specs: {
    fuel: string;
    engine: string;
    power: string;
    transmission: string;
  };
  supplier: string;
  quick_id?: string;
  rating: number;
}

export interface BookingFormData {
  car: {
    id: string;
    name: string;
    brand: string;
    model: string;
    year: string;
    color: string;
  };
  dates: {
    start: string;
    end: string;
    days: number;
  };
  locations: {
    pickupLocation: string;
    returnLocation: string;
    pickupAddress?: string;
    returnAddress?: string;
  };
  pricing: {
    dailyRate: number;
    totalRental: number;
    deposit: number;
    deliveryPickup: number;
    deliveryReturn: number;
    totalDelivery: number;
    grandTotal: number;
  };
  contact: {
    value: string;
    type: string;
    name?: string;
    phone?: string;
  };
  personalInfo?: {
    hotel?: string;
    name?: string;
    telegram?: string;
    whatsapp?: string;
    notes?: string;
  };
  timestamp: string;
}

export interface Booking {
  booking_id: string;
  user_id: string | number;
  form_data: BookingFormData;
  status: string;
  source: BookingSource;
  created_at: string;
}

interface LeadTrackData {
  startDate?: string;
  endDate?: string;
  days?: number;
  category?: string;
  pickupLocation?: string;
  returnLocation?: string;
  car?: {
    id: string;
    name: string;
    brand: string;
    model: string;
    year: string;
    color: string;
  };
  dates?: {
    start: string;
    end: string;
    days: number;
  };
}

// Fetch all cars
export async function fetchCars(category?: string): Promise<Car[]> {
  const url = category 
    ? `${API_BASE_URL}/api/cars?category=${category}`
    : `${API_BASE_URL}/api/cars`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch cars');
  }
  const data = await response.json();
  return data.cars || [];
}

/*
  Track user events in CRM
  @param eventType - Type of event: 'webapp_opened', 'filters_used', 'booking_submitted'
  @param data - Optional event data
*/
export async function trackLeadEvent(
  eventType: 'webapp_opened' | 'filters_used' | 'booking_submitted',
  data?: LeadTrackData
): Promise<void> {
  try {
    let userId: string;
    let username: string | null;
    
    // Try to get Telegram user data first
    const telegramUserId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    const telegramUsername = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.username;
    
    if (telegramUserId) {
      // Telegram user - use their Telegram ID
      userId = telegramUserId.toString();
      username = telegramUsername || null;
      console.log(`📱 Telegram user detected: ${userId}`);
    } else {
      // Non-Telegram user - generate consistent session ID
      const sessionId = getOrCreateSessionId();
      userId = `web_session_${sessionId}`;
      username = null;
      console.log(`🌐 Non-Telegram user detected: ${userId}`);
    }
    
    const response = await fetch(`${API_BASE_URL}/api/leads/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        username: username,
        event_type: eventType,
        data: data || null
      })
    });
    
    if (!response.ok) {
      console.error('Failed to track event:', response.status, response.statusText);
    } else {
      const result = await response.json();
      console.log(`✅ Tracked: ${eventType} for ${userId} → ${result.current_status || 'success'}`);
    }
    
  } catch (error) {
    console.error('Error tracking lead event:', error);
    // Не падаем если tracking failed - это не критично
  }
}

// Generate and persist session ID for non-Telegram users
function getOrCreateSessionId(): string {
  const STORAGE_KEY = 'sunny_rentals_session_id';
  
  // Try to get existing session ID
  let sessionId = localStorage.getItem(STORAGE_KEY);
  
  // If no session ID exists, create a new one
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(STORAGE_KEY, sessionId);
    console.log(`🔑 Generated new session ID: ${sessionId}`);
  }
  
  return sessionId;
}

// Generate a unique session ID
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 9);
  const userAgent = navigator.userAgent;
  const hash = simpleHash(userAgent + timestamp + randomStr);
  return `${timestamp}_${randomStr}_${hash}`;
}

// Simple hash function for consistency
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Fetch all bookings
export async function fetchBookings(userId?: string): Promise<Booking[]> {
  const url = userId 
    ? `${API_BASE_URL}/api/bookings?user_id=${userId}`
    : `${API_BASE_URL}/api/bookings`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch bookings');
  }
  const data = await response.json();
  return data.bookings || [];
}

// Submit a new booking or update existing
export async function submitBooking(formData: BookingFormData, bookingId?: string, bookingSource: 'web' | 'admin' | 'telegram' = 'web', userId?: number | string) {
  // ✅ ИСПРАВЛЕНИЕ: Используем разные эндпоинты в зависимости от источника
  let endpoint: string;
  
  // Для admin используем переданный userId, для Telegram - из WebApp
  let bookingUserId = userId;
  if (bookingSource === 'telegram' && typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user) {
    bookingUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
  }
  
  switch (bookingSource) {
    case 'admin':
      endpoint = `${API_BASE_URL}/api/admin/bookings`;
      break;
    case 'telegram':
      endpoint = `${API_BASE_URL}/api/bookings/telegram_webapp`;
      break;
    case 'web':
    default:
      endpoint = `${API_BASE_URL}/api/bookings/web-create`;
      break;
  }
    
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      booking_id: bookingId,
      user_id: bookingUserId,
      form_data: formData
    })
  });

  if (!response.ok) {
    // ✅ Получаем детали ошибки
    const errorData = await response.json().catch(() => ({}));
    
    // Если 409 - конфликт дат
    if (response.status === 409) {
      throw new Error(errorData.detail || 'Машина уже забронирована на эти даты');
    }
    
    // Другие ошибки
    throw new Error(errorData.detail || 'Failed to save booking');
  }

  return response.json();
}

// Confirm a pre_booking (convert to confirmed)
export async function confirmBooking(bookingId: string) {
  const response = await fetch(`${API_BASE_URL}/api/admin/bookings/${bookingId}/confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to confirm booking');
  }

  return response.json();
}

// Delete a booking
export async function deleteBooking(bookingId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/admin/bookings/${bookingId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to delete booking');
  }
}

// Create booking from CRM (using working offer-create endpoint)
export async function createBookingFromCRM(data: {
  user_id: number | string;
  car_id: string;
  car_name: string;
  start_date: string;
  end_date: string;
  days: number;
  total_rental: number;
  total_delivery: number;
  deposit: number;
  pickup_location?: string;
  return_location?: string;
  source?: string;
}): Promise<{ booking_id: string; status: string }> {
  const response = await fetch(`${API_BASE_URL}/api/bookings/offer-create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create booking');
  }

  return response.json();
}

// Create booking from CRM - uses dedicated /api/admin/bookings/create endpoint
export async function createBookingFromCRMForm(userId: number | string, formData: any): Promise<{ booking_id: string; status: string }> {
  const car = formData.car || {};
  const dates = formData.dates || {};
  const locations = formData.locations || {};
  const pricing = formData.pricing || {};
  const contact = formData.contact || {};
  
  // Извлекаем из формы (используем правильные ключи)
  const pickup_time = dates.pickupTime || '13:00';
  const return_time = dates.returnTime || '13:00';
  const pickup_address = locations.pickupAddress || '';
  const return_address = locations.dropoffAddress || '';
  const pickup_location = locations.pickupLocation || 'airport';
  const return_location = locations.dropoffLocation || 'airport';
  
  const total_rental = pricing.totalRental || 0;
  const total_delivery = pricing.totalDelivery || 0;
  const deposit = pricing.deposit || 5000;
  const days = dates.days || 1;
  
  const response = await fetch(`${API_BASE_URL}/api/admin/bookings/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      user_id: userId,
      car_id: car.id || '',
      car_name: car.name || `${car.brand || ''} ${car.model || ''} ${car.year || ''}`.trim(),
      start_date: dates.start,
      end_date: dates.end,
      days: days,
      total_rental: total_rental,
      total_delivery: total_delivery,
      deposit: deposit,
      pickup_location: pickup_location,
      return_location: return_location,
      pickup_address: pickup_address,
      return_address: return_address,
      pickup_time: pickup_time,
      return_time: return_time,
      contact_name: contact.name || '',
      contact_value: contact.value || '',
      contact_type: contact.type || 'telegram',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create booking');
  }

  return response.json();
}

// Get available cars for date range
export async function fetchAvailableCars(startDate: string, endDate: string, category?: string): Promise<Car[]> {
  let url = `${API_BASE_URL}/api/available-cars?start_date=${startDate}&end_date=${endDate}`;
  if (category) {
    url += `&category=${category}`;
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch available cars');
  }
  const data = await response.json();
  return data.available || [];
}

// Получить маппинг car_id -> owner_id
export async function fetchCarOwners(): Promise<Record<string, string>> {
  const res = await fetch('/api/car-owners');
  const data = await res.json();
  const carToOwner: Record<string, string> = {};
  if (data.owners) {
    for (const owner of data.owners) {
      if (owner.car_ids) {
        for (const carId of Object.keys(owner.car_ids)) {
          carToOwner[carId] = owner.id;
        }
      }
    }
  }
  return carToOwner;
}

// Locations for pickup/return
export const PICKUP_LOCATIONS = [
  { id: 'airport', name: 'Международный аэропорт Пхукет (HKT)', price: 0 },
  { id: 'hotel', name: 'Доставка по городу', price: 500 },
  { id: 'patong', name: 'Патонг', price: 500 },
  { id: 'kata', name: 'Ката', price: 500 },
  { id: 'karon', name: 'Карон', price: 500 },
  { id: 'rawai', name: 'Равай', price: 500 },
  { id: 'chalong', name: 'Чалонг', price: 500 },
];

// Generate time options from 06:00 to 23:30
export function generateTimeOptions(): string[] {
  const times: string[] = [];
  for (let h = 6; h <= 23; h++) {
    times.push(`${h.toString().padStart(2, '0')}:00`);
    times.push(`${h.toString().padStart(2, '0')}:30`);
  }
  return times;
}

// Calculate pricing for booking
export function calculateBookingPricing(
  car: Car,
  startDate: Date,
  endDate: Date,
  pickupLocation: string,
  returnLocation: string
) {
  const days = differenceInDays(endDate, startDate) + 1;
  if (days <= 0) return null;

  const highSeason = isHighSeason(startDate);
  const dailyRate = calculateDailyRate(car.pricing, days, highSeason);
  const totalRental = dailyRate * days;
  const deliveryPickup = getDeliveryPrice(pickupLocation);
  const deliveryReturn = getDeliveryPrice(returnLocation);
  const totalDelivery = deliveryPickup + deliveryReturn;
  const grandTotal = totalRental + totalDelivery;

  return {
    days,
    dailyRate,
    totalRental,
    deposit: car.pricing.deposit,
    deliveryPickup,
    deliveryReturn,
    totalDelivery,
    grandTotal,
    highSeason,
  };
}

// Calculate price for rental period
export function calculateDailyRate(pricing: Car['pricing'], days: number, isHighSeason: boolean = false): number {
  const season = isHighSeason ? 'high_season' : 'low_season';
  const rates = pricing[season];
  
  if (days >= 30) return rates.price_30;
  if (days >= 15) return rates.price_15_29;
  if (days >= 7) return rates.price_7_14;
  return rates.price_1_6;
}

// Check if current date is in high season (Dec 15 - Jan 15)
export function isHighSeason(date: Date = new Date()): boolean {
  const month = date.getMonth();
  const day = date.getDate();
  
  // December 15 - January 15
  return (month === 11 && day >= 15) || (month === 0 && day <= 15);
}

// Get delivery price
export function getDeliveryPrice(locationId: string): number {
  const location = PICKUP_LOCATIONS.find(l => l.id === locationId);
  return location?.price ?? 500;
}

// Booking source type
export type BookingSource = 'telegram_webapp' | 'web_browser' | 'manager';

// Fetch owners list for filter dropdown
export async function fetchOwnersList(): Promise<{ id: string; name: string }[]> {
  const response = await fetch(`${API_BASE_URL}/api/car-owners`);
  if (!response.ok) {
    throw new Error('Failed to fetch owners list');
  }
  const data = await response.json();
  const owners = data.owners || [];

  return owners.map((owner: any) => ({
    id: owner.id,
    name: owner.name
  }));
}

// Helper to determine booking source
export function getBookingSource(): BookingSource {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    return 'telegram_webapp';
  }
  return 'web_browser';
}