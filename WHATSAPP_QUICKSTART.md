# 📱 WhatsApp Integration - Quick Reference Card

## 🚀 INSTANT START GUIDE

### 1️⃣ Add Phone Numbers (2 minutes)
```sql
-- Run in Supabase SQL Editor
UPDATE employees 
SET phone = '0771234567'  -- ← Your phone number
WHERE email = 'your@email.com';
```

### 2️⃣ Test Assignment (30 seconds)
1. Login to app
2. Assign a task
3. Check WhatsApp! 📱

---

## 📋 Quick Test Commands

### Test WhatsApp API
```bash
# Open in browser:
http://api.geekhirusha.com/emptaskmanagement.php?number=94771234567&type=text&message=Hello

# PowerShell:
Invoke-WebRequest -Uri "http://api.geekhirusha.com/emptaskmanagement.php?number=94771234567&type=text&message=Test"
```

### Check Who Has Phone Numbers
```sql
SELECT name, email, role, phone 
FROM employees 
WHERE phone IS NOT NULL;
```

### Add Test Phone Numbers
```sql
-- Add your phone to test accounts
UPDATE employees SET phone = '0771111111' WHERE role = 'admin' LIMIT 1;
UPDATE employees SET phone = '0772222222' WHERE role = 'department_head' LIMIT 1;
UPDATE employees SET phone = '0773333333' WHERE role = 'employee' LIMIT 1;
```

---

## 🎯 What Gets Notified

| Action | Who Gets WhatsApp | What's Included |
|--------|-------------------|-----------------|
| Admin assigns to Dept Head | Dept Head | 🎯 Task title + Admin name |
| Dept Head assigns to Employee | Employee | ✅ Task + Priority + Deadline |
| Bulk assignment | All selected employees | 📋 Task details |
| Device control task | All selected employees | 📱 Task details |

---

## 📊 Console Messages

| Icon | Meaning | Action Needed |
|------|---------|---------------|
| 📱 | Sending message | Wait for result |
| ✅ | Success! | None - all good |
| ⚠️ | No phone number | Add phone to database |
| ❌ | API error | Check API/internet |

---

## 🔧 Common Issues

### No WhatsApp Received?
```sql
-- Check phone exists
SELECT phone FROM employees WHERE id = 'employee-id-here';

-- Add phone if missing
UPDATE employees SET phone = '0771234567' WHERE id = 'employee-id-here';
```

### API Not Working?
```bash
# Test directly:
curl "http://api.geekhirusha.com/emptaskmanagement.php?number=94771234567&type=text&message=Test"
```

### Invalid Format Warning?
- Phone must be 9-10 digits
- Examples: `0771234567`, `771234567`, `+94771234567`
- Auto-converts to: `94771234567`

---

## 📱 Message Format Examples

### To Department Head:
```
🎯 *New Task Assigned*

Hello! You have been assigned a new task 
by *John Admin*.

📋 *Task:* Install new software

Please check your dashboard...
```

### To Employee:
```
✅ *Task Assigned*

Hello! You have been assigned a new task 
by *Sarah Manager*.

📋 *Task:* Fix printer
🟠 *Priority:* HIGH
⏰ *Deadline:* Dec 15, 2025, 5:00 PM

Please check your dashboard...
```

---

## ✅ 30-Second Test

1. **Add your phone:**
   ```sql
   UPDATE employees SET phone = '077XXXXXXX' WHERE email = 'you@email.com';
   ```

2. **Assign a task:**
   - Login → Tasks → Create & Assign

3. **Check console (F12):**
   - Look for: `📱 Sending WhatsApp...`
   - Then: `✅ WhatsApp message sent successfully`

4. **Check your phone:**
   - WhatsApp message should arrive instantly!

---

## 📞 Support Checklist

Before asking for help:
- [ ] Phone number in database? (`SELECT phone FROM employees WHERE ...`)
- [ ] Correct format? (9-10 digits)
- [ ] Console logs? (F12 → Console)
- [ ] API test? (curl/browser)
- [ ] Internet working?

---

## 🎯 Production Deploy Checklist

- [ ] Migration applied (`20250101000000_add_whatsapp_phone_support.sql`)
- [ ] All employees have phone numbers
- [ ] Tested admin → dept head assignment
- [ ] Tested dept head → employee assignment
- [ ] Tested bulk assignment
- [ ] Console logs clean (no errors)
- [ ] WhatsApp messages received correctly
- [ ] Message format looks good

---

## 📚 Full Documentation

- `WHATSAPP_INTEGRATION.md` - Complete guide
- `WHATSAPP_TESTING.md` - Testing procedures
- `WHATSAPP_SUMMARY.md` - Implementation summary

---

## 🚀 You're Ready!

**That's it!** Add phone numbers and start receiving real-time WhatsApp notifications! 🎉

**Questions?** Check the full documentation files above.

---

**Quick Links:**
- API: `http://api.geekhirusha.com/emptaskmanagement.php`
- Service: `src/lib/whatsappService.ts`
- Migration: `supabase/migrations/20250101000000_add_whatsapp_phone_support.sql`
