import { Flame, Dog, Trees, Table2, LibraryBig, CookingPot, type LucideIcon } from "lucide-react";
// Импорты ассетов
import GrillRender from "@/assets/grill.png";
import StoveRender from "@/assets/stove.png";
import ShelfRender from "@/assets/shelf.png";
import TableRender from "@/assets/table_and_base.png";
import GardenRender from "@/assets/garden_furniture.png";
import DogCageRender from "@/assets/dog_cage.png";

// ВАЖНО: Ключи должны строго совпадать с cat.id из вашего файла categories.ts
export const categoryImages: Record<string, string> = {
  grill: GrillRender,
  stove: StoveRender,
  shelf: ShelfRender,
  table_and_base: TableRender,
  computer_table: TableRender,
  garden_furniture: GardenRender,
  dog_cage: DogCageRender,
};

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
}

export const categories: Category[] = [
  { id: "grill", name: "Мангалы", icon: Flame },
  { id: "dog_cage", name: "Вольеры", icon: Dog },
  { id: "garden_furniture", name: "Садовая мебель", icon: Trees },
  { id: "table_and_base", name: "Столы и подстолья", icon: Table2 },
  { id: "computer_table", name: "Компьютерные столы", icon: Table2 },
  { id: "shelf", name: "Стеллажи", icon: LibraryBig },
  { id: "stove", name: "Печи под казан", icon: CookingPot },
];


export const categoryById = (id: string) => categories.find((c) => c.id === id);
