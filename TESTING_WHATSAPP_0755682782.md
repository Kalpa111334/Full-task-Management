# 🧪 WhatsApp Testing Guide - Phone: 0755682782

## ✅ Changes Applied

1. ✅ Enhanced logging in `whatsappService.ts`
2. ✅ Created test page at `/test-whatsapp.html`
3. ✅ Added SQL script to update phone number
4. ✅ Better error messages

---

## 🔧 Step 1: Add Phone Number to Database

### Option A: Via Supabase SQL Editor

1. Go to Supabase Dashboard → SQL Editor
2. Run this query (replace email with your actual email):

```sql
UPDATE employees 
SET phone = '0755682782'
WHERE email = 'your-email@example.com';
```

3. Verify it was added:

```sql
SELECT id, name, email, role, phone
FROM employees
WHERE phone = '0755682782';
```

### Option B: Via Supabase Table Editor

1. Go to Supabase Dashboard → Table Editor
2. Select `employees` table
3. Find your employee record
4. Click on the `phone` column
5. Enter: `0755682782`
6. Save

---

## 🧪 Step 2: Test the WhatsApp Service

### Method 1: Test Page (Easiest)

1. Start your development server:
```bash
npm run dev
```

2. Open in browser:
```
http://localhost:8080/test-whatsapp.html
```

3. Tests available:
   - **Test 1**: Direct API (for localhost only)
   - **Test 2**: Serverless function (works on Vercel)
   - **Test 3**: Phone formatting

4. Click "Test Serverless" button

5. Check your WhatsApp at **0755682782** for the message!

### Method 2: Via Task Assignment

1. Login to the app: `http://localhost:8080`

2. **If testing Admin → Dept Head:**
   - Make sure department head has phone `0755682782`
   - Go to Admin → Task Assignment
   - Create and assign task to dept head
   - Check WhatsApp

3. **If testing Dept Head → Employee:**
   - Make sure employee has phone `0755682782`
   - Go to Department Head → Tasks
   - Create and assign task to employee
   - Check WhatsApp

### Method 3: Browser Console Test

1. Open browser console (F12)
2. Paste this code:

```javascript
// Test phone formatting
function formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '94' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('94')) {
        cleaned = '94' + cleaned;
    }
    return cleaned;
}

console.log('Testing phone: 0755682782');
console.log('Formatted:', formatPhoneNumber('0755682782'));
// Should output: 94755681782

// Test serverless function
fetch('/api/send-whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        number: '0755682782',
        type: 'text',
        message: 'Test from Browser Console - Task Management System'
    })
})
.then(r => r.json())
.then(d => console.log('Result:', d))
.catch(e => console.error('Error:', e));
```

---

## 📊 Expected Console Logs

When assigning a task, you should see these logs in the browser console:

```
🔍 Fetching phone for employee: [employee-id]
📞 Raw phone from database: 0755682782
📱 Formatted phone: 94755681782
✅ Phone found, sending WhatsApp to: 94755681782
📱 Sending WhatsApp message to: 94755681782
✅ WhatsApp message sent successfully
📱 WhatsApp notification result: ✅ Sent
```

### If Phone Not Found:

```
🔍 Fetching phone for employee: [employee-id]
❌ No employee data found for ID: [employee-id]
⚠️ No phone number found for employee: [employee-id]
⚠️ Make sure phone number is added to database
```

**Solution**: Add phone to database using Step 1.

### If Phone Empty:

```
🔍 Fetching phone for employee: [employee-id]
📞 Raw phone from database: null
⚠️ Phone field is empty for employee: [employee-id]
⚠️ No phone number found for employee: [employee-id]
```

**Solution**: Update phone field in database.

---

## 🔍 Debug Checklist

If WhatsApp not received, check:

### 1. Database Check
```sql
-- Check if phone exists
SELECT id, name, email, role, phone, is_active
FROM employees
WHERE phone = '0755682782' OR phone LIKE '%755682782%';

-- If empty, add it
UPDATE employees 
SET phone = '0755682782'
WHERE email = 'your@email.com';
```

### 2. Console Logs
- Open browser DevTools (F12) → Console
- Look for the log messages above
- Check if phone was fetched correctly
- Check if formatted to `94755681782`

### 3. Network Tab
- Open DevTools (F12) → Network tab
- Filter: `send-whatsapp`
- Assign a task
- Check if request was made
- Check response status (should be 200)
- Check response body (should have `success: true`)

### 4. Serverless Function (On Vercel)
```bash
# View Vercel logs
vercel logs --follow

# Should show:
# 📱 [Server] Sending WhatsApp to: 94755681782
# ✅ [Server] WhatsApp sent successfully
```

---

## 🧪 Quick Tests

### Test 1: Format Phone Number
```javascript
// Should convert to 94755681782
formatPhoneNumber('0755682782')   // → 94755681782
formatPhoneNumber('755682782')    // → 94755681782
formatPhoneNumber('94755681782')  // → 94755681782
```

### Test 2: Direct API (localhost only)
```bash
# PowerShell
Invoke-WebRequest -Uri "https://api.geekhirusha.com/emptaskmanagement.php?number=94755681782&type=text&message=Test"

# Or open in browser:
# https://api.geekhirusha.com/emptaskmanagement.php?number=94755681782&type=text&message=Test
```

### Test 3: Serverless Function
```bash
# Using curl
curl -X POST http://localhost:8080/api/send-whatsapp \
  -H "Content-Type: application/json" \
  -d '{"number":"0755682782","type":"text","message":"Test"}'

# Or using PowerShell
$body = @{
    number = "0755682782"
    type = "text"
    message = "Test from PowerShell"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/send-whatsapp" `
  -Method POST `
  -Body $body `
  -ContentType "application/json"
```

---

## 📱 Expected WhatsApp Messages

### Department Head Receives:
```
🎯 *New Task Assigned*

Hello! You have been assigned a new task by *Admin Name*.

📋 *Task:* [Task Title]

Please check your dashboard for details and assign it to your team members.

_Task Management System_
```

### Employee Receives:
```
✅ *Task Assigned*

Hello! You have been assigned a new task by *Dept Head Name*.

📋 *Task:* [Task Title]
🟡 *Priority:* MEDIUM
⏰ *Deadline:* Nov 5, 2025, 5:00 PM

Please check your dashboard to view details and start working on the task.

_Task Management System_
```

---

## ✅ Success Indicators

### In Browser Console:
- ✅ `📱 Formatted phone: 94755681782`
- ✅ `✅ WhatsApp message sent successfully`
- ✅ `📱 WhatsApp notification result: ✅ Sent`

### In Network Tab:
- ✅ POST to `/api/send-whatsapp`
- ✅ Status: 200
- ✅ Response: `{"success": true, ...}`

### On Phone:
- ✅ WhatsApp message received at 0755682782

---

## 🚀 Deploy to Vercel

Once tested locally:

```bash
git add .
git commit -m "Enhanced WhatsApp logging and testing"
git push origin main
```

Then test on Vercel:
```bash
# View logs
vercel logs --follow

# Test endpoint
curl -X POST https://your-app.vercel.app/api/send-whatsapp \
  -H "Content-Type: application/json" \
  -d '{"number":"0755682782","type":"text","message":"Test from Vercel"}'
```

---

## 📞 Support

If still not working:

1. **Check Database**: Phone = `0755682782` ✅
2. **Check Console**: Logs show phone fetched ✅
3. **Check Network**: API called successfully ✅
4. **Check Phone**: Correct number 0755682782 ✅
5. **Check Vercel Logs**: If deployed ✅

---

**Test Phone**: 0755682782  
**Formatted**: 94755681782  
**Status**: Ready for testing! 🎉
