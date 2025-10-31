# 🔧 Push Notification Fix & Testing Guide

## ✅ Issues Fixed

### 1. **Permission Handling Enhanced**
- Added better permission check before showing error
- Clear logging at each step for debugging
- Proper error messages with actual error details
- Handles edge cases where permission prompt is dismissed

### 2. **Subscription Flow Improved**
- Uses `upsert` instead of `insert` to handle duplicates
- Checks for existing subscription before creating new one
- Validates service worker is ready before subscribing
- Sends test notification immediately after enabling

### 3. **Debug Tools Added**
- New `NotificationDebugPanel` component for testing
- "Test" button to manually send notifications
- Full diagnostic information
- Step-by-step troubleshooting guide

---

## 🧪 Testing Instructions

### Step 1: Start Development Server
```bash
npm run dev
```

### Step 2: Open the App
Navigate to: `http://localhost:8080`

### Step 3: Test Notifications

#### Method 1: Using Debug Panel (Easiest)
1. You'll see the **Notification Debug Panel** on the home page
2. Click **"Run Full Diagnostics"** - Check browser console for results
3. Click **"Request Permission"** - Allow when prompted
4. Click **"Send Test Notification"** - You should see a notification!

#### Method 2: Using Toggle Button
1. Find the **"Enable Notifications"** button in your app
2. Click it - Allow permission when prompted
3. If successful, you'll see a test notification immediately
4. Click the **"Test"** button to send another test notification

### Step 4: Check Browser Console
Open Developer Tools (F12) and check the Console tab. You should see:
```
Current notification permission: default (or granted/denied)
Permission result: granted
Waiting for service worker...
Service worker ready: [ServiceWorkerRegistration object]
Creating new subscription...
New subscription created: [PushSubscription object]
Saving subscription for employee: [employee-id]
✅ Subscription saved successfully
Sending test notification...
```

---

## 🔍 Troubleshooting Common Issues

### Issue 1: "Permission Denied" Error

**Symptoms:** Error toast shows "Permission Denied" even after clicking Allow

**Solutions:**

1. **Check if you actually clicked "Allow"**
   - The browser prompt may appear briefly and auto-dismiss
   - Try clicking "Enable Notifications" again

2. **Reset browser permissions:**
   - Chrome/Edge: Click lock icon in address bar → Site Settings → Notifications → Reset
   - Firefox: Click shield icon → Permissions → Clear All
   - Then refresh page and try again

3. **Check browser console:**
   - Look for `Permission result: granted` or `denied`
   - If it shows `default`, permission prompt was dismissed

4. **Use the Debug Panel:**
   - Click "How to Enable in Browser" for specific instructions
   - Follow the steps to manually enable in browser settings

### Issue 2: Notifications Not Appearing

**Symptoms:** Permission granted but no notifications show up

**Solutions:**

1. **Check Notification Permission Status:**
   - Open Debug Panel
   - Look at "Permission" badge - should be green "granted"
   - If red "denied", you need to reset browser permissions

2. **Verify HTTPS/Localhost:**
   - Check "HTTPS/Localhost" badge is green "Secure"
   - Notifications only work on secure connections

3. **Test with Debug Panel:**
   - Click "Send Test Notification"
   - Check browser console for errors
   - Look for system notification area

4. **Check System Settings:**
   - **Windows:** Settings → System → Notifications → Make sure browser is allowed
   - **Mac:** System Preferences → Notifications → Browser → Allow notifications
   - **Linux:** Check notification settings for your desktop environment

### Issue 3: Service Worker Not Ready

**Symptoms:** Console shows "Service worker not ready" errors

**Solutions:**

1. **Unregister and re-register:**
   - Open Console: `navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()))`
   - Refresh page
   - Try enabling notifications again

2. **Check service worker file:**
   - Navigate to: `http://localhost:8080/sw.js`
   - Should show the service worker code, not a 404

3. **Clear browser cache:**
   - Press Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
   - Clear cached files
   - Refresh page

### Issue 4: Duplicate Subscription Errors

**Symptoms:** Console shows database errors about duplicate endpoints

**This is now fixed!** The code uses `upsert` which handles duplicates automatically.

If you still see this:
1. Click "Reset Subscription" in Debug Panel
2. Wait 2 seconds
3. Click "Enable Notifications" again

---

## 📊 What to Check in Console

### ✅ Successful Flow:
```
Current notification permission: default
Permission result: granted
Waiting for service worker...
Service worker ready: ServiceWorkerRegistration {...}
Creating new subscription...
New subscription created: PushSubscription {...}
Saving subscription for employee: abc-123
✅ Subscription saved successfully
Sending test notification...
```

### ❌ Failed Flow Examples:

**Permission Denied:**
```
Current notification permission: denied
Permission result: denied
```
**Solution:** Reset browser permissions manually

**No Service Worker:**
```
Service worker ready: undefined
```
**Solution:** Check `/sw.js` file exists, clear cache, refresh

**Database Error:**
```
Database error: {code: "23503", ...}
```
**Solution:** Make sure you're logged in (employee data in localStorage)

---

## 🎯 Testing Real Notifications

Once basic notifications work, test the full notification system:

### 1. Test Task Assignment
```typescript
// In browser console or via your UI
import { notifyTaskAssigned } from '@/lib/notificationService';

await notifyTaskAssigned(
  "Test Task",
  "employee-id-here",
  "Manager Name"
);
```

### 2. Check Database
Make sure the `push_subscriptions` table has entries:
```sql
SELECT * FROM push_subscriptions WHERE employee_id = 'your-employee-id';
```

### 3. Test from Different User
1. Log in as Admin/Department Head
2. Assign a task to an employee
3. Employee should receive notification immediately

---

## 🔧 Manual Browser Permission Reset

### Chrome/Edge:
1. Click the lock icon (🔒) in address bar
2. Click "Site Settings"
3. Find "Notifications"
4. Change to "Ask" or "Allow"
5. Refresh page

### Firefox:
1. Click the shield icon in address bar
2. Click "Permissions"
3. Find "Receive Notifications"
4. Click "X" to remove block
5. Refresh page

### Safari:
1. Safari menu → Preferences
2. Websites tab
3. Notifications section
4. Find your site and change to "Allow"
5. Refresh page

---

## 🧪 Advanced Testing Commands

### Check Current Status:
```javascript
// In browser console
console.log('Permission:', Notification.permission);
console.log('Service Worker:', 'serviceWorker' in navigator);
console.log('Push Manager:', 'PushManager' in window);

navigator.serviceWorker.ready.then(reg => {
  console.log('Registration:', reg);
  return reg.pushManager.getSubscription();
}).then(sub => {
  console.log('Subscription:', sub);
});
```

### Force Unsubscribe:
```javascript
navigator.serviceWorker.ready.then(reg => {
  return reg.pushManager.getSubscription();
}).then(sub => {
  if (sub) {
    return sub.unsubscribe();
  }
}).then(() => {
  console.log('✅ Unsubscribed');
});
```

### Send Manual Test Notification:
```javascript
navigator.serviceWorker.ready.then(reg => {
  reg.showNotification('Manual Test', {
    body: 'This is a manual test notification',
    icon: '/icons/android-launchericon-192-192.png'
  });
});
```

---

## 📱 Mobile Testing

### Android (Chrome):
1. Connect device via USB
2. Enable USB debugging
3. Chrome DevTools → Remote Devices
4. Test on actual device
5. Check system notification shade

### iOS (Safari):
1. Safari has limited PWA support
2. Add to Home Screen first
3. Notifications only work in standalone mode
4. Test thoroughly on real device

---

## ✅ Success Indicators

You know notifications are working when:
- ✅ Permission badge shows "granted" (green)
- ✅ Test notification appears immediately
- ✅ Browser console shows no errors
- ✅ Database has push_subscriptions entry
- ✅ Real task operations trigger notifications
- ✅ Notification appears in system tray/notification center

---

## 🆘 Still Not Working?

1. **Check this checklist:**
   - [ ] Using HTTPS or localhost?
   - [ ] Browser permissions granted?
   - [ ] Service worker registered?
   - [ ] Console shows no errors?
   - [ ] System notifications enabled?
   - [ ] Browser supports push notifications?

2. **Try different browser:**
   - Chrome (best support)
   - Edge (good support)
   - Firefox (good support)
   - Safari (limited support)

3. **Check Supabase:**
   - Edge function deployed?
   - VAPID keys configured?
   - Database table exists?

4. **Contact support with:**
   - Browser console logs
   - Browser version
   - Operating system
   - Steps you tried
   - Error messages

---

## 📝 Summary of Changes

### Files Modified:
1. `src/hooks/usePushNotifications.ts` - Enhanced error handling and logging
2. `src/components/PushNotificationToggle.tsx` - Added test button
3. `src/components/NotificationDebugPanel.tsx` - NEW debug panel
4. `src/pages/Index.tsx` - Added debug panel to home page

### Key Improvements:
- ✅ Better permission request handling
- ✅ Detailed console logging for debugging
- ✅ Automatic test notification after enabling
- ✅ Upsert instead of insert (handles duplicates)
- ✅ Manual test button in UI
- ✅ Comprehensive debug panel
- ✅ Clear error messages with context

---

**🎉 Your notifications should now work perfectly! If you see the test notification after enabling, the system is working correctly.**
