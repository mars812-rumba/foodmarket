import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ArrowLeft, Calendar, CreditCard, Check, Copy,
  Fuel, Settings, Zap, Gauge, Loader2, ArrowRight, Phone
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import useEmblaCarousel from 'embla-carousel-react';

// Определение сезона
const determineSeason = (date: Date) => {
  const month = date.getMonth() + 1;
  if (month === 12 || month === 1 || month === 2) {
    return 'high_season';
  }
  return 'low_season';
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

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface CarData {
  id: string;
  name: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  class: string;
  photos: {
    main: string;
    gallery: string[];
  };
  specs: {
    fuel: string;
    engine: string;
    power: string;
    transmission: string;
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
}

export default function OfferPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const carId = searchParams.get("car");
  const startDateStr = searchParams.get("start");
  const endDateStr = searchParams.get("end");
  const isAdmin = false;

  const [car, setCar] = useState<CarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // Embla carousel — swipe only, no arrows
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, watchDrag: isTouchDevice });
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  // Custom prices from URL (passed by admin)
  const customRental = searchParams.get("rental");
  const customDelivery = searchParams.get("delivery");
  const customDeposit = searchParams.get("deposit");

  const [totalRental, setTotalRental] = useState("");
  const [totalDelivery, setTotalDelivery] = useState("");
  const [deposit, setDeposit] = useState("");

  const startDate = startDateStr ? new Date(startDateStr) : null;
  const endDate = endDateStr ? new Date(endDateStr) : null;

  const days = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return Math.max(1, differenceInDays(endDate, startDate));
  }, [startDate, endDate]);

  const basePricePerDay = useMemo(() => {
    if (!car?.pricing || !startDate || days === 0) return 0;
    return getPriceForPeriod(car.pricing, days, startDate);
  }, [car, startDate, days]);

  const baseTotalRental = useMemo(() => basePricePerDay * days, [basePricePerDay, days]);
  const baseDeposit = car?.pricing?.deposit || 5000;

  useEffect(() => {
    if (!car) return;
    if (customRental) {
      setTotalRental(customRental);
    } else if (baseTotalRental > 0 && !totalRental) {
      setTotalRental(baseTotalRental.toString());
    }
    if (!totalDelivery) setTotalDelivery(customDelivery || "0");
    if (!deposit) setDeposit(customDeposit || baseDeposit.toString());
  }, [car, baseTotalRental, baseDeposit, customRental, customDelivery, customDeposit, totalRental, totalDelivery, deposit]);

  useEffect(() => {
    const fetchCar = async () => {
      if (!carId) { setLoading(false); return; }
      try {
        const res = await fetch(`${API_URL}/api/cars`);
        const data = await res.json();
        const carsArray = Array.isArray(data.cars) ? data.cars : Object.values(data.cars || {});
        const carData = carsArray.find((c: any) =>
          c.id === carId || c.quick_id === carId || c.id === carId?.replace(/-/g, '_')
        );
        if (carData) setCar(carData);
        else console.error("Авто не найдено:", carId);
      } catch (error) {
        console.error("Ошибка загрузки авто:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCar();
  }, [carId]);

  const handleRentalChange = (value: string) => setTotalRental(value);

  const pricePerDay = useMemo(() => {
    if (!totalRental || days === 0) return 0;
    return Math.round((parseInt(totalRental) || 0) / days);
  }, [totalRental, days]);

  const grandTotal = useMemo(() => {
    return (parseInt(totalRental) || 0) + (parseInt(totalDelivery) || 0);
  }, [totalRental, totalDelivery]);

  const copyClientLink = () => {
    const params = new URLSearchParams();
    params.set('car', carId || '');
    params.set('start', startDateStr || '');
    params.set('end', endDateStr || '');
    const url = `${window.location.origin}/offer?${params.toString()}`;
    navigator.clipboard.writeText(url);
    toast.success("Ссылка скопирована!");
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    const userId = searchParams.get('user_id');
    
    const bookingData = {
      user_id: userId,
      car_id: carId,
      car_name: car?.name,
      brand: car?.brand || '',
      model: car?.model || '',
      year: car?.year || '',
      color: car?.color || '',
      start_date: startDateStr,
      end_date: endDateStr,
      days,
      price_per_day: pricePerDay,
      total_rental: parseInt(totalRental) || 0,
      total_delivery: parseInt(totalDelivery) || 0,
      deposit: parseInt(deposit) || 0,
      pickup_location: searchParams.get('pickup') || 'airport',
      return_location: searchParams.get('return') || 'airport',
      source: 'offer_page',
    };

    try {
      const response = await fetch(`${API_URL}/api/bookings/offer-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Ошибка создания брони');
      }

      const result = await response.json();
      console.log("Создаём бронь от клиента:", bookingData);
      
      if (result.status === 'exists') {
        toast.info("У вас уже есть бронь на этот автомобиль!");
        return;
      }
      
      setShowSuccessDialog(true);
    } catch (error) {
      console.error('Ошибка создания брони:', error);
      toast.error("Ошибка при отправке заявки");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessDialog(false);
    navigate(-1);
  };

  const formatPrice = (price: number) => price.toLocaleString() + " ฿";

  const getImageUrl = (path: string) => {
    if (!path) return "/placeholder.svg";
    if (path.startsWith("http")) return path;
    return `${API_URL}/images_web/${path}`;
  };

  const allPhotos = useMemo(() => {
    if (!car?.photos) return [];
    const photos: string[] = [];
    if (car.photos.main) photos.push(car.photos.main);
    if (car.photos.gallery) {
      car.photos.gallery.forEach((p: string) => { if (p !== car.photos.main) photos.push(p); });
    }
    return photos;
  }, [car]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!car) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground mb-4">Авто не найдено</p>
        <Button onClick={() => navigate(-1)}>Назад</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Photo Gallery — swipe only */}
      <div className="relative">
        <div className="overflow-hidden aspect-[16/10]" ref={emblaRef}>
          <div className="flex h-full">
            {allPhotos.length > 0 ? (
              allPhotos.map((photo, index) => (
                <div key={index} className="flex-[0_0_100%] min-w-0 h-full">
                  <img
                    src={getImageUrl(photo)}
                    alt={`${car.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))
            ) : (
              <div className="flex-[0_0_100%] h-full bg-muted flex items-center justify-center">
                <span className="text-muted-foreground">Нет фото</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress bars */}
        {allPhotos.length > 1 && (
          <div className="absolute bottom-3 left-4 right-4 flex gap-1">
            {allPhotos.map((_, index) => (
              <div
                key={index}
                className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${
                  index === selectedIndex ? 'bg-white' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        )}

        {/* Hover triggers for desktop */}
        {!isTouchDevice && allPhotos.length > 1 && (
          <div className="absolute inset-0 flex">
            {allPhotos.map((_, index) => (
              <div
                key={index}
                className="flex-1"
                onMouseEnter={() => emblaApi?.scrollTo(index)}
              />
            ))}
          </div>
        )}

        <Button
          variant="secondary"
          size="icon"
          className="absolute top-4 left-4 rounded-full bg-white/90 backdrop-blur-sm shadow-sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">
          {car.class === "compact" ? "Компакт" :
           car.class === "sedan" ? "Седан" :
           car.class === "suv" ? "Кроссовер" : car.class}
        </Badge>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{car.brand} {car.model}</h1>
          <p className="text-sm text-muted-foreground">{car.year} • {car.color}</p>
        </div>

        {/* Specs — lucide icons */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {car.specs?.fuel && (
            <div className="flex items-center gap-1.5">
              <Fuel className="w-3.5 h-3.5 text-primary" />
              <span>{car.specs.fuel}</span>
            </div>
          )}
          {car.specs?.transmission && (
            <div className="flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-primary" />
              <span>{car.specs.transmission}</span>
            </div>
          )}
          {car.specs?.power && (
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span>{car.specs.power}</span>
            </div>
          )}
          {car.specs?.engine && (
            <div className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-primary" />
              <span>{car.specs.engine}</span>
            </div>
          )}
        </div>

        {/* Rental Period */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">Период аренды</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Получение</p>
                <p className="font-bold text-sm text-foreground">
                  {startDate ? format(startDate, "dd MMM yyyy", { locale: ru }) : "—"}
                </p>
              </div>
              <div className="text-muted-foreground text-lg">→</div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Возврат</p>
                <p className="font-bold text-sm text-foreground">
                  {endDate ? format(endDate, "dd MMM yyyy", { locale: ru }) : "—"}
                </p>
              </div>
              <Badge variant="secondary" className="text-xs font-bold">
                {days} дн.
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Pricing — readonly for client */}
        <Card className="border shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">Стоимость</span>
            </div>

            {/* Price breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between items-center py-1.5 border-b border-border">
                <span className="text-sm text-muted-foreground">Цена за день</span>
                <span className="font-semibold text-foreground">{formatPrice(pricePerDay)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border">
                <span className="text-sm text-muted-foreground">Аренда ({days} дн.)</span>
                <span className="font-semibold text-foreground">{formatPrice(parseInt(totalRental) || 0)}</span>
              </div>
              {parseInt(totalDelivery) > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-border">
                  <span className="text-sm text-muted-foreground">Доставка</span>
                  <span className="font-semibold text-foreground">{formatPrice(parseInt(totalDelivery))}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-1.5 border-b border-border">
                <span className="text-sm text-muted-foreground">Депозит</span>
                <span className="font-semibold text-foreground">{formatPrice(parseInt(deposit) || 0)}</span>
              </div>
            </div>

            {/* Grand Total */}
            <div className="bg-primary/5 rounded-xl p-4 mt-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm text-foreground">Итого к оплате</span>
                <span className="text-2xl font-bold text-primary">
                  {formatPrice(grandTotal)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {formatPrice(pricePerDay)}/день • {days} дней
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border">
        <Button
          onClick={handleConfirm}
          className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold py-6 rounded-xl shadow-lg"
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <ArrowRight className="h-5 w-5 mr-2" />
              Забронировать
            </>
          )}
        </Button>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <span>Заявка принята!</span>
            </DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              Ваша заявка принята в работу.<br />
              Менеджер свяжется с вами в ближайшее время.
            </p>
            <Button 
              onClick={handleSuccessClose}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              ОК
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
