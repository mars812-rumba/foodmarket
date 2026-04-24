import raw from "./inventory.json";
import grill_001 from "@/assets/products/grill_001.jpg";
import grill_002 from "@/assets/products/grill_002.jpg";
import dog_cage_001 from "@/assets/products/dog_cage_001.jpg";
import garden_furniture_001 from "@/assets/products/garden_furniture_001.jpg";
import table_base_001 from "@/assets/products/table_base_001.jpg";
import shelf_001 from "@/assets/products/shelf_001.jpg";
import stove_001 from "@/assets/products/stove_001.jpg";
import stove_002 from "@/assets/products/stove_002.jpg";
import computer_table_001 from "@/assets/products/computer_table_001.jpg";
import computer_table_002 from "@/assets/products/computer_table_002.jpg";

export const imageMap: Record<string, string> = {
  grill_001,
  grill_002,
  dog_cage_001,
  garden_furniture_001,
  table_base_001,
  shelf_001,
  stove_001,
  stove_002,
  computer_table_001,
  computer_table_002,
};

export type Availability = "in_stock" | "custom" | "out_of_stock";

export interface InventoryItem {
  id: string;
  category: string;
  name: string;
  description: string;
  price: number;
  type: "standard" | "custom";
  availability: Availability;
  images: { cover: string; gallery: string[] };
  dimensions: { width: number; height: number; length: number; weight: number };
  base_specs: { material: string; color: string };
  attributes: Record<string, unknown>;
}

export const inventory = raw as InventoryItem[];

export const getImage = (id: string) => imageMap[id] ?? imageMap.grill_001;

export const getItem = (id: string) => inventory.find((i) => i.id === id);
