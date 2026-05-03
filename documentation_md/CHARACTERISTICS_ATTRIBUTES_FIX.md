# Characteristics and Attributes Fix

## Problem
Characteristics (dimensions, color, finish, weight) and attributes were not being saved in the admin panel. Additionally, attributes were all being treated as boolean even when they should have values with units.

## Root Cause
The backend models (`ProductBase` and `ProductUpdate`) were missing the new fields:
- `dimensions` (object with width, height, depth)
- `color` (string)
- `finish` (string)
- `weight` (number)
- `old_price` (number)
- `featured_attributes` (array of strings)

Additionally, the `attributes` field was typed as `Dict[str, Any]` but needed to support both:
- **Boolean attributes** (no suffix in attributeMeta): stored as `true` (boolean)
- **Value attributes** (with suffix in attributeMeta): stored as string values like "10", "20", etc.

## Solution

### 1. Backend Changes (`backend/web_integration.py`)

#### Updated `ProductBase` model (lines 572-607):
- Added `old_price: Optional[float]` field
- Added `dimensions: Optional[Dict[str, float]]` field
- Added `color: Optional[str]` field
- Added `finish: Optional[str]` field
- Added `weight: Optional[float]` field
- Added `featured_attributes: Optional[List[str]]` field
- Changed `attributes` type from `Dict[str, Any]` to `Dict[str, Union[str, bool]]`

#### Updated `ProductUpdate` model (lines 610-635):
- Added all the same new fields as `ProductBase`
- Changed `attributes` type to `Dict[str, Union[str, bool]]`

#### Updated `create_admin_product` endpoint (lines 2139-2157):
- Now includes all new fields in the `new_product` dictionary when creating products

### 2. Frontend Changes (`src/pages/admin/ProductsPage.tsx`)

#### Updated `FurnitureItem` interface (line 89):
- Changed `attributes: Record<string, string>` to `attributes: Record<string, string | boolean>`

#### Updated attribute handling in ATTRS tab (lines 635-678):
- **For boolean attributes** (no suffix): stores `true` (boolean) when checked
- **For value attributes** (with suffix): stores empty string `''` initially, then user fills in the value
- Properly detects checked state by checking if value is not undefined/null/empty
- Displays the correct value in the input field for value-based attributes

## How It Works

### Boolean Attributes (e.g., "Крышка", "Решётка-гриль")
```typescript
// In attributeMeta - no suffix
lid: { label: "Крышка", icon: BookOpen }

// In admin form - checkbox only
// When checked: attributes.lid = true (boolean)
// When unchecked: attributes.lid is deleted
```

### Value Attributes (e.g., "Толщина стали", "Шампуры")
```typescript
// In attributeMeta - has suffix
thickness_steel: { label: "Толщина стали", icon: Layers, suffix: " мм" }

// In admin form - checkbox + input field
// When checked: attributes.thickness_steel = "" (empty string, user fills it)
// User types "5": attributes.thickness_steel = "5"
// When unchecked: attributes.thickness_steel is deleted
```

### Display on Storefront
The `formatAttrValue` function in `src/data/attributeIcons.ts` handles both types:
```typescript
export function formatAttrValue(value: unknown, suffix?: string): string {
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "—";
  return `${value}${suffix ?? ""}`;
}
```

## Data Structure Example

### In backend/data/inventory.json
```json
{
  "id": "prod_1776547432608",
  "name": "Стол Коричневый",
  "category": "computer_table",
  "price": 12000.0,
  "old_price": 15000.0,
  "dimensions": {
    "width": 1000.0,
    "height": 750.0,
    "depth": 600.0
  },
  "color": "black",
  "finish": "matte",
  "weight": 15.0,
  "featured_attributes": ["keyboard_shelf", "cable_management"],
  "attributes": {
    "keyboard_shelf": true,
    "cable_management": true,
    "drawers": "3",
    "tabletop_thickness": "28",
    "height_adjustment": true,
    "tabletop_material": true,
    "tabletop_color": true
  }
}
```

## Testing

1. **Create/Edit Product**: Go to admin panel, create or edit a product
2. **Set Characteristics**: In SPECI tab, select dimensions, color, weight, finish
3. **Set Attributes**: In ATTRS tab, check boolean attributes and fill in values for value-based attributes
4. **Save**: Click save button
5. **Verify**: Check that data is saved in backend/data/inventory.json
6. **View on Storefront**: Go to product page and verify characteristics and attributes display correctly

## Files Modified

1. `backend/web_integration.py` - Updated ProductBase and ProductUpdate models, create endpoint
2. `src/pages/admin/ProductsPage.tsx` - Updated FurnitureItem interface and attribute handling logic
3. No changes needed to `src/data/attributeIcons.ts` - already had correct formatAttrValue function
4. No changes needed to `src/pages/Product.tsx` - already displays attributes correctly
5. No changes needed to `src/pages/Catalog.tsx` - already displays featured attributes correctly
