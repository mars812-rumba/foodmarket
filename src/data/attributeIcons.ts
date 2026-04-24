import {
  Ruler, Weight, Layers, Wind, Utensils, CircleDot, BookOpen, Thermometer,
  Trash2, Flame, ToggleLeft, Lock, Box, Square, Mountain, Hammer, Palette,
  ArrowUpDown, BarChart3, Cable, Monitor, Keyboard, Move3d, GalleryHorizontal,
  Users, Shield, type LucideIcon,
} from "lucide-react";

// Стандартные размеры по категориям (в мм)
export const STANDARD_SIZES = {
  computer_table: [
    { width: 800, height: 750, depth: 600, label: "800×750×600" },
    { width: 1000, height: 750, depth: 600, label: "1000×750×600" },
    { width: 1200, height: 750, depth: 600, label: "1200×750×600" },
    { width: 1400, height: 750, depth: 700, label: "1400×750×700" },
  ],
  grill: [
    { width: 800, height: 900, depth: 400, label: "800×900×400" },
    { width: 1000, height: 950, depth: 500, label: "1000×950×500" },
    { width: 1200, height: 1000, depth: 500, label: "1200×1000×500" },
  ],
  dog_cage: [
    { width: 800, height: 800, depth: 600, label: "800×800×600" },
    { width: 1000, height: 800, depth: 700, label: "1000×800×700" },
    { width: 1200, height: 900, depth: 800, label: "1200×900×800" },
  ],
  garden_furniture: [
    { width: 1200, height: 750, depth: 600, label: "1200×750×600" },
    { width: 1500, height: 750, depth: 800, label: "1500×750×800" },
    { width: 1800, height: 800, depth: 900, label: "1800×800×900" },
  ],
  shelf: [
    { width: 600, height: 1200, depth: 300, label: "600×1200×300" },
    { width: 900, height: 1200, depth: 300, label: "900×1200×300" },
    { width: 1200, height: 1500, depth: 350, label: "1200×1500×350" },
  ],
  stove: [
    { width: 600, height: 900, depth: 600, label: "600×900×600" },
    { width: 700, height: 950, depth: 700, label: "700×950×700" },
    { width: 800, height: 1000, depth: 800, label: "800×1000×800" },
  ],
  table_base: [
    { width: 600, height: 750, depth: 400, label: "600×750×400" },
    { width: 800, height: 750, depth: 600, label: "800×750×600" },
    { width: 1000, height: 750, depth: 600, label: "1000×750×600" },
  ],
};

// Основные цвета
export const STANDARD_COLORS = [
  { value: "black", label: "Чёрный", hex: "#000000" },
  { value: "white", label: "Белый", hex: "#FFFFFF" },
  { value: "gray", label: "Серый", hex: "#808080" },
  { value: "brown", label: "Коричневый", hex: "#8B4513" },
  { value: "natural", label: "Натуральный", hex: "#D2B48C" },
  { value: "red", label: "Красный", hex: "#FF0000" },
  { value: "blue", label: "Синий", hex: "#0000FF" },
  { value: "green", label: "Зелёный", hex: "#008000" },
  { value: "yellow", label: "Жёлтый", hex: "#FFFF00" },
  { value: "orange", label: "Оранжевый", hex: "#FFA500" },
];

// Покрытие (матовое/глянцевое)
export const FINISHES = [
  { value: "matte", label: "Матовое" },
  { value: "glossy", label: "Глянцевое" },
];

export const attributeMeta: Record<string, { label: string; icon: LucideIcon; suffix?: string }> = {
  thickness_steel: { label: "Толщина стали", icon: Layers, suffix: " мм" },
  chimney_height: { label: "Дымоход", icon: Wind, suffix: " мм" },
  skewers_capacity: { label: "Шампуры", icon: Utensils, suffix: " шт" },
  kazan_ring: { label: "Кольцо под казан", icon: CircleDot },
  kazan_volume: { label: "Объём казана", icon: CircleDot },
  lid: { label: "Крышка", icon: BookOpen },
  grill_grate: { label: "Решётка-гриль", icon: Square },
  thermometer: { label: "Термометр", icon: Thermometer },
  ash_drawer: { label: "Зольник", icon: Trash2 },
  firewood_niche: { label: "Дровница", icon: Flame },
  damper: { label: "Заслонка", icon: ToggleLeft },
  draft_control: { label: "Регулировка тяги", icon: ToggleLeft },
  chimney: { label: "Дымоход", icon: Wind },
  bars_profile: { label: "Профиль прута", icon: Box },
  door_lock: { label: "Замок двери", icon: Lock },
  tray: { label: "Поддон", icon: Square },
  countertop: { label: "Столешница", icon: Table2Icon },
  assembly_time: { label: "Сборка", icon: Hammer },
  set_composition: { label: "Состав", icon: Layers },
  seats_count: { label: "Мест", icon: Users },
  wood_species: { label: "Порода", icon: Mountain },
  wood_treatment: { label: "Покрытие", icon: Palette },
  wood_color: { label: "Цвет дерева", icon: Palette },
  table_length: { label: "Длина стола", icon: Ruler, suffix: " мм" },
  bench_length: { label: "Длина лавки", icon: Ruler, suffix: " мм" },
  shape: { label: "Форма", icon: Square },
  adjustable_feet: { label: "Регул. ножки", icon: ArrowUpDown },
  max_load: { label: "Макс. нагрузка", icon: Weight, suffix: " кг" },
  legs_count: { label: "Ножки", icon: BarChart3, suffix: " шт" },
  profile_thickness: { label: "Толщина профиля", icon: Layers, suffix: " мм" },
  shelves_count: { label: "Полок", icon: BarChart3, suffix: " шт" },
  shelf_material: { label: "Материал полок", icon: Mountain },
  shelf_color: { label: "Цвет полок", icon: Palette },
  mount_type: { label: "Крепление", icon: Shield },
  max_load_per_shelf: { label: "На полку", icon: Weight, suffix: " кг" },
  shelf_spacing: { label: "Шаг полок", icon: Ruler, suffix: " мм" },
  tabletop_material: { label: "Материал столешницы", icon: Mountain },
  tabletop_color: { label: "Цвет столешницы", icon: Palette },
  tabletop_thickness: { label: "Толщина столешницы", icon: Layers, suffix: " мм" },
  drawers: { label: "Ящики", icon: GalleryHorizontal, suffix: " шт" },
  cable_management: { label: "Кабель-канал", icon: Cable },
  monitor_shelf: { label: "Полка под монитор", icon: Monitor },
  keyboard_shelf: { label: "Полка под клавиатуру", icon: Keyboard },
  height_adjustment: { label: "Регул. высоты", icon: Move3d },
};

// Группировка атрибутов по категориям
export const attributesByCategory: Record<string, string[]> = {
  grill: ["thickness_steel", "chimney_height", "skewers_capacity", "kazan_ring", "kazan_volume", "lid", "grill_grate", "thermometer", "ash_drawer", "firewood_niche", "damper", "draft_control", "chimney"],
  dog_cage: ["bars_profile", "door_lock", "tray", "assembly_time"],
  garden_furniture: ["set_composition", "seats_count", "wood_species", "wood_treatment", "wood_color", "table_length", "bench_length", "shape"],
  shelf: ["shelves_count", "shelf_material", "shelf_color", "mount_type", "max_load_per_shelf", "shelf_spacing"],
  stove: ["kazan_volume", "thickness_steel", "chimney", "chimney_height", "firewood_niche", "draft_control"],
  table_and_base: ["shape", "adjustable_feet", "max_load", "legs_count", "profile_thickness"],
  computer_table: ["tabletop_material", "tabletop_color", "tabletop_thickness", "drawers", "cable_management", "monitor_shelf", "keyboard_shelf", "height_adjustment"],
};

import { Table2 as Table2Icon } from "lucide-react";

export function formatAttrValue(value: unknown, suffix?: string): string {
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "—";
  return `${value}${suffix ?? ""}`;
}

export function calculateDiscount(price: number, oldPrice: number): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

export function getPriceDisplay(item: { price: number; old_price?: number }) {
  const discount = item.old_price ? calculateDiscount(item.price, item.old_price) : 0;
  return {
    currentPrice: item.price,
    oldPrice: item.old_price,
    discount
  };
}
