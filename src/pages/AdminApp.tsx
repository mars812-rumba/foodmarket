import React, { useState, useEffect, Suspense } from "react";
import {
  UtensilsCrossed,
  Users,
  LayoutDashboard,
  Store,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MenuManager = React.lazy(() => import("./admin/MenuManager"));
const CRMPage = React.lazy(() => import("./admin/CRMPage"));

const API_URL =
  import.meta.env.VITE_API_URL || "https://weldwood.sunny-rentals.online";

interface Restaurant {
  id: string;
  restaurant_id: string;
  name: string;
  dashboard_token: string;
  logo?: string;
}

/* ─── shared hook: fetch restaurants with dashboard_token from config ─── */
function useRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const res = await fetch(`${API_URL}/api/restaurants`);
        const data = await res.json();
        const list: Restaurant[] = data.restaurants || [];

        // Fetch config for each restaurant to get dashboard_token
        const withToken = await Promise.all(
          list.map(async (r) => {
            try {
              const cfgRes = await fetch(`${API_URL}/api/restaurants/${r.id}/config`);
              if (cfgRes.ok) {
                const cfg = await cfgRes.json();
                return { ...r, dashboard_token: cfg.dashboard_token || "" };
              }
            } catch {
              // ignore per-restaurant config errors
            }
            return { ...r, dashboard_token: "" };
          })
        );

        setRestaurants(withToken);
      } catch (e) {
        console.error("Ошибка загрузки ресторанов", e);
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurants();
  }, []);

  return { restaurants, loading };
}

/* ─── Tab 3: Restaurant Dashboard (iframe) ─── */
function RestaurantDashboardTab() {
  const { restaurants, loading } = useRestaurants();
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (!loading && restaurants.length > 0 && !selectedId) {
      setSelectedId(restaurants[0].id);
    }
  }, [loading, restaurants, selectedId]);

  const selected = restaurants.find((r) => r.id === selectedId);
  const iframeSrc = selected?.dashboard_token
    ? `${API_URL}/restaurant-dashboard?token=${selected.dashboard_token}`
    : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Рестораны не найдены
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Restaurant selector */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <LayoutDashboard className="h-5 w-5 text-blue-500 shrink-0" />
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Выберите ресторан" />
          </SelectTrigger>
          <SelectContent>
            {restaurants.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dashboard iframe */}
      {iframeSrc ? (
        <iframe
          src={iframeSrc}
          className="flex-1 w-full border-0"
          title="Restaurant Dashboard"
          allow="clipboard-read; clipboard-write"
        />
      ) : (
        <div className="flex items-center justify-center flex-1 text-gray-500">
          У выбранного ресторана нет dashboard_token
        </div>
      )}
    </div>
  );
}

/* ─── Tab 4: Restaurant Vitrina / Showcase (iframe with Home.tsx) ─── */
function RestaurantVitrinaTab() {
  const { restaurants, loading } = useRestaurants();
  const [selectedId, setSelectedId] = useState<string>("");
  const [iframeKey, setIframeKey] = useState(0); // force re-mount on change

  useEffect(() => {
    if (!loading && restaurants.length > 0 && !selectedId) {
      setSelectedId(restaurants[0].id);
    }
  }, [loading, restaurants, selectedId]);

  const handleChange = (id: string) => {
    setSelectedId(id);
    setIframeKey((k) => k + 1); // reload iframe with new restaurant
  };

  // Build URL to Home.tsx with restaurant_id param
  const baseUrl = window.location.origin;
  const iframeSrc = selectedId
    ? `${baseUrl}/?restaurant_id=${selectedId}`
    : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Рестораны не найдены
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Restaurant selector */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <Store className="h-5 w-5 text-orange-500 shrink-0" />
        <Select value={selectedId} onValueChange={handleChange}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Выберите витрину" />
          </SelectTrigger>
          <SelectContent>
            {restaurants.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Vitrina iframe */}
      {iframeSrc ? (
        <iframe
          key={iframeKey}
          src={iframeSrc}
          className="flex-1 w-full border-0"
          title="Restaurant Vitrina"
        />
      ) : (
        <div className="flex items-center justify-center flex-1 text-gray-500">
          Выберите ресторан
        </div>
      )}
    </div>
  );
}

/* ─── Main Admin App ─── */
export default function AdminApp() {
  const [currentScreen, setCurrentScreen] = useState(0);

  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    if (tg) tg.ready();
  }, [tg]);

  // Listen for switchTab events
  useEffect(() => {
    const handleSwitchTab = (event: CustomEvent) => {
      const detail = event.detail;
      let tabIndex = 0;

      if (typeof detail === "object" && detail !== null) {
        tabIndex = detail.tab ?? 0;
      } else if (typeof detail === "number") {
        tabIndex = detail;
      }

      if (typeof tabIndex === "number" && tabIndex >= 0 && tabIndex <= 3) {
        setCurrentScreen(tabIndex);
      }
    };
    window.addEventListener("switchTab", handleSwitchTab as EventListener);
    return () => window.removeEventListener("switchTab", handleSwitchTab as EventListener);
  }, []);

  const screens = [
    { id: 0, name: "Меню", icon: UtensilsCrossed, component: MenuManager },
    { id: 1, name: "CRM", icon: Users, component: CRMPage },
    { id: 2, name: "Дашборд", icon: LayoutDashboard, component: RestaurantDashboardTab },
    { id: 3, name: "Витрина", icon: Store, component: RestaurantVitrinaTab },
  ];

  const CurrentComponent = screens[currentScreen].component;

  const BottomNavBar = () => (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-white border-t border-gray-200 sm:hidden">
      <div className="grid h-full max-w-lg grid-cols-4 mx-auto font-medium">
        {screens.map((screen) => {
          const Icon = screen.icon;
          const isActive = currentScreen === screen.id;
          return (
            <button
              key={screen.name}
              onClick={() => setCurrentScreen(screen.id)}
              type="button"
              className={`inline-flex flex-col items-center justify-center px-3 hover:bg-gray-50 dark:hover:bg-gray-800 group ${
                isActive ? "text-blue-600" : "text-gray-500"
              }`}
            >
              <Icon
                className={`w-5 h-5 mb-1 ${isActive ? "text-blue-600" : "text-gray-500"}`}
              />
              <span className="text-xs">{screen.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      {/* Sticky top menu (desktop) */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm hidden sm:block">
        <div className="flex items-center justify-around px-2 py-1">
          {screens.map((screen) => {
            const Icon = screen.icon;
            const isActive = currentScreen === screen.id;
            return (
              <button
                key={screen.id}
                onClick={() => setCurrentScreen(screen.id)}
                className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-lg transition-all ${
                  isActive
                    ? "bg-blue-500 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isActive ? "text-white" : "text-gray-500"}`}
                />
                <span className="text-[10px] font-medium">{screen.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-16 sm:pb-0">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
            </div>
          }
        >
          <CurrentComponent />
        </Suspense>
      </div>
      <BottomNavBar />
    </div>
  );
}
