# Telegram Mini App (TMA) Integration Guide

## Overview

This document describes the complete Telegram Mini App integration for the restaurant ordering platform. The integration allows users to access the food ordering application directly from Telegram using the WebApp API.

## Architecture

### Components

#### 1. **useTelegram Hook** (`src/hooks/useTelegram.ts`)
React hook that initializes and manages Telegram WebApp API.

**Features:**
- Detects Telegram environment
- Initializes WebApp with `expand()` and theme colors
- Extracts user data from `initDataUnsafe`
- Parses `restaurant_id` from URL parameters
- Provides fallback for browser testing
- Full TypeScript support with complete TelegramWebApp interface

**Usage:**
```typescript
import { useTelegram } from '@/hooks/useTelegram';

const { webApp, user, isReady, isTelegramEnvironment, restaurantId } = useTelegram();
```

**Returns:**
- `webApp`: TelegramWebApp instance (null if not in Telegram)
- `user`: TelegramUser object with id, first_name, username, language_code
- `isReady`: Boolean indicating if TMA is initialized
- `isTelegramEnvironment`: Boolean indicating if running in Telegram
- `restaurantId`: String from URL parameter `?restaurant_id=pizza_loft`

#### 2. **TelegramContext** (`src/contexts/TelegramContext.tsx`)
React Context for global Telegram state management.

**Provides:**
- Global access to Telegram data across the app
- TelegramProvider wrapper component
- useTelegramContext hook for consuming context

**Usage:**
```typescript
import { useTelegramContext } from '@/contexts/TelegramContext';

const { webApp, user, restaurantId } = useTelegramContext();
```

#### 3. **Home Component Integration** (`src/pages/Home.tsx`)
Updated Home component with TMA features:

**Features:**
- Automatic restaurant selection from URL parameter
- MainButton for checkout (native Telegram button)
- BackButton for navigation
- Responsive to cart state changes

**MainButton Behavior:**
- Shows when cart has items
- Displays item count: "Оформить заказ (3)"
- Triggers checkout modal on click
- Hides when cart is empty

**BackButton Behavior:**
- Shows when viewing product details
- Shows when category is open
- Shows when sidebar is open
- Navigates back through UI hierarchy

#### 4. **Telegram Bot** (`backend/telegram_bot.py`)
Python/aiogram 3.x bot that sends WebAppInfo buttons.

**Commands:**
- `/start` - Show restaurant selection or direct to specific restaurant
- `/menu` - Show restaurant selection menu
- `/help` - Show help information

**Features:**
- WebAppInfo buttons with dynamic restaurant URLs
- Support for start parameters: `/start pizza_loft`
- Inline keyboard with restaurant options
- Error handling and logging

## Setup Instructions

### 1. Environment Variables

Add to `backend/.env`:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
WEBAPP_URL=https://weldwood.sunny-rentals.online
```

Get your bot token from [@BotFather](https://t.me/botfather) on Telegram.

### 2. Bot Configuration in BotFather

1. Open [@BotFather](https://t.me/botfather)
2. Select your bot
3. Go to "Bot Settings" → "Menu Button"
4. Set menu button to your bot commands
5. Go to "Bot Settings" → "Inline Queries"
6. Enable inline queries (optional)

### 3. WebApp URL Configuration

The WebApp URL must be:
- HTTPS (required by Telegram)
- Publicly accessible
- Support URL parameters: `?restaurant_id=pizza_loft`

Example URLs:
```
https://weldwood.sunny-rentals.online
https://weldwood.sunny-rentals.online?restaurant_id=pizza_loft
https://weldwood.sunny-rentals.online?restaurant_id=hello_pizza
```

### 4. Install Dependencies

The bot requires aiogram 3.x:
```bash
pip install aiogram python-dotenv
```

Update `backend/requirements.txt`:
```
aiogram>=3.0.0
python-dotenv>=0.19.0
```

## Usage Flow

### From Telegram Bot

1. User opens bot and sends `/start` or `/menu`
2. Bot displays restaurant selection with WebAppInfo buttons
3. User taps restaurant button
4. Mini App opens with `?restaurant_id=pizza_loft` parameter
5. Home component detects restaurant_id and loads that restaurant's menu
6. User browses menu and adds items to cart
7. MainButton shows "Оформить заказ (N)"
8. User taps MainButton to checkout
9. BackButton allows navigation back through UI

### Direct Browser Access

Users can also access the app directly:
- `https://weldwood.sunny-rentals.online` - Shows all restaurants
- `https://weldwood.sunny-rentals.online?restaurant_id=pizza_loft` - Direct to specific restaurant

## Telegram WebApp API Features

### Initialization
```typescript
webApp.ready();           // Notify Telegram app is ready
webApp.expand();          // Expand to full height
webApp.setHeaderColor('#FFFFFF');      // Set header color
webApp.setBackgroundColor('#FFFFFF');  // Set background color
```

### MainButton
```typescript
webApp.MainButton.setText('Оформить заказ');
webApp.MainButton.show();
webApp.MainButton.onClick(() => {
  // Handle checkout
});
webApp.MainButton.hide();
```

### BackButton
```typescript
webApp.BackButton.show();
webApp.BackButton.onClick(() => {
  // Handle back navigation
});
webApp.BackButton.hide();
```

### User Data
```typescript
const user = webApp.initDataUnsafe.user;
console.log(user.id);           // Telegram user ID
console.log(user.first_name);   // User's first name
console.log(user.username);     // User's username
console.log(user.language_code); // User's language
```

### Haptic Feedback
```typescript
webApp.hapticFeedback.impactOccurred('light');
webApp.hapticFeedback.notificationOccurred('success');
webApp.hapticFeedback.selectionChanged();
```

## Data Flow

```
Telegram Bot
    ↓
WebAppInfo Button with URL
    ↓
Mini App Opens (Home.tsx)
    ↓
useTelegram Hook
    ├─ Initializes WebApp
    ├─ Extracts user data
    └─ Parses restaurant_id from URL
    ↓
TelegramContext
    └─ Provides global state
    ↓
Home Component
    ├─ Loads restaurant menu
    ├─ Shows MainButton for checkout
    └─ Shows BackButton for navigation
    ↓
User Interaction
    ├─ Browse menu
    ├─ Add to cart
    ├─ Tap MainButton → Checkout
    └─ Tap BackButton → Navigate back
```

## File Structure

```
src/
├── hooks/
│   └── useTelegram.ts              # TMA initialization hook
├── contexts/
│   └── TelegramContext.tsx         # Global TMA state
├── pages/
│   └── Home.tsx                    # Updated with TMA integration
└── main.tsx                        # Updated with TelegramProvider

backend/
├── telegram_bot.py                 # Telegram bot with WebAppInfo
├── .env                            # Bot token and WebApp URL
└── requirements.txt                # Python dependencies
```

## Testing

### In Telegram
1. Start your bot: `python backend/telegram_bot.py`
2. Open Telegram and find your bot
3. Send `/start` or `/menu`
4. Tap a restaurant button
5. Mini App opens in Telegram

### In Browser
1. Visit `https://weldwood.sunny-rentals.online`
2. Or with restaurant: `https://weldwood.sunny-rentals.online?restaurant_id=pizza_loft`
3. App works with mock Telegram data

### Browser DevTools
Check console for:
- Telegram environment detection
- User data extraction
- Restaurant ID parsing
- WebApp initialization

## Troubleshooting

### WebApp not initializing
- Check TELEGRAM_BOT_TOKEN in .env
- Verify WEBAPP_URL is HTTPS
- Check browser console for errors

### Restaurant not loading
- Verify restaurant_id in URL parameter
- Check that restaurant exists in database
- Verify API endpoint `/api/restaurants/{restaurant_id}/menu`

### MainButton not showing
- Ensure cart has items
- Check webApp.isReady is true
- Verify MainButton click handler is attached

### BackButton not working
- Check that openItem, openCategory, or sideOpen state is true
- Verify BackButton click handler is attached
- Check browser console for errors

## Security Considerations

1. **Verify initData**: In production, verify `initData` signature on backend
2. **User Authentication**: Use Telegram user ID for order tracking
3. **HTTPS Only**: WebApp URL must be HTTPS
4. **Rate Limiting**: Implement rate limiting on API endpoints
5. **Data Validation**: Validate all user inputs on backend

## Future Enhancements

1. **Order Tracking**: Show order status in Mini App
2. **Payment Integration**: Accept payments through Telegram
3. **Notifications**: Send order updates via Telegram
4. **User Preferences**: Save user preferences in CloudStorage
5. **Share Feature**: Allow users to share restaurants with friends
6. **QR Code**: Generate QR codes for restaurant access

## References

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Telegram WebApp Documentation](https://core.telegram.org/bots/webapps)
- [aiogram Documentation](https://docs.aiogram.dev/)
- [Telegram Mini Apps Guide](https://core.telegram.org/bots/webapps)

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review browser console for errors
3. Check Telegram bot logs
4. Verify environment variables
5. Test in both Telegram and browser
