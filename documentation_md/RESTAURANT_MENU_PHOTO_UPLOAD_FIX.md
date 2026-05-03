# Restaurant Menu Photo Upload Fix

## Problem
The restaurant menu photo upload endpoint was not properly validating inputs and had inconsistent response formats, causing JSON parsing errors similar to the product upload issue.

## Root Causes

1. **Response Format Inconsistency** - Returned `{"status": "ok", ...}` instead of `{"uploaded": [...], ...}`
2. **Missing Input Validation** - No validation for `restaurant_id`, `menu_id`, or `photos`
3. **No File Type Validation** - Non-image files could be uploaded
4. **Poor Error Handling** - Unclear error messages
5. **No Verification** - Didn't verify at least one photo was uploaded

## Solution Implemented

### Backend Changes (`backend/menu_api.py:234-290`)

#### Input Validation
```python
# Validate required fields
if not restaurant_id or not menu_id:
    raise HTTPException(status_code=400, detail="restaurant_id и menu_id обязательны")

# Validate files array
if not photos or len(photos) == 0:
    raise HTTPException(status_code=400, detail="Не выбраны файлы для загрузки")
```

#### File Type Validation
```python
# Check content-type
if not photo.content_type or not photo.content_type.startswith("image/"):
    print(f"⚠️ Skipping non-image file: {photo.filename}")
    continue
```

#### Response Format Standardization
```python
# Changed from:
return {"status": "ok", "uploaded": uploaded_paths}

# To:
return {"uploaded": uploaded_paths, "count": len(uploaded_paths)}
```

#### Error Handling
- HTTP 400 for validation errors
- HTTP 500 for server errors
- Descriptive error messages in `detail` field
- Proper exception handling with logging

#### Upload Verification
```python
# Verify at least one photo was uploaded
if not uploaded_paths:
    raise HTTPException(status_code=400, detail="Не удалось загрузить ни одного фото")
```

### File Path Structure

**Correct Path Structure**:
```
public/images_web/restaurants/{restaurant_id}/{menu_id}_{index}.{ext}
```

**Example**:
```
public/images_web/restaurants/pizza_loft/margherita_0.jpg
public/images_web/restaurants/pizza_loft/margherita_1.jpg
public/images_web/restaurants/pizza_loft/margherita_2.jpg
```

**Relative Path Returned**:
```
restaurants/pizza_loft/margherita_0.jpg
restaurants/pizza_loft/margherita_1.jpg
restaurants/pizza_loft/margherita_2.jpg
```

### Restaurant ID Source

Restaurant IDs come from `backend/data/ar/restaurants.json`:
```json
[
  {
    "restaurant_id": "pizza_loft",
    "name": "PIZZA LOFT",
    "address": "Patong, Gay Bay",
    "phone": "+6678786969",
    "logo": "restaurant_logos/pizza_loft_logo.png",
    "created_at": "2026-04-19T11:19:19.930024"
  }
]
```

The frontend dropdown in `MenuManager.tsx` loads these restaurant IDs and passes the selected one to the upload endpoint.

## How It Works

### Frontend Flow (`MenuManager.tsx`)
```
1. Load restaurants from /api/restaurants
2. User selects restaurant from dropdown
3. Load menu items for selected restaurant
4. User selects photos to upload
5. Send POST to /api/restaurants/{restaurant_id}/upload-menu-photos
6. Include menu_id and photos in FormData
7. Receive response with uploaded paths
8. Update menu item with photo paths
```

### Backend Flow (`menu_api.py`)
```
1. Receive POST request with restaurant_id in URL
2. Validate restaurant_id and menu_id
3. Validate photos array is not empty
4. Create directory: public/images_web/restaurants/{restaurant_id}
5. For each photo:
   a. Validate file type (image/*)
   b. Generate filename: {menu_id}_{index}.{ext}
   c. Save file to disk
   d. Add relative path to response
6. Verify at least one photo was uploaded
7. Return: {"uploaded": [...], "count": N}
```

## Configuration

### Batch Sizes
- **Desktop**: 10 files per batch
- **Mobile**: 3 files per batch
- **Configurable**: Change in `MenuManager.tsx`

### Timeouts
- **Per-batch timeout**: 60 seconds
- **Retry delays**: 1s, 2s (exponential backoff)
- **Inter-batch delay**: 500ms

### File Limits
- **Max file size**: 5MB (enforced on frontend)
- **Allowed types**: image/* (PNG, JPG, JPEG, GIF, WebP, etc.)

## Testing

### ✅ Test 1: Valid Upload
1. Open MenuManager
2. Select restaurant from dropdown
3. Select menu item to edit
4. Go to ФОТО tab
5. Select image files
6. Click "Загрузить фото"
7. Verify: `✅ Загружено: X фото`
8. Verify: Photos appear in preview
9. Verify: Files saved to `public/images_web/restaurants/{restaurant_id}/`

### ✅ Test 2: Multiple Restaurants
1. Create/select multiple restaurants
2. Upload photos for each restaurant
3. Verify: Photos saved in correct restaurant folder
4. Verify: No cross-contamination between restaurants

### ✅ Test 3: Invalid File Type
1. Try to upload non-image file
2. Verify: File is skipped with warning
3. Verify: Only valid images are uploaded

### ✅ Test 4: Missing Fields
1. Try to upload without menu_id
2. Verify: Error message "menu_id обязательны"
3. Try to upload without restaurant_id
4. Verify: Error message "restaurant_id обязательны"

### ✅ Test 5: No Files Selected
1. Try to upload with empty file list
2. Verify: Error message "Не выбраны файлы"

### ✅ Test 6: Mobile Upload
1. Open MenuManager on mobile
2. Select restaurant
3. Select menu item
4. Click "Галерея" or "Камера"
5. Select multiple photos
6. Verify: Photos upload in batches
7. Verify: All photos uploaded successfully

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `backend/menu_api.py` | Input validation, response format, error handling, file type validation | 234-290 |

## Code Changes Summary

### New Features
1. **Input Validation**: Validates restaurant_id, menu_id, photos
2. **File Type Validation**: Only accepts image files
3. **Upload Verification**: Ensures at least one photo was uploaded
4. **Improved Logging**: Detailed console logs for debugging
5. **Consistent Response Format**: `{"uploaded": [...], "count": N}`
6. **Better Error Messages**: Specific, helpful error details

### Backward Compatibility
✅ **Fully Compatible**
- Same API endpoint
- Same URL structure
- Same file storage location
- Frontend already expects new response format

## Deployment

### Steps
1. Deploy updated `backend/menu_api.py`
2. Restart Python backend server
3. Clear browser cache
4. Test on desktop and mobile
5. Monitor server logs

### Rollback
```bash
git checkout backend/menu_api.py
# Restart backend server
```

## Monitoring

### Server Logs
```
✅ Photo saved: restaurants/pizza_loft/margherita_0.jpg
✅ Menu item margherita in restaurant pizza_loft updated with 3 photos
```

### Error Logs
```
⚠️ Skipping non-image file: document.pdf
❌ Error saving photo: [error details]
❌ Error uploading menu photos: [error details]
```

### Success Indicators
- ✅ HTTP 200 response
- ✅ All batches complete
- ✅ Total uploaded count matches selected count
- ✅ Photos appear in preview
- ✅ Files exist in correct directory

## Directory Structure

```
public/images_web/restaurants/
├── pizza_loft/
│   ├── margherita_0.jpg
│   ├── margherita_1.jpg
│   ├── margherita_2.jpg
│   ├── pepperoni_0.jpg
│   └── pepperoni_1.jpg
├── burger_king/
│   ├── whopper_0.jpg
│   └── whopper_1.jpg
└── sushi_bar/
    ├── california_roll_0.jpg
    └── california_roll_1.jpg
```

## API Endpoints

### Upload Menu Photos
```
POST /api/restaurants/{restaurant_id}/upload-menu-photos
Content-Type: multipart/form-data

Parameters:
- restaurant_id: string (from URL)
- menu_id: string (from FormData)
- photos: File[] (from FormData)

Response (200):
{
  "uploaded": [
    "restaurants/pizza_loft/margherita_0.jpg",
    "restaurants/pizza_loft/margherita_1.jpg"
  ],
  "count": 2
}

Error (400/500):
{
  "detail": "Specific error message"
}
```

## Troubleshooting

### Issue: Photos not uploading
**Solution**:
1. Check browser console for errors
2. Verify restaurant_id is selected
3. Verify menu_id is provided
4. Check server logs for upload errors
5. Verify `public/images_web/restaurants/` directory exists

### Issue: Photos upload but don't appear
**Solution**:
1. Refresh the page
2. Check browser console for errors
3. Verify files exist in correct directory
4. Check server logs for save errors

### Issue: Wrong restaurant folder
**Solution**:
1. Verify correct restaurant is selected in dropdown
2. Check URL includes correct restaurant_id
3. Verify restaurant_id matches folder name
4. Check `backend/data/ar/restaurants.json` for correct IDs

### Issue: File type errors
**Solution**:
1. Ensure files are valid images (PNG, JPG, etc.)
2. Check file extensions are correct
3. Verify file MIME type is image/*
4. Try different image format

## Future Improvements

1. **Image Compression**: Compress images before saving
2. **Thumbnail Generation**: Auto-generate thumbnails
3. **Image Validation**: Validate image dimensions
4. **Duplicate Detection**: Prevent duplicate uploads
5. **Batch Operations**: Upload to multiple menu items
6. **Image Editing**: Allow cropping/rotating
7. **CDN Integration**: Upload to CDN instead of local storage
8. **Async Processing**: Process uploads asynchronously

## Related Documentation

- `PHOTO_UPLOAD_FIX_SUMMARY.md` - Product photo upload fix
- `MOBILE_PHOTO_UPLOAD_FIX.md` - Mobile upload optimization
- `PHOTO_UPLOAD_IMPLEMENTATION_GUIDE.md` - Implementation guide
