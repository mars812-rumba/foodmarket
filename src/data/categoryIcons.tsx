import {
  Pizza,
  Hamburger,
  Beef,
  UtensilsCrossed,
  Fish,
  PillBottle,
  Drumstick,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, { label: string; icon: React.ReactNode }> = {
  pizza: { label: "Pizza", icon: <Pizza size={24} /> },
  burger: { label: "Burger", icon: <Hamburger size={24} /> },
  steak: { label: "Steak", icon: <Beef size={24} /> },
  pasta: { label: "Pasta", icon: <UtensilsCrossed size={24} /> },
  sushi: { label: "Sushi", icon: <Fish size={24} /> },
  drinks: { label: "Drinks", icon: <PillBottle size={24} /> },
  potato_chicken: { label: "Chicken Fries", icon: <Drumstick size={24} /> },
};
