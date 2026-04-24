import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { categoryById } from "../data/LOFTcategories";
import { attributeMeta, formatAttrValue, calculateDiscount, getPriceDisplay, STANDARD_COLORS, FINISHES } from "../data/attributeIcons";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { RequestForm } from "../components/RequestForm";
import { Ruler, Weight, Box, Palette, CheckCircle2, Wrench, Truck, ShieldCheck, Hammer, ChevronLeft, ShoppingCart, Heart } from "lucide-react";
import { cn } from "../lib/utils";

export function Product() {
  const { id } = useParams();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    const fetchItem = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`/api/inventory/${id}`);
        if (response.ok) {
          const data = await response.json();
          // Map 'available' boolean to 'availability' string for compatibility
          const item = {
            ...data,
            availability: data.available ? "in_stock" : "custom"
          };
          setItem(item);
        }
      } catch (error) {
        console.error('Failed to fetch product:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
        <Header />
        <main className="safe-padding-x mx-auto max-w-[1440px] py-20 text-center">
          <p className="text-slate-500">Загрузка...</p>
        </main>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
        <Header />
        <main className="safe-padding-x mx-auto max-w-[1440px] py-20 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Товар не найден</h1>
          <Link to="/catalog" className="text-orange-600 hover:underline">
            Вернуться в каталог
          </Link>
        </main>
      </div>
    );
  }

  const cat = categoryById(item.category);
  const cover = item.photos?.main ? `/images_web/${item.photos.main}?t=${Date.now()}` : '/placeholder.svg';
  const gallery = item.photos?.gallery?.length > 0
    ? item.photos.gallery.map((p: string) => `/images_web/${p}?t=${Date.now()}`)
    : [cover, cover, cover];
  const inStock = item.availability === "in_stock";
  const attrEntries = Object.entries(item.attributes || {});
  const { currentPrice, oldPrice, discount } = getPriceDisplay(item);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <Header />
      <main className="safe-padding-x mx-auto max-w-[1440px] py-6 sm:py-8 pb-24 sm:pb-32">
        {/* Хлебные крошки */}
        <div className="mb-4 sm:mb-6">
          <Link
            to={`/catalog?category=${item.category}`}
            className="inline-flex items-center text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-400 hover:text-orange-600 transition-colors"
          >
            <ChevronLeft className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Назад к {cat?.name}
          </Link>
        </div>

        <div className="grid gap-8 lg:gap-12 lg:grid-cols-2">
          {/* Галерея */}
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <img
                src={gallery[active]}
                alt={item.name}
                className="aspect-square w-full object-cover sm:aspect-[4/3]"
              />
              {/* Кнопка лайка */}
              <button
                onClick={() => setLiked(!liked)}
                className={cn(
                  "absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md transition-all hover:scale-110",
                  liked && "bg-red-50"
                )}
              >
                <Heart className={cn("h-5 w-5", liked ? "fill-red-500 text-red-500" : "text-slate-400")} />
              </button>
            </div>
            
            {/* Миниатюры */}
            <div className="flex gap-2 sm:gap-3">
              {gallery.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={cn(
                    "relative h-16 w-20 sm:h-20 sm:w-24 overflow-hidden rounded-md border-2 transition-all",
                    active === i
                      ? "border-orange-600 shadow-md"
                      : "border-slate-200 opacity-70 hover:opacity-100"
                  )}
                >
                  <img src={src} className="h-full w-full object-cover" alt="" />
                  {active === i && (
                    <div className="absolute inset-0 bg-orange-600/10" />
                  )}
                </button>
              ))}
            </div>

            {/* Преимущества - только десктоп */}
            <div className="hidden sm:flex flex-wrap justify-center gap-4 py-6">
              <FeatureBadge icon={Hammer} text="Ручная работа" />
              <FeatureBadge icon={ShieldCheck} text="Гарантия 2 года" />
              <FeatureBadge icon={Truck} text="Доставка по РФ" />
            </div>
          </div>

          {/* Информация о товаре */}
          <div className="flex flex-col space-y-6 sm:space-y-8">
            {/* Заголовок и цена */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge className="rounded-md bg-slate-100 text-slate-600 hover:bg-slate-100 border-0 uppercase font-bold text-[10px] sm:text-[11px] px-2 py-0.5">
                  {cat?.name}
                </Badge>
                <Badge className={cn(
                  "rounded-md border-0 uppercase font-bold text-[10px] sm:text-[11px] px-2 py-0.5",
                  inStock ? "bg-green-600 text-white" : "bg-orange-600 text-white"
                )}>
                  {inStock ? "В наличии" : "Под заказ"}
                </Badge>
              </div>
              
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-[1000] tracking-tighter text-slate-900">
                {item.name}
              </h1>
              
              <div className="flex items-baseline gap-4">
                <div className="text-3xl sm:text-4xl font-bold text-green-600">
                  {currentPrice.toLocaleString("ru-RU")} ₽
                </div>
                
                {/* Old price + discount */}
                {oldPrice && discount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg sm:text-xl line-through text-slate-400">
                      {oldPrice.toLocaleString("ru-RU")} ₽
                    </span>
                    <Badge className="rounded-md bg-red-100 text-red-700 border-0 text-sm font-black px-2 py-1">
                      Экономия {discount}%
                    </Badge>
                  </div>
                )}
                
                {!inStock && (
                  <span className="text-sm text-slate-500">срок 14-21 день</span>
                )}
              </div>
              
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                {item.description}
              </p>
            </div>

            {/* Кнопка заказа - десктоп */}
            <div className="hidden sm:block">
              <Button
                onClick={() => setFormOpen(true)}
                className="h-14 w-full max-w-sm rounded-lg bg-orange-600 font-black uppercase tracking-widest text-white shadow-lg hover:bg-orange-500 transition-all"
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                Заказать товар
              </Button>
            </div>

            {/* Характеристики - 3 спека в один ряд */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-slate-500 mb-4">
                Основные характеристики
              </h3>
              <div className="flex flex-wrap gap-4 sm:gap-6">
                {/* Размеры Ш×В×Г */}
                {item.dimensions && (
                  <div className="flex items-center gap-2">
                    <Ruler className="h-5 w-5 text-orange-600 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500">Размеры</p>
                      <p className="text-sm sm:text-base font-bold text-slate-900">
                        {item.dimensions.width}×{item.dimensions.height}×{item.dimensions.depth} мм
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Цвет */}
                {item.color && (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0" style={{
                      backgroundColor: STANDARD_COLORS.find(c => c.value === item.color)?.hex || '#000000'
                    }} />
                    <div>
                      <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500">Цвет</p>
                      <p className="text-sm sm:text-base font-bold text-slate-900">
                        {STANDARD_COLORS.find(c => c.value === item.color)?.label || item.color}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Покрытие */}
                {item.finish && (
                  <div className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-orange-600 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500">Покрытие</p>
                      <p className="text-sm sm:text-base font-bold text-slate-900">
                        {FINISHES.find(f => f.value === item.finish)?.label || item.finish}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Атрибуты товара */}
            {attrEntries.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-slate-500 mb-4">
                  Атрибуты товара
                </h3>
                <div className="grid gap-3 sm:gap-4 grid-cols-2">
                  {attrEntries.map(([key, value]) => {
                    const meta = attributeMeta[key];
                    return (
                      <div
                        key={key}
                        className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:p-4 transition-colors hover:bg-slate-100"
                      >
                        <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-white text-orange-600 shadow-sm mt-0.5">
                          {meta?.icon ? <meta.icon className="h-4 w-4 sm:h-5 sm:w-5" /> : <Box className="h-4 w-4 sm:h-5 sm:w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 line-clamp-2">
                            {meta?.label ?? key}
                          </p>
                          <p className="text-sm sm:text-base font-bold text-slate-900 break-words">
                            {formatAttrValue(value, meta?.suffix)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Преимущества - мобильная версия */}
            <div className="flex sm:hidden flex-wrap gap-3 pt-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Hammer className="h-4 w-4 text-orange-600" />
                <span>Ручная работа</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <ShieldCheck className="h-4 w-4 text-orange-600" />
                <span>Гарантия 2 года</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Truck className="h-4 w-4 text-orange-600" />
                <span>Доставка</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Мобильная кнопка заказа */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-xl sm:hidden safe-padding-bottom">
        <div className="flex gap-3 p-4">
          <Button
            onClick={() => setLiked(!liked)}
            variant="outline"
            className="h-14 w-14 flex-shrink-0 rounded-lg border-slate-200"
          >
            <Heart className={cn("h-5 w-5", liked ? "fill-red-500 text-red-500" : "text-slate-400")} />
          </Button>
          <Button
            onClick={() => setFormOpen(true)}
            className="h-14 flex-1 rounded-lg bg-orange-600 font-black uppercase tracking-wider text-white shadow-lg"
          >
            Заказать — {item.price.toLocaleString("ru-RU")} ₽
          </Button>
        </div>
      </div>

      <RequestForm open={formOpen} onOpenChange={setFormOpen} productName={item.name} />
    </div>
  );
}

function SpecItem({ icon: Icon, label, value, suffix }: any) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600" />
        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>
      <p className="text-sm sm:text-base font-bold text-slate-900">
        {value} {suffix}
      </p>
    </div>
  );
}

function FeatureBadge({ icon: Icon, text }: any) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm min-w-[100px] flex-1 hover:shadow-md transition-shadow">
      <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-orange-600" />
      <span className="text-xs font-semibold text-slate-700 leading-tight">{text}</span>
    </div>
  );
}