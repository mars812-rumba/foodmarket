import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ShoppingCart,
  Zap,
  Rocket,
  Clock,
  Package,
  Receipt,
} from "lucide-react";

import logo_pizza_loft from "@/assets/logo_pizza_loft.png";
import ProductDetail from "@/components/ProductDetail";
import CheckoutModal from "@/components/CheckoutModal";
import ClientOrderModal from "@/components/ClientOrderModal";
import AboutModal from "@/components/AboutModal";
import { useCart, type MenuItem as CartMenuItem, type Ingredient as CartIngredient } from "@/contexts/CartContext";
import { useTelegramContext } from "@/contexts/TelegramContext";
import { useOrder } from "@/contexts/OrderContext";
import { CATEGORY_ICONS } from "@/data/categoryIcons.tsx";

import hero_pizza from "@/assets/hero_menu/pizza.png";
import hero_burger from "@/assets/hero_menu/burger.png";
import potato_chicken from "@/assets/hero_menu/chicken.png";
import sushi from "@/assets/hero_menu/susi.png";
import carbonara from "@/assets/hero_menu/pasta.png";
import drinks from "@/assets/hero_menu/drinks.png";
import steak from "@/assets/hero_menu/steak.png";

const API_URL = import.meta.env.VITE_API_URL || "https://weldwood.sunny-rentals.online";

/* ============================================================
   ТИПЫ
   ============================================================ */
type Ingredient = { id: string; name: string; price: number };

type MenuItem = {
  id: string;
  category: string;
  name: string;
  price: number;
  image: string;
  weight?: string;
  notes?: string;
  ingredients?: Ingredient[];
  available?: boolean;
  photos?: { main?: string; gallery?: string[] };
  updated_at?: string;
  hot?: boolean;
};

type Hero = { id: string; image: string; name: string; price: number };

type Category = { id: string; label: string; image: string; icon: React.ReactNode };

type CartLine = {
  uid: string;
  item: MenuItem;
  selectedIngredients: Ingredient[];
  total: number;
};

type Restaurant = {
  id: string;
  name: string;
  logo?: string;
  description?: string;
  info_text?: string;
  payment_qr_url?: string;
  manager_username?: string;
};

/* ============================================================
   ЦВЕТОВАЯ ПАЛИТРА
   ============================================================ */
const C = {
  bg: "#FFFFFF",
  text: "#1A1208",
  muted: "#7A6650",
  accent: "#FF6B35",
  accentDeep: "#E04E1B",
  accentGradient: "linear-gradient(135deg, #FF8A4C 0%, #FF6B35 50%, #E04E1B 100%)",
  green: "#22C55E",
  greenDeep: "#16A34A",
  greenGradient: "linear-gradient(135deg, #4ADE80 0%, #22C55E 50%, #16A34A 100%)",
  darkGradient: "linear-gradient(135deg, #2A1A0C 0%, #15100A 100%)",
  white: "#FFFFFF",
  cream: "#FFFAF2",
  border: "rgba(120, 80, 30, 0.12)",
};

/* ============================================================
   КАТЕГОРИИ И ИКОНКИ
   ============================================================ */

const HERO_IMAGES: Record<string, string> = {
  pizza: hero_pizza,
  burger: hero_burger,
  pasta: carbonara,
  sushi: sushi,
  potato_chicken: potato_chicken,
  drinks: drinks,
  steak: steak,
};


const getImageUrl = (path: string | undefined, timestamp?: number): string => {
  if (!path) return "/placeholder.svg";
  if (path.startsWith("http")) return path;
  const ts = timestamp !== undefined ? timestamp : Date.now();
  
  // Absolute path starting with / — use as-is
  if (path.startsWith("/")) {
    return `${path}?t=${ts}`;
  }
  
  if (path.startsWith("restaurants/")) {
    return `/images_web/${path}?t=${ts}`;
  }
  
  if (path.startsWith("images_web/")) {
    return `/images_web/${path.replace("images_web/", "")}?t=${ts}`;
  }
  
  return `/images_web/${path}?t=${ts}`;
};

/* ============================================================
   КОМПОНЕНТ
   ============================================================ */
export default function Home() {
  const { cart, cartCount, cartTotal, addToCart, removeFromCart } = useCart();
  const { webApp, user, isReady, isTelegramEnvironment, restaurantId } = useTelegramContext();
  const { activeOrder, needsAttention, openModal } = useOrder();
  
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [activeHeroId, setActiveHeroId] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  
  // API State
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoTimestamp, setPhotoTimestamp] = useState<number>(Date.now());

  // Fetch restaurants on mount
  useEffect(() => {
    fetchRestaurants();
  }, [restaurantId]);

  // Fetch menu when restaurant changes
  useEffect(() => {
    if (selectedRestaurant) {
      fetchMenuItems();
      // Update timestamp to force logo reload
      setPhotoTimestamp(Date.now());
    }
  }, [selectedRestaurant]);

  // Setup Telegram MainButton for checkout
  useEffect(() => {
    if (!webApp || !isReady) return;

    const handleMainButtonClick = () => {
      if (cartCount > 0) {
        setCheckoutOpen(true);
      }
    };

    if (cartCount > 0) {
      webApp.MainButton.setText(`Checkout (${cartCount})`);
      webApp.MainButton.show();
      webApp.MainButton.onClick(handleMainButtonClick);
    } else {
      webApp.MainButton.hide();
    }

    return () => {
      webApp.MainButton.offClick(handleMainButtonClick);
    };
  }, [webApp, isReady, cartCount]);

  // Setup Telegram BackButton
  useEffect(() => {
    if (!webApp || !isReady) return;

    const handleBackButtonClick = () => {
      if (openItem) {
        setOpenItem(null);
      } else if (openCategory) {
        setOpenCategory(null);
      } else if (sideOpen) {
        setSideOpen(false);
      }
    };

    if (openItem || openCategory || sideOpen) {
      webApp.BackButton.show();
      webApp.BackButton.onClick(handleBackButtonClick);
    } else {
      webApp.BackButton.hide();
    }

    return () => {
      webApp.BackButton.offClick(handleBackButtonClick);
    };
  }, [webApp, isReady, openItem, openCategory, sideOpen]);

  const fetchRestaurants = async () => {
    try {
      const res = await fetch(`${API_URL}/api/restaurants`);
      const data = await res.json();
      const rests = data.restaurants || [];
      setRestaurants(rests);
      
      // Check if restaurantId from URL is available
      if (restaurantId && rests.some(r => r.id === restaurantId)) {
        setSelectedRestaurant(restaurantId);
      } else if (rests.length > 0) {
        // Otherwise use first restaurant
        setSelectedRestaurant(rests[0].id);
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error("Error loading restaurants", e);
      setLoading(false);
    }
  };

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      const timestamp = Date.now();
      const res = await fetch(`${API_URL}/api/restaurants/${selectedRestaurant}/menu?t=${timestamp}`);
      const data = await res.json();
      const menuItems = data.items || [];
      
      setItems(menuItems);
      setPhotoTimestamp(timestamp);

      // Build categories from menu items - filter only categories that have items
      const uniqueCategories = Array.from(
        new Set(menuItems.map((item: MenuItem) => item.category))
      ) as string[];
      
      // Filter out categories that don't have items and remove duplicates
      const validCategories = uniqueCategories.filter(catId =>
        menuItems.some((item: MenuItem) => item.category === catId)
      );
      
      const builtCategories: Category[] = validCategories
        .map((catId) => ({
          id: catId,
          label: CATEGORY_ICONS[catId]?.label || catId,
          icon: CATEGORY_ICONS[catId]?.icon || "📦",
          image: HERO_IMAGES[catId] || hero_pizza,
        }))
        .sort((a, b) => {
          const order = ["pizza", "burger", "steak", "pasta", "sushi", "drinks", "potato_chicken"];
          return order.indexOf(a.id) - order.indexOf(b.id);
        });

      setCategories(builtCategories);

      // Build heroes from first item of each category
      const builtHeroes: Hero[] = builtCategories.map((cat) => {
        const firstItem = menuItems.find((item: MenuItem) => item.category === cat.id);
        return {
          id: cat.id,
          image: HERO_IMAGES[cat.id] || hero_pizza,
          name: cat.label,
          price: firstItem?.price || 0,
        };
      });

      setHeroes(builtHeroes);
    } catch (e) {
      console.error("Error loading menu", e);
      setItems([]);
      setCategories([]);
      setHeroes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      tracking = sideOpen || startX > window.innerWidth - 28;
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dy > 60) return;
      if (!sideOpen && dx < -40) setSideOpen(true);
      else if (sideOpen && dx > 40) setSideOpen(false);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [sideOpen]);

  useEffect(() => {
    document.body.style.overflow = openCategory || sideOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [openCategory, sideOpen]);

  const addToCartLocal = (item: MenuItem, ings: Ingredient[]) => {
    addToCart(item as CartMenuItem, ings as CartIngredient[]);
  };


  // Цвет триггера корзины: зелёный если есть заказы
  const triggerBg = cartCount > 0 ? C.greenGradient : C.accentGradient;
  const triggerShadow = cartCount > 0
    ? "0 6px 16px rgba(34,197,94,0.40), 0 14px 32px -8px rgba(22,163,74,0.50), inset 0 1px 0 rgba(255,255,255,0.4)"
    : "0 6px 16px rgba(255,107,53,0.35), 0 14px 32px -8px rgba(224,78,27,0.45), inset 0 1px 0 rgba(255,255,255,0.4)";

  if (loading) {
    return (
      <div style={S.page}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "20px" }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>⏳</div>
          <div style={{ color: C.muted, fontSize: 16 }}>Loading menu...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <style>{`
        @keyframes lfp-swipe {
          0%   { transform: translateX(0);    opacity: 0.85; }
          50%  { transform: translateX(10px); opacity: 1; }
          100% { transform: translateX(0);    opacity: 0.85; }
        }
        @keyframes lfp-swipe-up {
          0%   { transform: translateX(-50%) translateY(0);    opacity: 0.72; }
          50%  { transform: translateX(-50%) translateY(-6px); opacity: 1; }
          100% { transform: translateX(-50%) translateY(0);    opacity: 0.72; }
        }
        @keyframes lfp-cart-pulse {
          0%, 100% { transform: translateY(-50%) scale(1); }
          50%       { transform: translateY(-50%) scale(1.07); }
        }
        .lfp-hero-img {
          transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          cursor: pointer;
        }
        .lfp-hero-img:hover, .lfp-hero-img:active {
          transform: scale(0.90);
        }
        .lfp-item-img {
          transition: transform 0.28s ease;
          cursor: zoom-in;
        }
        .lfp-item-img:hover, .lfp-item-img:active {
          transform: scale(1.10);
        }
        .lfp-nav-scroll::-webkit-scrollbar { display: none; }
        @keyframes lfp-receipt-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 12px rgba(245,158,11,0.4); }
          50%       { transform: scale(1.08); box-shadow: 0 0 20px rgba(245,158,11,0.6); }
        }
        .lfp-receipt-pulse {
          animation: lfp-receipt-pulse 1.5s ease-in-out infinite;
        }
      `}</style>

      {/* ============ HEADER ============ */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logoBox}>
            <img
              src={getImageUrl(restaurants.find(r => r.id === selectedRestaurant)?.logo, photoTimestamp)}
              alt={restaurants.find(r => r.id === selectedRestaurant)?.name || "Restaurant Logo"}
              style={S.logoImg}
              key={`logo-${selectedRestaurant}-${photoTimestamp}`}
              onError={(e) => {
                (e.target as HTMLImageElement).src = logo_pizza_loft;
              }}
            />
            {restaurants.length > 0 && selectedRestaurant && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={S.restaurantName}>
                  {restaurants.find(r => r.id === selectedRestaurant)?.name || ""}
                </div>
                {restaurants.find(r => r.id === selectedRestaurant)?.description && (
                  <div style={S.restaurantDesc}>
                    {restaurants.find(r => r.id === selectedRestaurant)?.description}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Right side: Receipt icon (left of burger) + Burger menu */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Receipt icon — opens ClientOrderModal when active order exists */}
            {activeOrder && (
              <button
                onClick={openModal}
                className={needsAttention ? "lfp-receipt-pulse" : ""}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: `1px solid ${needsAttention ? "#F59E0B" : C.border}`,
                  background: needsAttention ? "#FFFBEB" : C.cream,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  position: "relative",
                  boxShadow: needsAttention
                    ? "0 0 12px rgba(245,158,11,0.4)"
                    : "none",
                }}
                aria-label="Order status"
              >
                <Receipt
                  size={20}
                  style={{ color: needsAttention ? "#D97706" : C.muted }}
                />
                {needsAttention && (
                  <span
                    style={{
                      position: "absolute",
                      top: -3,
                      right: -3,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#EF4444",
                      border: "2px solid #FFFFFF",
                    }}
                  />
                )}
              </button>
            )}
            {/* Бургер-меню */}
            <button style={S.burgerBtn} aria-label="Menu" onClick={() => setAboutOpen(true)}>
              <span style={S.burgerLine} />
              <span style={S.burgerLine} />
              <span style={S.burgerLine} />
            </button>
          </div>
        </div>
      </header>

      {/* ============ VALUE PROPS STRIP ============ */}
      <div style={S.valueStrip}>
        {[
          { icon: <Zap size={14} />, text: "Pick up in 15 min", key: "zap", color: "#006400"},
          { icon: <Rocket size={14} />, text: "Order without call", key: "rocket", color: "#D2691E"},
          { icon: <Clock size={14} />, text: "No waiting", key: "clock", color: "#7B68EE"},
          { icon: <Package size={14} />, text: "Pickup / Grab", key: "package", color: "#E9967A"},
        ].map((b) => (
          <div key={b.key} style={S.valueBadge}>
            <span style={{ ...S.valueBadgeIcon, color: b.color, borderRadius: 6, padding: "2px 4px" }}>{b.icon}</span>
            <span style={S.valueBadgeText}>{b.text}</span>
          </div>
        ))}
      </div>

      {/* ============ ТРИГГЕР КОРЗИНЫ (правый край) ============ */}
      <button
        onClick={() => setSideOpen((v) => !v)}
        aria-label={sideOpen ? "Close cart" : "Open cart"}
        style={{
          ...S.sideTrigger,
          right: sideOpen ? 288 : 0,
          background: triggerBg,
          boxShadow: triggerShadow,
          animation: !sideOpen && cartCount > 0
            ? "lfp-cart-pulse 2.2s ease-in-out infinite"
            : "none",
        }}
      >
        <ShoppingCart size={22} style={{ lineHeight: 1 }} />
        {cartCount > 0 && (
          <span style={S.sideTriggerBadge}>{cartCount}</span>
        )}
      </button>

      {/* Затемнение */}
      <div
        onClick={() => setSideOpen(false)}
        style={{
          ...S.sideScrim,
          opacity: sideOpen ? 1 : 0,
          pointerEvents: sideOpen ? "auto" : "none",
        }}
      />

      {/* ============ БОКОВАЯ ПАНЕЛЬ — КОРЗИНА ============ */}
      <aside
        style={{
          ...S.sidePanel,
          transform: sideOpen ? "translateX(0)" : "translateX(110%)",
        }}
        aria-hidden={!sideOpen}
      >
        <div style={S.sidePanelHeader}>
          <span style={S.sidePanelTitle}>Cart</span>
          <button onClick={() => setSideOpen(false)} style={S.sidePanelClose} aria-label="Close">✕</button>
        </div>

        <div style={S.sidePanelBody}>
          {cart.length === 0 ? (
            <CartPlaceholder />
          ) : (
            <div style={S.sideCartList}>
              {cart.map((l) => (
                <div key={l.uid} style={S.sideCartLine}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.sideCartLineName}>{l.item.name}</div>
                    {l.selectedIngredients.length > 0 && (
                      <div style={S.sideCartLineIngs}>
                        + {l.selectedIngredients.map((i) => i.name).join(", ")}
                      </div>
                    )}
                  </div>
                  <div style={S.sideCartLinePrice}>{l.total} ฿</div>
                  <button
                    onClick={() => removeFromCart(l.uid)}
                    style={S.sideCartLineDel}
                    aria-label="Remove"
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div style={S.sidePanelFooter}>
            <div style={S.sidePanelTotal}>
              <span style={S.sidePanelTotalLabel}>Total</span>
              <span style={S.sidePanelTotalValue}>{cartTotal} ฿</span>
            </div>
            <button
              style={S.sideCheckoutBtn}
              onClick={() => { setSideOpen(false); setCheckoutOpen(true); }}
            >
              Checkout
            </button>
          </div>
        )}
      </aside>

      {/* ============ MAIN ============ */}
      <main style={S.main}>
        <HeroCarousel heroes={heroes} onChoose={(id) => setOpenCategory(id)} onActiveChange={(id) => setActiveHeroId(id)} />
        {/* отступ под нижнее меню иконок */}
        <div style={{ height: 96 }} />
      </main>

      {/* ============ BOTTOM SHEET ============ */}
      {openCategory && (
        <BottomSheet
          category={categories.find((c) => c.id === openCategory) ?? null}
          items={items.filter((i) => i.category === openCategory)}
          onClose={() => setOpenCategory(null)}
          onAdd={addToCartLocal}
          onItemClick={(it) => setOpenItem(it)}
          photoTimestamp={photoTimestamp}
          cartCount={cartCount}
          cartTotal={cartTotal}
        />
      )}

      {/* ============ НИЖНЕЕ STICKY МЕНЮ — ИКОНКИ КАТЕГОРИЙ (кольцевая прокрутка) ============ */}
      <CircularNav
        categories={categories}
        activeId={activeHeroId}
        onChoose={(id) => {
          setOpenCategory(id);
          // Scroll hero to selected category
          const heroIndex = heroes.findIndex(h => h.id === id);
          if (heroIndex >= 0) {
            const carouselTrack = document.querySelector(`.lfp-hero-carousel`) as HTMLElement;
            if (carouselTrack) {
              carouselTrack.scrollTo({ left: heroIndex * carouselTrack.clientWidth, behavior: "smooth" });
            }
          }
        }}
      />

      {/* ============ МОДАЛКА БЛЮДА ============ */}
      <ProductDetail
        item={openItem}
        onClose={() => setOpenItem(null)}
        imageSrc={openItem ? getImageUrl(openItem.image, photoTimestamp) : undefined}
      />

      {/* ============ МОДАЛКА ОФОРМЛЕНИЯ ЗАКАЗА ============ */}
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        restaurantId={selectedRestaurant || "pizzeria_1"}
      />

      {/* ============ МОДАЛКА СТАТУСА ЗАКАЗА ============ */}
      <ClientOrderModal
        paymentQrUrl={restaurants.find(r => r.id === selectedRestaurant)?.payment_qr_url}
        managerUsername={restaurants.find(r => r.id === selectedRestaurant)?.manager_username}
      />

      {/* ============ МОДАЛКА О РЕСТОРАНЕ ============ */}
      <AboutModal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        restaurant={restaurants.find(r => r.id === selectedRestaurant) || null}
      />
    </div>
  );
}

/* ============================================================
   ПЛЕЙСХОЛДЕР ПУСТОЙ КОРЗИНЫ
   ============================================================ */
function CartPlaceholder() {
  return (
    <div style={S.cartPlaceholder}>
    <div style={S.cartPlaceholderEmoji}><ShoppingCart size={48} /></div>
    <div style={S.cartPlaceholderTitle}>Cart is empty</div>
    <p style={S.cartPlaceholderText}>Choose a dish from the menu and add it to your cart.</p>
      <div style={S.cartPlaceholderDivider} />
      <div style={S.cartPlaceholderHow}>
        {[
          { n: "1", text: <>Build your order and click <b>«Checkout»</b></> },
          { n: "2", text: <>Get <b>order number</b> and payment QR code — valid for 15 minutes</> },
          { n: "3", text: <>Choose a seat and pay</> },
          { n: "4", text: <>Get notification — order is ready. Pick it up 🔥</> },
        ].map(({ n, text }) => (
          <div key={n} style={S.cartPlaceholderStep}>
            <span style={S.cartPlaceholderStepNum}>{n}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   HERO CAROUSEL (простой snap — без бесконечной прокрутки)
   ============================================================ */
function HeroCarousel({
  heroes,
  onChoose,
  onActiveChange,
}: {
  heroes: Hero[];
  onChoose: (id: string) => void;
  onActiveChange: (id: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [hintVisible, setHintVisible] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Notify parent on mount
  useEffect(() => {
    if (heroes.length > 0) onActiveChange(heroes[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroes]);

  useEffect(() => {
    if (index !== 0) setHintVisible(false);
    const t = setTimeout(() => setHintVisible(false), 4500);
    return () => clearTimeout(t);
  }, [index]);

  const handleScroll = () => {
    const el = trackRef.current;
    if (!el) return;

    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const i = Math.round(el.scrollLeft / el.clientWidth);
      if (i !== index && i >= 0 && i < heroes.length) {
        setIndex(i);
        onActiveChange(heroes[i].id);
      }
    }, 60);
  };

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <section style={S.carouselWrap}>
      <div ref={trackRef} onScroll={handleScroll} style={S.carouselTrack} className="lfp-hero-carousel">
        {heroes.map((h) => (
          <article key={h.id} style={S.heroSlide}>
            <img
              src={h.image}
              alt={h.name}
              style={S.heroBgImg}
              className="lfp-hero-img"
              onClick={() => onChoose(h.id)}
            />
            <div style={S.heroVignetteTop} />
            <div style={S.heroVignetteBottom} />

            <div style={S.heroRating}>
              <span style={S.heroRatingStar}>★</span>
              <span style={S.heroRatingText}>4.8</span>
              <span style={S.heroRatingDot}>·</span>
              <span style={S.heroRatingSource}>Google maps</span>
            </div>

            <div style={S.heroOverlay}>
              <h2 style={S.heroNameOnImg}>{h.name}</h2>
              <div style={S.heroRowOnImg}>
                <div>
                  <div style={S.heroPriceLabel}>от</div>
                  <div style={S.heroPriceOnImg}>{h.price} ฿</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => onChoose(h.id)}
              style={S.swipeUpHint}
              aria-label={`Order: ${h.name}`}
            >
              Order food&nbsp;→
            </button>
          </article>
        ))}
      </div>

      <div style={S.dots}>
        {heroes.map((h, i) => (
          <button
            key={h.id}
            onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
            style={{ ...S.dot, ...(i === index ? S.dotActive : null) }}
          />
        ))}
      </div>

      {hintVisible && heroes.length > 1 && index === 0 && (
        <div style={S.swipeHint}>
          <span>swipe</span>
          <span style={S.swipeHintArrow}>→</span>
        </div>
      )}
    </section>
  );
}

/* ============================================================
   CIRCULAR CATEGORY NAV (кольцевая прокрутка)
   ============================================================ */
function CircularNav({
  categories,
  activeId,
  onChoose,
}: {
  categories: Category[];
  activeId: string | null;
  onChoose: (id: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const jumpRef = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const n = categories.length;

  // Triple items for seamless infinite scroll only when enough categories
  // For 1-3 categories, show them as-is (no infinite scroll needed)
  const items = n >= 4 ? [...categories, ...categories, ...categories] : categories;

  // Start in the middle copy (only when tripled for infinite scroll)
  useEffect(() => {
    const el = trackRef.current;
    if (!el || n < 4) return;
    const copyWidth = el.scrollWidth / 3;
    el.scrollLeft = copyWidth;
  }, [n]);

  // Auto-scroll to active item (in middle copy)
  useEffect(() => {
    const el = trackRef.current;
    if (!el || !activeId || n === 0) return;
    const idx = categories.findIndex((c) => c.id === activeId);
    if (idx < 0) return;
    const children = el.children;
    const target = children[n + idx] as HTMLElement | undefined;
    if (target) {
      const left = target.offsetLeft - (el.clientWidth / 2) + (target.offsetWidth / 2);
      el.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
  }, [activeId, categories, n]);

  const handleScroll = () => {
    if (jumpRef.current || n < 4) return;
    const el = trackRef.current;
    if (!el) return;

    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const copyWidth = el.scrollWidth / 3;
      if (el.scrollLeft < copyWidth * 0.3) {
        jumpRef.current = true;
        el.scrollLeft += copyWidth;
        requestAnimationFrame(() => { jumpRef.current = false; });
      } else if (el.scrollLeft > copyWidth * 2.3) {
        jumpRef.current = true;
        el.scrollLeft -= copyWidth;
        requestAnimationFrame(() => { jumpRef.current = false; });
      }
    }, 150);
  };

  return (
    <nav style={S.bottomNav}>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        style={S.bottomNavScroll}
        className="lfp-nav-scroll"
      >
        {items.map((c, i) => {
          const isActive = activeId !== null && c.id === activeId;
          return (
            <button
              key={`${c.id}_${i}`}
              onClick={() => onChoose(c.id)}
              style={{
                ...S.bottomNavBtn,
                ...(isActive ? S.bottomNavBtnActive : {}),
              }}
              aria-label={c.label}
            >
              <span
                style={{
                  ...S.bottomNavIcon,
                  transform: isActive ? "scale(1.35)" : "scale(1)",
                  color: isActive ? "#FF4500" : "inherit",
                }}
              >
                {c.icon}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ============================================================
   BOTTOM SHEET
   ============================================================ */
function BottomSheet({
  category,
  items,
  onClose,
  onAdd,
  onItemClick,
  photoTimestamp,
  cartCount,
  cartTotal,
}: {
  category: Category | null;
  items: MenuItem[];
  onClose: () => void;
  onAdd: (item: MenuItem, ings: Ingredient[]) => void;
  onItemClick: (item: MenuItem) => void;
  photoTimestamp: number;
  cartCount: number;
  cartTotal: number;
}) {
  const [selectedIngs, setSelectedIngs] = useState<Record<string, string[]>>({});

  const toggleIng = (itemId: string, ingId: string) => {
    setSelectedIngs((prev) => {
      const cur = prev[itemId] ?? [];
      return {
        ...prev,
        [itemId]: cur.includes(ingId) ? cur.filter((x) => x !== ingId) : [...cur, ingId],
      };
    });
  };

  const handleAdd = (item: MenuItem) => {
    const chosenIds = selectedIngs[item.id] ?? [];
    const chosen = (item.ingredients ?? []).filter((i) => chosenIds.includes(i.id));
    onAdd(item, chosen);
    setSelectedIngs((p) => ({ ...p, [item.id]: [] }));
  };

  return (
    <>
      <div style={S.sheetOverlay} onClick={onClose} />
      <div style={S.sheet}>
        <div style={S.sheetHandle} />
        <div style={S.sheetHeader}>
          <div>
            <h3 style={S.sheetTitle}>{category?.label ?? "Меню"}</h3>
            {cartCount > 0 && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                In cart: {cartCount} items · {cartTotal} ฿
              </div>
            )}
          </div>
          <button onClick={onClose} style={S.sheetClose} aria-label="Close">✕</button>
        </div>
        <div style={S.sheetBody}>
          {items.length === 0 && (
            <div style={S.empty}>Dishes coming soon</div>
          )}
          {items.map((item) => {
            const chosen = selectedIngs[item.id] ?? [];
            const extra = (item.ingredients ?? [])
              .filter((i) => chosen.includes(i.id))
              .reduce((s, i) => s + i.price, 0);
            const total = item.price + extra;
            return (
              <div key={item.id} style={S.itemCard}>
                <img
                  src={getImageUrl(item.image, photoTimestamp)}
                  alt={item.name}
                  style={S.itemImg}
                  className="lfp-item-img"
                  onClick={() => onItemClick(item)}
                  onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
                />
                <div style={S.itemBody}>
                  <div style={S.itemHead}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <div
                        style={{ ...S.itemName, cursor: "pointer" }}
                        onClick={() => onItemClick(item)}
                      >
                        {item.name}
                      </div>
                      {item.hot && <span style={S.hotBadge}>🔥 Popular</span>}
                    </div>
                    <div style={S.itemPrice}>{total} ฿</div>
                  </div>
                  {item.ingredients && item.ingredients.length > 0 && (
                    <div style={S.ingsBox}>
                      {item.ingredients.map((ing) => {
                        const checked = chosen.includes(ing.id);
                        return (
                          <label key={ing.id} style={S.ingRow}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleIng(item.id, ing.id)}
                              style={S.checkbox}
                            />
                            <span style={S.ingName}>{ing.name}</span>
                            <span style={S.ingPrice}>+{ing.price} ฿</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <button onClick={() => handleAdd(item)} style={S.addBtn}>
                    Add to cart · {total} ฿
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ============================================================
   СТИЛИ
   ============================================================ */
const S: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: C.bg,
    color: C.text,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    WebkitFontSmoothing: "antialiased",
  },

  /* VALUE PROPS STRIP */
  valueStrip: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    scrollbarWidth: "none",
    WebkitOverflowScrolling: "touch",
    padding: "10px 16px",
    background: "#FFFFFF",
    borderBottom: "1px solid #F0EBE3",
  },
  valueBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    background: "#F7F4F0",
    border: "1px solid #EDE8E0",
    borderRadius: 99,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  valueBadgeIcon: { display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 },
  valueBadgeText: {
    fontSize: 12,
    fontWeight: 700,
    color: "#3D2E1E",
    letterSpacing: 0.1,
  },

  /* HEADER */
  header: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "saturate(180%) blur(14px)",
    WebkitBackdropFilter: "saturate(180%) blur(14px)",
    borderBottom: "1px solid #F0EBE3",
    boxShadow: "0 1px 0 rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
  },
  headerInner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoBox: { display: "flex", alignItems: "center", gap: 12 },
  logoImg: {
    height: 42,
    width: "auto",
    objectFit: "contain",
  },
  restaurantName: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    color: C.text,
  },
  restaurantDesc: {
    fontSize: 10,
    fontWeight: 600,
    color: C.muted,
    letterSpacing: 0.2,
    marginTop: 2,
    marginLeft: 0,
  },

  /* БУРГЕР-КНОПКА В ХЕДЕРЕ */
  burgerBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    border: `1px solid ${C.border}`,
    background: C.cream,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    padding: "0 12px",
    boxShadow: "0 1px 2px rgba(60,30,10,0.06), 0 8px 24px rgba(120,70,20,0.10), inset 0 1px 0 rgba(255,255,255,0.7)",
  },
  burgerLine: {
    display: "block",
    width: "100%",
    height: 2,
    borderRadius: 2,
    background: C.text,
  },

  /* ТРИГГЕР КОРЗИНЫ (правый край) — опущен до уровня цены */
  sideTrigger: {
    position: "fixed",
    top: "calc(40% + 80px)",
    right: 0,
    transform: "translateY(-50%)",
    zIndex: 70,
    width: 48,
    height: 86,
    border: "none",
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    color: C.white,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    transition: "right 0.45s cubic-bezier(0.22, 1, 0.36, 1), background 0.4s ease",
  },
  sideTriggerIcon: { display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 },
  sideTriggerBadge: {
    background: "rgba(255,255,255,0.9)",
    color: C.text,
    fontSize: 11,
    fontWeight: 900,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    padding: "0 4px",
  },
  sideScrim: {
    position: "fixed",
    inset: 0,
    background: "rgba(20,10,5,0.35)",
    backdropFilter: "blur(2px)",
    WebkitBackdropFilter: "blur(2px)",
    zIndex: 65,
    transition: "opacity 0.35s ease",
  },

  /* БОКОВАЯ ПАНЕЛЬ — КОРЗИНА */
  sidePanel: {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    width: 288,
    zIndex: 68,
    background: "#FFFFFF",
    borderLeft: "1px solid #EDE8E0",
    boxShadow:
      "-4px 0 20px rgba(0,0,0,0.08), -16px 0 50px rgba(0,0,0,0.12)",
    transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
    display: "flex",
    flexDirection: "column",
  },
  sidePanelHeader: {
    padding: "56px 16px 12px",
    borderBottom: `1px solid ${C.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sidePanelTitle: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: C.muted,
  },
  sidePanelClose: {
    width: 32,
    height: 32,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.cream,
    fontSize: 14,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    color: C.muted,
  },
  sidePanelBody: { flex: 1, overflowY: "auto", padding: "12px" },
  sideCartList: { display: "flex", flexDirection: "column", gap: 8 },
  sideCartLine: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    background: "#F7F4F0",
    border: "1px solid #EDE8E0",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  sideCartLineName: { fontWeight: 800, fontSize: 14, color: C.text },
  sideCartLineIngs: { fontSize: 11, color: C.muted, marginTop: 2 },
  sideCartLinePrice: { fontWeight: 800, fontSize: 14, color: C.accentDeep, flexShrink: 0 },
  sideCartLineDel: {
    width: 28,
    height: 28,
    borderRadius: 9,
    border: `1px solid ${C.border}`,
    background: C.cream,
    cursor: "pointer",
    fontSize: 12,
    display: "grid",
    placeItems: "center",
    color: C.muted,
    flexShrink: 0,
  },
  sidePanelFooter: {
    padding: "12px 14px 24px",
    borderTop: "1px solid #EDE8E0",
    background: "#FAFAF8",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  sidePanelTotal: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 2px",
  },
  sidePanelTotalLabel: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 1.2,
    color: C.muted,
  },
  sidePanelTotalValue: { fontSize: 22, fontWeight: 900, color: C.text },
  sideCheckoutBtn: {
    background: C.accentGradient,
    color: C.white,
    border: "none",
    padding: "14px 20px",
    borderRadius: 16,
    fontWeight: 900,
    fontSize: 15,
    letterSpacing: 0.4,
    cursor: "pointer",
    boxShadow:
      "0 6px 16px rgba(255,107,53,0.45), 0 14px 32px -8px rgba(224,78,27,0.55), inset 0 1px 0 rgba(255,255,255,0.4)",
    width: "100%",
  },

  /* ПЛЕЙСХОЛДЕР КОРЗИНЫ */
  cartPlaceholder: {
    padding: "24px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  cartPlaceholderEmoji: { marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted },
  cartPlaceholderTitle: { fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 6 },
  cartPlaceholderText: { fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.5 },
  cartPlaceholderDivider: {
    width: 40, height: 2, background: C.border, borderRadius: 99, margin: "20px auto",
  },
  cartPlaceholderHow: {
    display: "flex", flexDirection: "column", gap: 14, width: "100%", textAlign: "left",
  },
  cartPlaceholderStep: {
    display: "flex", alignItems: "flex-start", gap: 12,
    fontSize: 13, color: C.text, lineHeight: 1.5,
  },
  cartPlaceholderStepNum: {
    width: 24, height: 24, borderRadius: 99,
    background: C.accentGradient, color: C.white,
    fontSize: 12, fontWeight: 900, display: "grid", placeItems: "center",
    flexShrink: 0, marginTop: 1,
    boxShadow: "0 3px 8px rgba(255,107,53,0.35)",
  },

  /* MAIN */
  main: { maxWidth: 1200, margin: "0 auto" },

  /* HERO CAROUSEL */
  carouselWrap: { position: "relative", width: "100%" },
  carouselTrack: {
    display: "flex",
    overflowX: "auto",
    scrollSnapType: "x mandatory",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    borderRadius: 28,
    boxShadow:
      "0 4px 12px rgba(60,30,10,0.10), 0 24px 60px rgba(120,70,20,0.28), 0 50px 100px -30px rgba(120,70,20,0.45)",
  },
  heroSlide: {
    position: "relative",
    flex: "0 0 100%",
    scrollSnapAlign: "center",
    aspectRatio: "4/5",
    maxHeight: "78vh",
    minHeight: 460,
    overflow: "hidden",
    borderRadius: 28,
    background: "linear-gradient(160deg, #F5EFE7 0%, #E8DFD5 100%)",
  },
  heroBgImg: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    pointerEvents: "none",
  },
  heroVignetteTop: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: "30%",
    background: "linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0) 100%)",
    pointerEvents: "none",
  },
  heroVignetteBottom: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: "55%",
    background:
      "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(20,10,5,0.55) 55%, rgba(15,8,3,0.88) 100%)",
    pointerEvents: "none",
  },
  heroOverlay: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    padding: "22px 24px 72px", // доп. отступ снизу под стрелку
    color: C.white,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  heroNameOnImg: {
    margin: 0,
    fontSize: 44,
    fontWeight: 900,
    letterSpacing: 0.5,
    lineHeight: 1,
    textShadow: "0 4px 18px rgba(0,0,0,0.55), 0 1px 0 rgba(0,0,0,0.4)",
  },
  heroRowOnImg: {
    marginTop: 8,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  heroPriceLabel: {
    fontSize: 11,
    opacity: 0.75,
    textTransform: "uppercase" as const,
    letterSpacing: 1.4,
    fontWeight: 700,
  },
  heroPriceOnImg: {
    fontSize: 30,
    fontWeight: 900,
    lineHeight: 1.05,
    textShadow: "0 2px 10px rgba(0,0,0,0.45)",
  },

  /* РЕЙТИНГ — ЛЕВЫЙ ВЕРХНИЙ УГОЛ HERO */
  heroRating: {
    position: "absolute",
    top: 16,
    left: 16,
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 12px",
    background: "rgba(255,255,255,0.16)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: 99,
    boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
  },
  heroRatingStar: {
    fontSize: 14,
    color: "#FFD63A",
    lineHeight: 1,
    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
  },
  heroRatingText: {
    fontSize: 13,
    fontWeight: 900,
    color: C.white,
    lineHeight: 1,
  },
  heroRatingDot: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 1,
  },
  heroRatingReviews: {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 1,
  },
  heroRatingSource: {
    fontSize: 10,
    fontWeight: 800,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.5,
    lineHeight: 1,
    textTransform: "uppercase" as const,
  },

  /* КНОПКА «ЗАКАЗАТЬ ЕДУ» — текстовая */
  swipeUpHint: {
    position: "absolute",
    bottom: 22,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#FFA500",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(144, 128, 25, 0.5)",
    borderRadius: 99,
    padding: "12px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    animation: "lfp-swipe-up 2.2s ease-in-out infinite",
    boxShadow: "0 6px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.35)",
    fontSize: 15,
    fontWeight: 800,
    color: "#3D2E1E",
    letterSpacing: 0.3,
    whiteSpace: "nowrap",
  },

  /* DOTS */
  dots: { display: "flex", justifyContent: "center", gap: 8, marginTop: 16 },
  dot: {
    width: 8, height: 8, borderRadius: 999, border: "none",
    background: "rgba(120,70,20,0.30)", cursor: "pointer", padding: 0,
    transition: "all 0.3s ease",
  },
  dotActive: {
    width: 28,
    background: C.accentGradient,
    boxShadow: "0 4px 10px rgba(255,107,53,0.45)",
  },

  /* SWIPE HINT (горизонтальный) */
  swipeHint: {
    position: "absolute",
    right: 18,
    bottom: 90,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    background: "rgba(255,255,255,0.92)",
    color: C.text,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
    animation: "lfp-swipe 1.5s ease-in-out infinite",
    pointerEvents: "none",
  },
  swipeHintArrow: { fontSize: 16, fontWeight: 900, color: C.accent },

  /* НИЖНЕЕ МЕНЮ — ИКОНКИ (кольцевая прокрутка) */
  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 45,
    background: "rgba(255, 255, 255, 0.97)",
    backdropFilter: "saturate(180%) blur(20px)",
    WebkitBackdropFilter: "saturate(180%) blur(20px)",
    borderTop: "1px solid #EDE8E0",
    boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
  },
  bottomNavScroll: {
    maxWidth: 520,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "10px 12px 18px",
    overflowX: "auto",
    scrollbarWidth: "none",
    WebkitOverflowScrolling: "touch",
    scrollSnapType: "x proximity",
  },
  bottomNavBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "8px 14px",
    borderRadius: 18,
    transition: "background 0.2s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
    WebkitTapHighlightColor: "transparent",
    flexShrink: 0,
    scrollSnapAlign: "center",
  },
  bottomNavBtnActive: {
    background: "rgba(255, 107, 53, 0.10)",
  },
  bottomNavIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.18))",
    transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
  },

  /* BOTTOM SHEET */
  sheetOverlay: {
    position: "fixed",
    inset: 0,
    background: "radial-gradient(ellipse at center, rgba(40,20,8,0.55) 0%, rgba(20,10,5,0.75) 100%)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    zIndex: 90,
  },
  sheet: {
    position: "fixed",
    left: 0, right: 0, bottom: 0,
    maxHeight: "85vh",
    background: "linear-gradient(180deg, #FFFAF2 0%, #FFF1DC 100%)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    zIndex: 100,
    display: "flex",
    flexDirection: "column",
    boxShadow:
      "0 -10px 30px rgba(60,30,10,0.18), 0 -30px 80px rgba(120,70,20,0.30), inset 0 1px 0 rgba(255,255,255,0.9)",
    border: `1px solid ${C.border}`,
  },
  sheetHandle: {
    width: 48, height: 5, background: "rgba(80,50,20,0.20)", borderRadius: 999,
    margin: "10px auto 4px",
  },
  sheetHeader: {
    padding: "8px 22px 14px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    borderBottom: `1px solid ${C.border}`,
  },
  sheetTitle: { margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: 0.3 },
  sheetClose: {
    width: 38, height: 38, borderRadius: 12,
    border: `1px solid ${C.border}`, background: C.cream,
    fontSize: 16, cursor: "pointer",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
  },
  sheetBody: { padding: 16, overflowY: "auto", display: "grid", gap: 14 },
  empty: { textAlign: "center", color: C.muted, padding: "40px 0" },

  /* ITEM CARD */
  itemCard: {
    background: "#FFFFFF",
    borderRadius: 18, padding: 14, display: "flex", gap: 14,
    border: "1px solid #EDE8E0",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 6px 18px rgba(0,0,0,0.07)",
  },
  itemImg: {
    width: 100, height: 100, objectFit: "contain",
    background: "#F5F0EA",
    borderRadius: 14, flexShrink: 0, padding: 6,
    filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.18))",
  },
  itemBody: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  itemHead: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8,
  },
  itemName: { fontWeight: 800, fontSize: 14 },
  hotBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: "2px 8px",
    background: "linear-gradient(135deg, #FFF3CD 0%, #FFE08A 100%)",
    border: "1px solid #FFD04A",
    borderRadius: 99,
    fontSize: 10,
    fontWeight: 800,
    color: "#8A5A00",
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
  },
  itemPrice: { fontWeight: 900, fontSize: 15, color: C.accentDeep },
  ingsBox: { marginTop: 8, display: "grid", gap: 4 },
  ingRow: {
    display: "flex", alignItems: "center", gap: 8,
    fontSize: 12, cursor: "pointer", padding: "4px 0",
  },
  checkbox: { width: 16, height: 16, accentColor: C.accent, cursor: "pointer" },
  ingName: { flex: 1 },
  ingPrice: { color: C.muted, fontWeight: 600 },
  addBtn: {
    marginTop: 12,
    background: C.accentGradient, color: C.white, border: "none",
    padding: "11px 14px", borderRadius: 12, fontWeight: 800, fontSize: 13,
    letterSpacing: 0.3, cursor: "pointer",
    boxShadow:
      "0 6px 14px rgba(255,107,53,0.35), 0 12px 24px -8px rgba(224,78,27,0.40), inset 0 1px 0 rgba(255,255,255,0.4)",
  },
};
