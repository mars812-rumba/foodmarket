import { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Header } from "../components/Header";
import { categories, categoryById } from "../data/LOFTcategories";
import { attributeMeta, formatAttrValue, calculateDiscount, getPriceDisplay, STANDARD_COLORS, FINISHES } from "../data/attributeIcons";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Ruler, CheckCircle2, Wrench, ChevronLeft, Filter, X, Palette } from "lucide-react";
import { cn } from "../lib/utils";

type Availability = "all" | "in_stock" | "custom";
type Sort = "price_asc" | "price_desc" | "name";

export function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const category = searchParams.get("category") || "";
  const availability = (searchParams.get("availability") as Availability) || "all";
  const sort = (searchParams.get("sort") as Sort) || "price_asc";
  const maxPrice = Number(searchParams.get("maxPrice")) || 0;

  // Fetch products from backend
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/inventory');
        if (response.ok) {
          const data = await response.json();
          const inventory = (data.inventory || []).map((item: any) => ({
            ...item,
            // Map 'available' boolean to 'availability' string for compatibility
            availability: item.available ? "in_stock" : "custom"
          }));
          setProducts(inventory);
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const filtered = useMemo(() => {
    let list = products.slice();
    if (category) list = list.filter((i) => i.category === category);
    if (availability !== "all") list = list.filter((i) => i.availability === availability);
    if (maxPrice > 0) list = list.filter((i) => i.price <= maxPrice);
    list.sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      return a.name.localeCompare(b.name, "ru");
    });
    return list;
  }, [products, category, availability, sort, maxPrice]);

  const update = (patch: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === "" || value === "all" || value === "0") {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    setSearchParams(newParams);
  };

  const cat = categoryById(category);
  const hasActiveFilters = category || availability !== "all" || maxPrice > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <Header />
      <main className="safe-padding-x mx-auto max-w-[1440px] py-6 sm:py-8">
        {/* Хлебные крошки */}
        <div className="mb-4 sm:mb-6">
          <Link to="/" className="inline-flex items-center text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-400 hover:text-orange-600 transition-colors">
            <ChevronLeft className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> На главную
          </Link>
        </div>

        <div className="mb-6 sm:mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-[1000] tracking-tighter text-slate-900">
              {cat ? cat.name : "Весь каталог"}
            </h1>
            <p className="text-sm sm:text-base text-slate-500 font-medium">
              Найдено: <span className="font-bold text-slate-700">{filtered.length}</span> {filtered.length === 1 ? 'модель' : filtered.length < 5 ? 'модели' : 'моделей'}
            </p>
          </div>
          
          {/* Кнопка фильтров для мобильных */}
          <Button
            onClick={() => setMobileFiltersOpen(true)}
            className="sm:hidden flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Filter className="h-4 w-4" />
            Фильтры
            {hasActiveFilters && (
              <Badge className="ml-1 h-5 px-1.5 bg-orange-600 text-white">
                {[category, availability !== "all", maxPrice > 0].filter(Boolean).length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Фильтры - десктоп */}
        <div className="hidden sm:grid mb-8 lg:mb-10 grid-cols-2 lg:grid-cols-4 gap-4 rounded-lg border border-slate-200 bg-white p-4 lg:p-6 shadow-sm">
          <FilterWrapper label="Категория">
            <Select value={category || "all"} onValueChange={(v) => update({ category: v === "all" ? "" : v })}>
              <SelectTrigger className="h-10 rounded-md border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-md">
                <SelectItem value="all">Все категории</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterWrapper>

          <FilterWrapper label="Наличие">
            <Select value={availability} onValueChange={(v) => update({ availability: v })}>
              <SelectTrigger className="h-10 rounded-md border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-md">
                <SelectItem value="all">Любое</SelectItem>
                <SelectItem value="in_stock">В наличии</SelectItem>
                <SelectItem value="custom">Под заказ</SelectItem>
              </SelectContent>
            </Select>
          </FilterWrapper>

          <FilterWrapper label="Бюджет до (₽)">
            <Input
              type="number"
              min={0}
              value={maxPrice || ""}
              onChange={(e) => update({ maxPrice: e.target.value })}
              placeholder="Без лимита"
              className="h-10 rounded-md border-slate-200"
            />
          </FilterWrapper>

          <FilterWrapper label="Сортировка">
            <Select value={sort} onValueChange={(v) => update({ sort: v })}>
              <SelectTrigger className="h-10 rounded-md border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-md">
                <SelectItem value="price_asc">Сначала дешевле</SelectItem>
                <SelectItem value="price_desc">Сначала дороже</SelectItem>
                <SelectItem value="name">По названию</SelectItem>
              </SelectContent>
            </Select>
          </FilterWrapper>
        </div>

        {/* Мобильные фильтры */}
        <div className={cn(
          "fixed inset-0 z-50 bg-white transition-transform duration-300 sm:hidden",
          mobileFiltersOpen ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <h2 className="text-lg font-bold">Фильтры</h2>
            <button
              onClick={() => setMobileFiltersOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex flex-col gap-6 p-4">
            <FilterWrapper label="Категория">
              <Select value={category || "all"} onValueChange={(v) => update({ category: v === "all" ? "" : v })}>
                <SelectTrigger className="h-12 rounded-md border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-md">
                  <SelectItem value="all">Все категории</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterWrapper>

            <FilterWrapper label="Наличие">
              <Select value={availability} onValueChange={(v) => update({ availability: v })}>
                <SelectTrigger className="h-12 rounded-md border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-md">
                  <SelectItem value="all">Любое</SelectItem>
                  <SelectItem value="in_stock">В наличии</SelectItem>
                  <SelectItem value="custom">Под заказ</SelectItem>
                </SelectContent>
              </Select>
            </FilterWrapper>

            <FilterWrapper label="Бюджет до (₽)">
              <Input
                type="number"
                min={0}
                value={maxPrice || ""}
                onChange={(e) => update({ maxPrice: e.target.value })}
                placeholder="Без лимита"
                className="h-12 rounded-md border-slate-200"
              />
            </FilterWrapper>

            <FilterWrapper label="Сортировка">
              <Select value={sort} onValueChange={(v) => update({ sort: v })}>
                <SelectTrigger className="h-12 rounded-md border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-md">
                  <SelectItem value="price_asc">Сначала дешевле</SelectItem>
                  <SelectItem value="price_desc">Сначала дороже</SelectItem>
                  <SelectItem value="name">По названию</SelectItem>
                </SelectContent>
              </Select>
            </FilterWrapper>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4 safe-padding-bottom">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchParams({});
                  setMobileFiltersOpen(false);
                }}
                className="flex-1"
              >
                Сбросить
              </Button>
              <Button
                onClick={() => setMobileFiltersOpen(false)}
                className="flex-1 bg-orange-600 text-white hover:bg-orange-500"
              >
                Применить
              </Button>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 sm:p-20 text-center">
            <p className="text-base sm:text-lg font-bold text-slate-400 mb-4">По вашим параметрам ничего не нашлось</p>
            <Button
              variant="outline"
              onClick={() => setSearchParams({})}
              className="rounded-md"
            >
              Сбросить фильтры
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => <ProductCard key={item.id} item={item} />)}
          </div>
        )}
      </main>
    </div>
  );
}

function FilterWrapper({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 ml-1">{label}</span>
      {children}
    </div>
  );
}

function ProductCard({ item }: { item: any }) {
  const cat = categoryById(item.category);
  const inStock = item.availability === "in_stock";
  const { currentPrice, oldPrice, discount } = getPriceDisplay(item);
  
  // Featured attributes (максимум 2 на карточке)
  const featuredAttrs = (item.featured_attributes || []).slice(0, 2);
  
  return (
    <Link
      to={`/product/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition-all hover:border-orange-300 hover:shadow-xl hover:-translate-y-1"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <img
          src={item.photos?.main ? `/images_web/${item.photos.main}?t=${Date.now()}` : '/placeholder.svg'}
          alt={item.name}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute left-2 top-2 sm:left-3 sm:top-3">
          <Badge className="rounded-md bg-white/95 px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-sm backdrop-blur">
            {cat?.name}
          </Badge>
        </div>
        <div className="absolute right-2 top-2 sm:right-3 sm:top-3">
          <Badge className={cn(
            "rounded-md shadow-sm border-0 text-[10px] sm:text-xs px-2 py-0.5 sm:px-3 sm:py-1",
            inStock ? "bg-green-600 text-white" : "bg-orange-600 text-white"
          )}>
            <span className="flex items-center gap-1">
              {inStock ? <CheckCircle2 className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
              {inStock ? "В наличии" : "Под заказ"}
            </span>
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="line-clamp-2 text-base sm:text-lg font-black tracking-tight text-slate-900 group-hover:text-orange-600 transition-colors">
          {item.name}
        </h3>

        {/* Спеки: Ш×В, Цвет, Покрытие в один ряд */}
        <div className="mt-2 sm:mt-3 flex flex-wrap gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {/* Ш×В */}
          {item.dimensions && (
            <div className="flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600 flex-shrink-0" />
              <span>{item.dimensions.width}×{item.dimensions.height} мм</span>
            </div>
          )}
          
          {/* Цвет */}
          {item.color && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border border-slate-300 flex-shrink-0" style={{
                backgroundColor: STANDARD_COLORS.find(c => c.value === item.color)?.hex || '#000000'
              }} />
              <span>{STANDARD_COLORS.find(c => c.value === item.color)?.label || item.color}</span>
            </div>
          )}
          
          {/* Покрытие */}
          {item.finish && (
            <div className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600 flex-shrink-0" />
              <span>{FINISHES.find(f => f.value === item.finish)?.label || item.finish}</span>
            </div>
          )}
        </div>

        {/* Featured attributes - НОВОЕ */}
        {featuredAttrs.length > 0 && (
          <div className="mt-3 sm:mt-4 space-y-2">
            {featuredAttrs.map((attrKey) => {
              const value = item.attributes[attrKey];
              const meta = attributeMeta[attrKey];
              if (!meta || value === undefined || value === null) return null;
              
              const Icon = meta.icon;
              return (
                <div key={attrKey} className="flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold text-slate-600">
                  <Icon className="h-3.5 w-3.5 text-orange-600 flex-shrink-0" />
                  <span className="uppercase tracking-wide">{meta.label}:</span>
                  <span className="font-bold text-slate-900">{formatAttrValue(value, meta.suffix)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer с ценой */}
        <div className="mt-auto flex items-baseline justify-between gap-3 border-t border-slate-100 pt-3 sm:pt-4">
          <div className="flex items-baseline gap-2">
            <div className="text-lg sm:text-xl font-bold text-green-600">
              {currentPrice.toLocaleString("ru-RU")} ₽
            </div>
            
            {/* Old price + discount */}
            {oldPrice && discount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm line-through text-slate-400">
                  {oldPrice.toLocaleString("ru-RU")}
                </span>
                <Badge className="rounded-md bg-red-100 text-red-700 border-0 text-[9px] sm:text-[10px] font-black px-1.5 py-0.5">
                  -{discount}%
                </Badge>
              </div>
            )}
          </div>
          
          <Button className="h-9 sm:h-10 rounded-md bg-orange-600 px-3 sm:px-4 text-xs sm:text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-orange-500">
            Смотреть
          </Button>
        </div>
      </div>
    </Link>
  );
}