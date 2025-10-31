# PWA Configuration for Task Vision

## Overview
Task Vision is now a Progressive Web App (PWA) with full offline support, installability, and native-like experience across all platforms.

## Features Implemented

### 1. **App Manifest** (`/public/manifest.json`)
- Complete app metadata
- Multiple icon sizes for all platforms (Android, iOS, Windows)
- Standalone display mode for native app experience
- Custom theme colors (#2563eb)
- App shortcuts for quick access to key features

### 2. **Service Worker** (`/public/sw.js`)
- Offline-first caching strategy
- Network-first approach with cache fallback
- Push notification support
- Background sync capability
- Automatic cache management and cleanup

### 3. **Icons**
All icons are located in `/public/icons/`:
- **Android**: 48x48, 72x72, 96x96, 144x144, 192x192, 512x512
- **iOS**: Multiple sizes from 16x16 to 1024x1024
- **Windows**: Tile icons and splash screens
- Purpose: Both standard and maskable icons

### 4. **PWA Install Prompt**
- Custom install button component (`PWAInstallPrompt.tsx`)
- Automatic detection of installation capability
- User-friendly installation flow
- Installation status tracking

### 5. **Offline Support**
- Custom offline page (`/public/offline.html`)
- Cached assets for offline browsing
- Network-first with cache fallback strategy
- Graceful degradation

### 6. **Platform-Specific Features**

#### iOS
- Apple touch icons
- Apple splash screens
- Status bar styling
- Web app capability tags

#### Android
- Maskable icons
- Theme color
- Orientation preferences
- Full-screen support

#### Windows
- Browser config XML
- Tile icons
- Tile colors
- Edge side panel support

## Installation

### For End Users

#### Desktop (Chrome, Edge, Opera)
1. Visit the website
2. Look for the install icon in the address bar (⊕ or 🔽)
3. Click "Install" or use the in-app "Install App" button

#### Mobile (Android)
1. Open in Chrome or Samsung Internet
2. Tap the menu (⋮)
3. Select "Add to Home Screen" or "Install App"

#### Mobile (iOS/Safari)
1. Open in Safari
2. Tap the Share button (□↑)
3. Scroll down and tap "Add to Home Screen"

### For Developers

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Preview with PWA features:**
   ```bash
   npm run preview
   ```

3. **Test PWA locally:**
   - Open Chrome DevTools
   - Go to Application > Service Workers
   - Go to Application > Manifest
   - Use Lighthouse to audit PWA score

## Testing PWA Features

### Chrome DevTools
1. Open DevTools (F12)
2. Go to **Application** tab
3. Check:
   - Service Workers: Should show registered and activated
   - Manifest: Should show all icon sizes and metadata
   - Cache Storage: Should show cached resources

### Lighthouse Audit
1. Open DevTools (F12)
2. Go to **Lighthouse** tab
3. Select "Progressive Web App" category
4. Run audit
5. Target score: 90+ (ideally 100)

## Key PWA Criteria Met

- ✅ Served over HTTPS (required for production)
- ✅ Responsive design (viewport meta tag)
- ✅ Service worker registered
- ✅ Web app manifest present
- ✅ Icons for all platforms
- ✅ Offline functionality
- ✅ Fast load times
- ✅ Installable
- ✅ Works standalone
- ✅ Theme color configured
- ✅ Push notifications ready

## Files Added/Modified

### New Files:
- `/public/manifest.json` - App manifest
- `/public/browserconfig.xml` - Windows configuration
- `/public/offline.html` - Offline fallback page
- `/public/icons/*` - All platform icons
- `/src/components/PWAInstallPrompt.tsx` - Install button component
- `/PWA_README.md` - This file

### Modified Files:
- `/index.html` - Added PWA meta tags and manifest link
- `/src/main.tsx` - Enhanced service worker registration with install prompt
- `/public/sw.js` - Enhanced with caching strategies
- `/vite.config.ts` - Added vite-plugin-pwa
- `/public/robots.txt` - Added sitemap reference

## Caching Strategy

### Cache First (App Shell)
- HTML files
- CSS files
- JavaScript bundles
- Icons and images

### Network First (API Calls)
- Supabase API calls
- Google Maps API
- External resources

### Stale While Revalidate
- Google APIs
- Fonts
- Non-critical resources

## Browser Support

- ✅ Chrome/Edge (Desktop & Mobile)
- ✅ Firefox (Desktop & Mobile)
- ✅ Safari (Desktop & Mobile)
- ✅ Opera
- ✅ Samsung Internet

## Troubleshooting

### Service Worker not registering
- Check browser console for errors
- Ensure served over HTTPS (or localhost)
- Clear browser cache and reload

### Icons not showing
- Verify icons exist in `/public/icons/`
- Check manifest.json paths
- Clear cache and reinstall

### Install prompt not appearing
- PWA criteria must be met
- User must have visited the site at least twice
- Chrome: Check chrome://flags for PWA settings

### Cache not working
- Check Service Worker status in DevTools
- Verify cache names in sw.js
- Force update the service worker

## Performance Optimizations

1. **Code Splitting**: Vite automatically splits code
2. **Asset Optimization**: Icons optimized for web
3. **Lazy Loading**: Components loaded on demand
4. **Service Worker**: Caches critical assets
5. **Compression**: Gzip/Brotli enabled (production)

## Security Considerations

- All service worker communications over HTTPS
- Content Security Policy headers recommended
- Secure push notification endpoints
- Regular security audits

## Future Enhancements

- [ ] Background sync for offline task submissions
- [ ] Periodic background sync for updates
- [ ] Web Share API integration
- [ ] File System Access API for exports
- [ ] Badging API for notifications count
- [ ] App shortcuts for quick actions

## Resources

- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Builder](https://www.pwabuilder.com/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)

## Support

For issues or questions related to PWA features:
1. Check browser console for errors
2. Run Lighthouse audit
3. Verify Service Worker registration
4. Clear cache and test again
