import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTelegramContext } from "./TelegramContext";

/* ============================================================
   ТИПЫ (совместимы с Home.tsx)
   ============================================================ */
export type Ingredient = { id: string; name: string; price: number };

export type MenuItem = {
  id: string;
  category: string;
  name: string;
  price: number;
  image: string;
  weight?: string;
  notes?: string;
  ingredients?: Ingredient[];
  available?: boolean;
};

export type CartLine = {
  uid: string;
  item: MenuItem;
  selectedIngredients: Ingredient[];
  qty: number;
  total: number; // итог за всю позицию (price + ings) * qty
};

export type OrderPayload = {
  restaurant_id: string;
  customer: {
    name: string;
    phone: string;
    delivery_type: "delivery" | "pickup";
    address?: string;
    payment: "qr_prompt_pay" | "cash";
  };
  items: Array<{
    name: string;
    price: number;
    qnt: number;
  }>;
  total: number;
  created_at: string;
};

type CartContextValue = {
  cart: CartLine[];
  cartCount: number;
  cartTotal: number;
  addToCart: (item: MenuItem, ings?: Ingredient[]) => void;
  removeFromCart: (uid: string) => void;
  incQty: (uid: string) => void;
  decQty: (uid: string) => void;
  clearCart: () => void;
  submitOrder: (
    customer: OrderPayload["customer"],
    restaurantId: string
  ) => Promise<{ ok: boolean; orderId?: string; error?: string }>;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "lfp_cart_v1";
const API_URL = import.meta.env.VITE_API_URL || "https://weldwood.sunny-rentals.online";

function calcLineTotal(item: MenuItem, ings: Ingredient[], qty: number) {
  const base = item.price + ings.reduce((s, i) => s + i.price, 0);
  return base * qty;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user: tgUser, isTelegramEnvironment } = useTelegramContext();
  const [cart, setCart] = useState<CartLine[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      /* ignore */
    }
  }, [cart]);

  const addToCart = useCallback((item: MenuItem, ings: Ingredient[] = []) => {
    setCart((prev) => [
      ...prev,
      {
        uid: `${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        item,
        selectedIngredients: ings,
        qty: 1,
        total: calcLineTotal(item, ings, 1),
      },
    ]);
  }, []);

  const removeFromCart = useCallback((uid: string) => {
    setCart((prev) => prev.filter((l) => l.uid !== uid));
  }, []);

  const incQty = useCallback((uid: string) => {
    setCart((prev) =>
      prev.map((l) =>
        l.uid === uid
          ? { ...l, qty: l.qty + 1, total: calcLineTotal(l.item, l.selectedIngredients, l.qty + 1) }
          : l
      )
    );
  }, []);

  const decQty = useCallback((uid: string) => {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.uid !== uid) return [l];
        const nextQty = l.qty - 1;
        if (nextQty <= 0) return [];
        return [{ ...l, qty: nextQty, total: calcLineTotal(l.item, l.selectedIngredients, nextQty) }];
      })
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const submitOrder = useCallback<CartContextValue["submitOrder"]>(
    async (customer, restaurantId) => {
      const items = cart.map((l) => ({
        name: l.item.name,
        price: l.item.price + l.selectedIngredients.reduce((s, i) => s + i.price, 0),
        qnt: l.qty,
      }));

      // Include Telegram user_id so CRM can match the existing card
      // created at /start deep link entry (instead of creating a duplicate web_* card)
      const tgUserId = isTelegramEnvironment && tgUser ? String(tgUser.id) : "";

      const payload = {
        user_id: tgUserId,
        customer_name: customer.name,
        contacts: customer.phone,
        items,
        delivery_type: customer.delivery_type,
        payment_method: customer.payment,
      };

      // eslint-disable-next-line no-console
      console.log("[order:submit] payload →", payload);

      try {
        const res = await fetch(`${API_URL}/api/${restaurantId}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({})) as { detail?: string };
          return { ok: false, error: errData.detail || `Ошибка ${res.status}` };
        }
        const data = (await res.json().catch(() => ({}))) as { order?: { order_id?: string } };
        const orderId = data.order?.order_id || `srv_${Date.now()}`;
        return { ok: true, orderId };
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[order:submit] network error", e);
        return { ok: false, error: "Сеть недоступна" };
      }
    },
    [cart, tgUser, isTelegramEnvironment]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      cartCount: cart.reduce((s, l) => s + l.qty, 0),
      cartTotal: cart.reduce((s, l) => s + l.total, 0),
      addToCart,
      removeFromCart,
      incQty,
      decQty,
      clearCart,
      submitOrder,
    }),
    [cart, addToCart, removeFromCart, incQty, decQty, clearCart, submitOrder]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}