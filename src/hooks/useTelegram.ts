import { useEffect, useState } from 'react';

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramUser;
    auth_date?: number;
    hash?: string;
    start_param?: string;
  };
  version: string;
  platform: string;
  headerColor: string;
  backgroundColor: string;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  isClosingConfirmationEnabled: boolean;
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    setParams: (params: {
      text?: string;
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }) => void;
  };
  expand: () => void;
  close: () => void;
  sendData: (data: string) => void;
  onEvent: (eventType: string, callback: () => void) => void;
  offEvent: (eventType: string, callback: () => void) => void;
  ready: () => void;
  requestWriteAccess: () => void;
  requestContactAccess: () => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: string) => void) => void;
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{ id: string; type: string; text: string }>;
  }, callback?: (buttonId: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showScanQrPopup: (params: { text?: string }, callback?: (data: string) => void) => void;
  closeScanQrPopup: () => void;
  readTextFromClipboard: (callback?: (text: string | null) => void) => void;
  shareToStory: (media_url: string, params?: { text?: string; widget_link?: { url: string; name?: string } }) => void;
  shareURL: (url: string, callback?: (shared: boolean) => void) => void;
  switchInlineQuery: (query: string, choose_chat_types?: string[]) => void;
  switchInlineQueryCurrentChat: (query: string) => void;
  openWebApp: (url: string) => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  setBottomBarColor: (color: string) => void;
  hapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  CloudStorage: {
    getItem: (key: string, callback?: (error: string | null, value: string | null) => void) => void;
    setItem: (key: string, value: string, callback?: (error: string | null) => void) => void;
    removeItem: (key: string, callback?: (error: string | null) => void) => void;
    getKeys: (callback?: (error: string | null, keys: string[]) => void) => void;
  };
  SecondaryButton?: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    setParams: (params: {
      text?: string;
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }) => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export interface UseTelegramReturn {
  webApp: TelegramWebApp | null;
  user: TelegramUser | null;
  isReady: boolean;
  isTelegramEnvironment: boolean;
  restaurantId: string | null;
}

export function useTelegram(): UseTelegramReturn {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isTelegramEnvironment, setIsTelegramEnvironment] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  useEffect(() => {
    // Check if we're in Telegram environment
    const tg = window.Telegram?.WebApp;
    
    if (tg) {
      setIsTelegramEnvironment(true);
      setWebApp(tg);

      // Initialize Telegram WebApp
      tg.ready();
      tg.expand();

      // Set theme colors
      tg.setHeaderColor('#FFFFFF');
      tg.setBackgroundColor('#FFFFFF');

      // Extract user data
      const userData = tg.initDataUnsafe?.user;
      if (userData) {
        setUser(userData);
      }

      // Extract restaurant_id from URL parameters
      const params = new URLSearchParams(window.location.search);
      const restId = params.get('restaurant_id');
      if (restId) {
        setRestaurantId(restId);
      }

      setIsReady(true);
    } else {
      // Fallback for browser testing
      setIsTelegramEnvironment(false);
      
      // Try to get restaurant_id from URL
      const params = new URLSearchParams(window.location.search);
      const restId = params.get('restaurant_id');
      if (restId) {
        setRestaurantId(restId);
      }

      // Mock user for testing
      setUser({
        id: 123456789,
        is_bot: false,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        language_code: 'en',
      });

      setIsReady(true);
    }
  }, []);

  return {
    webApp,
    user,
    isReady,
    isTelegramEnvironment,
    restaurantId,
  };
}
