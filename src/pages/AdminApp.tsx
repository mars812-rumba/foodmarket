import React, { useState, useEffect, Suspense } from "react";
import { Car, Calendar, Users } from "lucide-react";
import AdminPanel from "./AdminPanel";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";

const CRMPage = React.lazy(() => import("./admin/CRMPage"));
const AdminScheduler = React.lazy(() => import("./AdminScheduler"));
const CarsPage = React.lazy(() => import("./CarsPage"));

export default function AdminApp() {
  const [currentScreen, setCurrentScreen] = useState(2); // Начинаем с CRM
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const tg = window.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user;
  const [carOwnersMap, setCarOwnersMap] = useState<Record<string, object>>({});
  
  // Store target user_id from URL for offer flow
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  useEffect(() => {
    if (tg) tg.ready();
    if (user) {
      setCarOwnersMap(prev => ({
        ...prev,
        telegramUser: {
          id: user.id,
          name: user.username || user.first_name || ""
        }
      }));
    }
    
    // Listen for switchTab events to navigate between tabs
    const handleSwitchTab = (event: CustomEvent) => {
      const detail = event.detail;
      let tabIndex = 0;
      let userId = null;
      
      if (typeof detail === 'object' && detail !== null) {
        tabIndex = detail.tab ?? 0;
        userId = detail.userId;
      } else if (typeof detail === 'number') {
        tabIndex = detail;
      }
      
      if (typeof tabIndex === 'number' && tabIndex >= 0 && tabIndex <= 2) {
        // Set user_id if provided
        if (userId) {
          setTargetUserId(String(userId));
        }
        
        setCurrentScreen(tabIndex);
        
        // Update URL with user_id when switching to Cars tab
        if (tabIndex === 0 && targetUserId) {
          const url = new URL(window.location.href);
          url.searchParams.set('user_id', targetUserId);
          navigate(url.search, { replace: true });
        }
      }
    };
    window.addEventListener('switchTab', handleSwitchTab as EventListener);
    return () => window.removeEventListener('switchTab', handleSwitchTab as EventListener);
  }, [user, navigate, targetUserId]);

  // Update targetUserId when searchParams change and switch to Cars tab
  useEffect(() => {
    const userIdParam = searchParams.get('user_id');
    if (userIdParam && !targetUserId) {
      setTargetUserId(userIdParam);
      // If we have user_id, switch to Cars tab (index 0)
      setCurrentScreen(0);
    }
  }, [searchParams, targetUserId]);

  const screens = [
    { id: 0, name: "Авто", icon: Car, component: CarsPage, userId: targetUserId },
    { id: 1, name: "Календарь", icon: Calendar, component: AdminScheduler },
    { id: 2, name: "CRM", icon: Users, component: CRMPage },
  ];

  const CurrentComponent = screens[currentScreen].component;
  const CurrentComponentUserId = screens[currentScreen].userId || null;

  // Create component props with userId if needed
  const renderCurrentComponent = () => {
    const Component = CurrentComponent;
    if (currentScreen === 0 && CurrentComponentUserId) {
      return <Component userId={CurrentComponentUserId} />;
    }
    return <Component />;
  };

  const BottomNavBar = () => (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-white border-t border-gray-200 sm:hidden">
      <div className="grid h-full max-w-lg grid-cols-3 mx-auto font-medium">
        {screens.map((screen) => {
          const Icon = screen.icon;
          const isActive = currentScreen === screen.id;
          return (
            <button
              key={screen.name}
              onClick={() => setCurrentScreen(screen.id)}
              type="button"
              className={`inline-flex flex-col items-center justify-center px-5 hover:bg-gray-50 dark:hover:bg-gray-800 group ${isActive ? "text-blue-600" : "text-gray-500"}`}>
              <Icon className={`w-5 h-5 mb-1 ${isActive ? "text-blue-600" : "text-gray-500"}`} />
              <span className="text-xs">{screen.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      {/* Sticky Menu */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm hidden sm:block">
        <div className="flex items-center justify-around px-2 py-1">
          {screens.map((screen) => {
            const Icon = screen.icon;
            const isActive = currentScreen === screen.id;
            
            return (
              <button
                key={screen.id}
                onClick={() => setCurrentScreen(screen.id)}
                className={`
                  flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-lg transition-all
                  ${isActive 
                    ? "bg-blue-500 text-white shadow-md" 
                    : "text-gray-600 hover:bg-gray-100"
                  }
                `}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-gray-500"}`} />
                <span className="text-[10px] font-medium">{screen.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-16 sm:pb-0">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
          </div>
        }>
          {renderCurrentComponent()}
        </Suspense>
      </div>
      <BottomNavBar />
    </div>
  );
}