# Photo Upload Fix - Implementation Guide

## Overview

Fixed the `JSON.parse: unexpected character` error in RestManager photo upload feature by:
1. Standardizing backend response format
2. Adding comprehensive input validation
3. Implementing safe JSON parsing on frontend
4. Adding file validation before upload
5. Improving error messages and user feedback

## Changes Summary

### Backend (`backend/web_integration.py`)

**Endpoint**: `POST /api/admin/upload-photos`

**Changes Made**:
- ✅ Added input validation for `product_id`, `category`, and `photos`
- ✅ Changed response format from `{"success": True, ...}` to `{"uploaded": [...], ...}`
- ✅ Added file type validation (must be image)
- ✅ Added check to ensure at least one photo was uploaded
- ✅ Improved error messages with specific details
- ✅ Consistent HTTP status codes (400 for validation, 500 for server errors)

**Key Code Sections**:
```python
# Input validation (lines 2292-2302)
if not product_id or not category:
    raise HTTPException(status_code=400, detail="product_id и category обязательны")
if category not in VALID_CLASSES:
    raise HTTPException(status_code=400, detail=f"Неверная категория...")
if not photos or len(photos) == 0:
    raise HTTPException(status_code=400, detail="Не выбраны файлы для загрузки")

# File type validation (lines 2323-2329)
if not photo.filename:
    continue
if not photo.content_type or not photo.content_type.startswith("image/"):
    print(f"⚠️ Skipping non-image file: {photo.filename}")
    continue

# Response format (line 2383)
return {"uploaded": uploaded, "count": len(uploaded)}
```

### Frontend (`src/pages/admin/RestManager.tsx`)

**Function 1**: `uploadProductPhotos()` (lines 215-265)

**Changes Made**:
- ✅ Check Content-Type header before parsing JSON
- ✅ Handle non-JSON error responses gracefully
- ✅ Safe JSON parsing with try-catch
- ✅ Validate response structure before using data
- ✅ Provide clear error messages

**Key Code Sections**:
```typescript
// Content-Type check (lines 227-229)
const contentType = res.headers.get('content-type');
const isJson = contentType && contentType.includes('application/json');

// Error handling (lines 231-244)
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

// Safe JSON parsing (lines 247-254)
let data;
try {
  data = await res.json();
} catch (parseErr) {
  console.error('❌ JSON parse error. Response:', await res.text());
  throw new Error('Invalid JSON response from server');
}

// Response validation (lines 256-258)
if (!data.uploaded || !Array.isArray(data.uploaded)) {
  throw new Error('Invalid response format: missing uploaded array');
}
```

**Function 2**: `handlePhotoUpload()` (lines 240-309)

**Changes Made**:
- ✅ Validate file type before upload
- ✅ Validate file size (max 5MB)
- ✅ Validate product name and category are filled
- ✅ Filter invalid files before sending to server
- ✅ Show specific error messages
- ✅ Display upload progress
- ✅ Auto-dismiss messages after 5 seconds

**Key Code Sections**:
```typescript
// Input validation (lines 246-253)
if (!productId || !category) {
  setUploadStatus('❌ Заполните название и категорию');
  setTimeout(() => setUploadStatus(''), 5000);
  e.target.value = '';
  return;
}

// File validation (lines 255-268)
const validFiles = files.filter(f => {
  const isImage = f.type.startsWith('image/');
  const isSmall = f.size <= 5 * 1024 * 1024; // 5MB
  if (!isImage) {
    console.warn(`⚠️ Файл ${f.name} не является изображением`);
  }
  if (!isSmall) {
    console.warn(`⚠️ Файл ${f.name} больше 5MB`);
  }
  return isImage && isSmall;
});

if (validFiles.length === 0) {
  setUploadStatus('❌ Выберите изображения (PNG, JPG, до 5MB)');
  setTimeout(() => setUploadStatus(''), 5000);
  e.target.value = '';
  return;
}

// Upload with error handling (lines 270-305)
try {
  const uploadedPaths = await uploadProductPhotos(validFiles, productId, category);
  // ... success handling
} catch (err: any) {
  const errorMsg = err.message || 'Неизвестная ошибка';
  setUploadStatus(`❌ Ошибка: ${errorMsg}`);
  setTimeout(() => setUploadStatus(''), 5000);
}
```

## Testing Checklist

### ✅ Test 1: Valid Upload
- [ ] Open RestManager
- [ ] Create new product with name and category
- [ ] Go to ФОТО tab
- [ ] Select valid image files (PNG, JPG, up to 5MB)
- [ ] Click "Загрузить фото"
- [ ] Verify: `✅ Загружено: X фото` message appears
- [ ] Verify: Photos appear in preview
- [ ] Verify: Photos persist after save

### ✅ Test 2: Missing Product Name
- [ ] Try to upload without filling product name
- [ ] Verify: `❌ Заполните название и категорию` message
- [ ] Verify: Message auto-dismisses after 5 seconds

### ✅ Test 3: Missing Category
- [ ] Fill product name but not category
- [ ] Try to upload
- [ ] Verify: `❌ Заполните название и категорию` message

### ✅ Test 4: Invalid File Type
- [ ] Try to upload non-image file (PDF, TXT, etc.)
- [ ] Verify: `❌ Выберите изображения (PNG, JPG, до 5MB)` message
- [ ] Verify: File is filtered out

### ✅ Test 5: File Too Large
- [ ] Try to upload file > 5MB
- [ ] Verify: `❌ Выберите изображения (PNG, JPG, до 5MB)` message
- [ ] Verify: File is filtered out

### ✅ Test 6: Mixed Valid/Invalid Files
- [ ] Select mix of valid and invalid files
- [ ] Verify: Only valid files are uploaded
- [ ] Verify: Console shows warnings for invalid files

### ✅ Test 7: Server Error Handling
- [ ] Simulate server error (e.g., invalid category)
- [ ] Verify: Error message is displayed
- [ ] Verify: Message is readable (not HTML)
- [ ] Verify: Message auto-dismisses

### ✅ Test 8: Network Error
- [ ] Disable network and try upload
- [ ] Verify: Error is caught and displayed
- [ ] Verify: User can retry

## Deployment Steps

1. **Backend**:
   - Restart Python backend server
   - Verify `/api/admin/upload-photos` endpoint is running
   - Check logs for any startup errors

2. **Frontend**:
   - Run `npm run build` to verify compilation
   - Deploy built files to server
   - Clear browser cache
   - Test in incognito/private mode

3. **Verification**:
   - Test all scenarios from Testing Checklist
   - Monitor browser console for errors
   - Monitor server logs for issues
   - Check uploaded files are saved correctly

## Rollback Plan

If issues occur:

1. **Revert Backend**:
   ```bash
   git checkout backend/web_integration.py
   # Restart backend server
   ```

2. **Revert Frontend**:
   ```bash
   git checkout src/pages/admin/RestManager.tsx
   npm run build
   # Deploy old version
   ```

## Monitoring

### Frontend Logs
- Check browser console for upload errors
- Look for `❌ Photo upload error:` messages
- Monitor `uploadProductPhotos()` function calls

### Backend Logs
- Check for `✅ Photo saved:` messages
- Look for `❌ Error` messages
- Monitor HTTP status codes

### Database
- Verify product photos are updated correctly
- Check `photos.main` and `photos.gallery` fields
- Verify `updated_at` timestamp is set

## Performance Considerations

- **File Size Limit**: 5MB per file (configurable in frontend)
- **Batch Upload**: Multiple files in single request
- **Async Processing**: Non-blocking file operations
- **Caching**: Photos cached with timestamp query parameter

## Security Considerations

- ✅ File type validation (image/* only)
- ✅ File size limits (5MB max)
- ✅ Input validation (product_id, category)
- ✅ Error messages don't expose system paths
- ✅ Files saved to designated directory

## Future Improvements

1. Add image compression before upload
2. Add drag-and-drop file upload
3. Add image preview before upload
4. Add batch upload with retry logic
5. Add progress bar with actual percentage
6. Add image cropping/editing
7. Add EXIF data removal for privacy
8. Add CDN integration for faster delivery

## Support

For issues or questions:
1. Check browser console for error messages
2. Check server logs for backend errors
3. Review Testing Checklist
4. See `PHOTO_UPLOAD_FIX_DETAILED.md` for technical details
