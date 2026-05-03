# Photo Upload Error Fix - RestManager

## Problem Analysis

The error `JSON.parse: unexpected character at line 1 column 1 of the JSON data` occurred when uploading menu photos in RestManager because:

1. **Backend Response Format Mismatch**: The backend endpoint returned `{"success": True, "uploaded": [...], "count": ...}` but the frontend expected `{"uploaded": [...]}`
2. **Poor Error Handling**: When errors occurred, the backend might return HTML error pages instead of JSON, causing JSON parsing to fail
3. **Missing Input Validation**: The backend didn't validate inputs properly, leading to unclear error messages
4. **Frontend Error Handling**: The frontend didn't properly handle non-JSON responses or provide helpful error messages

## Changes Made

### 1. Backend Fixes (`backend/web_integration.py`)

#### Input Validation
```python
# Added validation for required fields
if not product_id or not category:
    raise HTTPException(status_code=400, detail="product_id и category обязательны")

# Added validation for files
if not photos or len(photos) == 0:
    raise HTTPException(status_code=400, detail="Не выбраны файлы для загрузки")
```

#### Response Format Standardization
```python
# Changed from:
return {"success": True, "uploaded": uploaded, "count": len(uploaded)}

# To:
return {"uploaded": uploaded, "count": len(uploaded)}
```

#### Better Error Messages
- Added specific error messages for each validation failure
- Improved file type checking with warnings for non-image files
- Added check to ensure at least one photo was uploaded

#### Status Code Consistency
- All validation errors now use `status_code=400` (Bad Request)
- Server errors use `status_code=500` (Internal Server Error)

### 2. Frontend Fixes (`src/pages/admin/RestManager.tsx`)

#### Enhanced Error Handling in `uploadProductPhotos()`
```typescript
// Check Content-Type header
const contentType = res.headers.get('content-type');
const isJson = contentType && contentType.includes('application/json');

// Handle non-JSON error responses
if (!res.ok) {
  let errorMessage = 'Upload failed';
  try {
    if (isJson) {
      const error = await res.json();
      errorMessage = error.detail || error.message || 'Upload failed';
    } else {
      const text = await res.text();
      errorMessage = text || `HTTP ${res.status}`;
    }
  } catch (parseErr) {
    errorMessage = `HTTP ${res.status}: ${res.statusText}`;
  }
  throw new Error(errorMessage);
}

// Safe JSON parsing with error handling
let data;
try {
  data = await res.json();
} catch (parseErr) {
  console.error('❌ JSON parse error. Response:', await res.text());
  throw new Error('Invalid JSON response from server');
}

// Validate response structure
if (!data.uploaded || !Array.isArray(data.uploaded)) {
  throw new Error('Invalid response format: missing uploaded array');
}
```

#### Improved `handlePhotoUpload()` Function
- **File Validation**: Checks file type and size before upload
- **Better User Feedback**: Shows specific error messages for validation failures
- **Progress Indication**: Displays number of files being uploaded
- **Timeout Messages**: Error messages auto-dismiss after 5 seconds

```typescript
// File validation
const validFiles = files.filter(f => {
  const isImage = f.type.startsWith('image/');
  const isSmall = f.size <= 5 * 1024 * 1024; // 5MB
  return isImage && isSmall;
});

if (validFiles.length === 0) {
  setUploadStatus('❌ Выберите изображения (PNG, JPG, до 5MB)');
  setTimeout(() => setUploadStatus(''), 5000);
  return;
}
```

## Testing the Fix

### Test Case 1: Valid Upload
1. Open RestManager
2. Create a new product with name and category
3. Go to ФОТО tab
4. Select valid image files (PNG, JPG, up to 5MB)
5. Click "Загрузить фото"
6. Should see: `✅ Загружено: X фото`

### Test Case 2: Missing Fields
1. Try to upload without filling name/category
2. Should see: `❌ Заполните название и категорию`

### Test Case 3: Invalid File Type
1. Try to upload non-image file
2. Should see: `❌ Выберите изображения (PNG, JPG, до 5MB)`

### Test Case 4: File Too Large
1. Try to upload file > 5MB
2. Should see: `❌ Выберите изображения (PNG, JPG, до 5MB)`

### Test Case 5: Server Error
1. If backend returns error, should see specific error message
2. Error message should be readable, not HTML

## Key Improvements

| Issue | Before | After |
|-------|--------|-------|
| Response Format | `{"success": True, ...}` | `{"uploaded": [...], ...}` |
| Error Responses | HTML error pages | JSON with `detail` field |
| Input Validation | Minimal | Comprehensive |
| Error Messages | Generic | Specific and helpful |
| File Validation | None | Type and size checks |
| JSON Parsing | No error handling | Safe with fallbacks |
| User Feedback | Minimal | Clear status messages |

## Files Modified

1. **backend/web_integration.py** (lines 2284-2375)
   - Enhanced input validation
   - Fixed response format
   - Improved error handling

2. **src/pages/admin/RestManager.tsx** (lines 214-309)
   - Better error handling in `uploadProductPhotos()`
   - Enhanced `handlePhotoUpload()` with validation
   - Improved user feedback

## Related Endpoints

The fix applies to:
- `POST /api/admin/upload-photos` - Product photo upload
- Used by RestManager for uploading dish/product photos

## Future Improvements

1. Add progress bar with actual upload percentage
2. Add drag-and-drop file upload
3. Add image preview before upload
4. Add batch upload with retry logic
5. Add image compression before upload
