# Telegram Mini App - Quick Start Guide

## 5-Minute Setup

### Step 1: Get Bot Token
1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot`
3. Follow prompts to create a bot
4. Copy the token (looks like: `123456789:ABCdefGHIjklmnoPQRstuvWXYZ`)

### Step 2: Update Environment
Edit `backend/.env`:
```env
TELEGRAM_BOT_TOKEN=your_token_here
WEBAPP_URL=https://weldwood.sunny-rentals.online
```

### Step 3: Install Dependencies
```bash
cd backend
pip install aiogram python-dotenv
```

### Step 4: Start Bot
```bash
python backend/telegram_bot.py
```

### Step 5: Test in Telegram
1. Open your bot in Telegram
2. Send `/start` or `/menu`
3. Tap a restaurant button
4. Mini App opens!

## How It Works

### User Journey
```
User opens Telegram bot
         ↓
Sends /start or /menu
         ↓
Bot shows restaurant buttons
         ↓
User taps restaurant
         ↓
Mini App opens with restaurant menu
         ↓
User browses and adds items
         ↓
Taps "Оформить заказ" button
         ↓
Checkout modal opens
```

### URL Parameters
The app automatically detects restaurant from URL:
```
https://weldwood.sunny-rentals.online?restaurant_id=pizza_loft
                                       ↑
                                   Parsed by useTelegram hook
```

## Key Features

### 1. MainButton (Checkout)
- Shows when cart has items
- Displays item count
- Triggers checkout on tap
- Native Telegram button (not HTML)

### 2. BackButton (Navigation)
- Shows when viewing details
- Shows when category open
- Shows when sidebar open
- Navigates back through UI

### 3. User Data
Access Telegram user info:
```typescript
const { user } = useTelegramContext();
console.log(user?.first_name);  // "John"
console.log(user?.username);    // "johndoe"
console.log(user?.id);          // 123456789
```

### 4. Restaurant Detection
Automatically loads restaurant from URL:
```typescript
const { restaurantId } = useTelegramContext();
// restaurantId = "pizza_loft" from ?restaurant_id=pizza_loft
```

## Testing Checklist

- [ ] Bot token added to .env
- [ ] WEBAPP_URL is HTTPS
- [ ] Bot starts without errors
- [ ] `/start` command works
- [ ] Restaurant buttons appear
- [ ] Mini App opens on button tap
- [ ] Menu loads correctly
- [ ] MainButton shows when adding items
- [ ] BackButton works for navigation
- [ ] Checkout modal opens

## Common Issues

### Bot won't start
```bash
# Check token format
# Should be: 123456789:ABCdefGHIjklmnoPQRstuvWXYZ

# Check dependencies
pip install aiogram python-dotenv

# Check .env file exists
ls backend/.env
```

### Mini App won't open
```
✓ WEBAPP_URL must be HTTPS
✓ WEBAPP_URL must be publicly accessible
✓ Check browser console for errors
✓ Verify restaurant_id in URL
```

### MainButton not showing
```
✓ Add items to cart
✓ Check webApp.isReady is true
✓ Verify cart state updates
✓ Check browser console
```

## File Changes Summary

### New Files Created
- `src/hooks/useTelegram.ts` - TMA initialization hook
- `src/contexts/TelegramContext.tsx` - Global TMA state
- `backend/telegram_bot.py` - Telegram bot with WebAppInfo

### Modified Files
- `src/pages/Home.tsx` - Added TMA integration
- `src/main.tsx` - Added TelegramProvider wrapper
- `backend/.env` - Added TELEGRAM_BOT_TOKEN and WEBAPP_URL

## Next Steps

1. **Test in Telegram**: Send `/start` and tap a restaurant
2. **Test in Browser**: Visit `https://weldwood.sunny-rentals.online?restaurant_id=pizza_loft`
3. **Add More Restaurants**: Use MenuManager to add menu items
4. **Customize Bot**: Edit `backend/telegram_bot.py` to add more commands
5. **Deploy**: Push changes to production server

## Useful Commands

### Start bot
```bash
python backend/telegram_bot.py
```

### Test specific restaurant
```
https://weldwood.sunny-rentals.online?restaurant_id=pizza_loft
https://weldwood.sunny-rentals.online?restaurant_id=hello_pizza
```

### View bot logs
```bash
# Bot logs appear in terminal
# Check for "Starting Telegram bot..."
```

### Reset bot
```bash
# Stop bot (Ctrl+C)
# Delete .env
# Create new .env with new token
# Restart bot
```

## Support Resources

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [WebApp Documentation](https://core.telegram.org/bots/webapps)
- [aiogram Docs](https://docs.aiogram.dev/)
- [BotFather Help](https://t.me/botfather)

## Example Bot Commands

After bot is running, try these in Telegram:

```
/start              - Show restaurant selection
/menu               - Show restaurant menu
/help               - Show help information
/start pizza_loft   - Direct to Pizza Loft
```

## Production Checklist

- [ ] TELEGRAM_BOT_TOKEN is secure (not in git)
- [ ] WEBAPP_URL is HTTPS
- [ ] Bot is running on production server
- [ ] Error logging is configured
- [ ] Rate limiting is enabled
- [ ] User data is validated
- [ ] Orders are tracked with user ID
- [ ] Backup of bot token exists

---

**Ready to go!** Your Telegram Mini App is now integrated and ready for users to order food directly from Telegram. 🚀
