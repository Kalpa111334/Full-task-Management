# WhatsApp Integration - Quick Testing Guide

## 📱 Quick Start Testing

### 1. Update Employee Phone Numbers

Run these SQL commands in your Supabase SQL Editor or database:

```sql
-- Update phone number for a specific employee (by email)
UPDATE employees 
SET phone = '0771234567'  -- Replace with actual phone number
WHERE email = 'employee@example.com';

-- Update phone number for a department head
UPDATE employees 
SET phone = '0772345678'  -- Replace with actual phone number
WHERE email = 'depthead@example.com';

-- View all employees without phone numbers
SELECT id, name, email, role, phone 
FROM employees 
WHERE phone IS NULL OR phone = '';

-- View all employees with phone numbers
SELECT id, name, email, role, phone 
FROM employees 
WHERE phone IS NOT NULL AND phone != '';
```

---

## 🧪 Test WhatsApp API Directly

### Test Text Message
Open this URL in your browser (replace with your phone number):
```
http://api.geekhirusha.com/emptaskmanagement.php?number=94771234567&type=text&message=Test%20Message%20from%20Task%20Management%20System
```

### Test with PowerShell
```powershell
# Test WhatsApp API
$number = "94771234567"
$message = "Hello from Task Management System"
$url = "http://api.geekhirusha.com/emptaskmanagement.php?number=$number&type=text&message=$message"
Invoke-WebRequest -Uri $url
```

---

## 📋 Test in Application

### Test 1: Admin → Department Head
1. Login as Admin
2. Go to "Task Assignment" tab
3. Assign a task to a department head who has a phone number
4. Check console for logs:
   - `📱 Sending WhatsApp message to: 94XXXXXXXXX`
   - `✅ WhatsApp message sent successfully`
5. Verify department head receives WhatsApp message

### Test 2: Department Head → Employee
1. Login as Department Head
2. Go to "Tasks" tab
3. Click "New Task"
4. Assign task to an employee with a phone number
5. Check console for logs
6. Verify employee receives WhatsApp message

### Test 3: Bulk Assignment
1. Login as Department Head
2. Go to "Bulk Assignment" tab
3. Select multiple employees (with phone numbers)
4. Create and assign a task
5. Check console for multiple WhatsApp sends
6. Verify all employees receive messages

---

## 🔍 Debugging

### Check Console Logs
Open browser DevTools (F12) and look for:

**Success:**
```
📱 Sending WhatsApp message to: 94771234567
✅ WhatsApp message sent successfully: {...}
```

**No Phone Number:**
```
⚠️ No phone number found for employee: abc123-uuid
```

**Invalid Format:**
```
⚠️ Invalid phone number format: 123
```

**API Error:**
```
❌ WhatsApp API error: Network request failed
❌ Failed to send WhatsApp message: {...}
```

### Common Issues

| Issue | Solution |
|-------|----------|
| No WhatsApp received | Check phone number in database |
| Invalid format warning | Ensure phone is 9-10 digits (with/without 0) |
| API error | Test API directly with curl/browser |
| Network error | Check internet connection |
| Console shows warning | Employee missing phone number |

---

## 📞 Phone Number Format Examples

### Valid Formats (All convert to 94XXXXXXXXX)
- `0771234567` ✅ → `94771234567`
- `771234567` ✅ → `94771234567`
- `+94771234567` ✅ → `94771234567`
- `94771234567` ✅ → `94771234567`
- `077-123-4567` ✅ → `94771234567` (removes dashes)

### Invalid Formats
- `123` ❌ (too short)
- `077123456789` ❌ (too long)
- `1234567890` ❌ (wrong country code)
- Empty/null ❌

---

## 📊 Sample Test Data

```sql
-- Insert test employees with phone numbers
INSERT INTO employees (name, email, role, phone, is_active, department_id)
VALUES 
  ('Test Admin', 'testadmin@test.com', 'admin', '0771111111', true, NULL),
  ('Test Dept Head', 'testdept@test.com', 'department_head', '0772222222', true, 'dept-uuid'),
  ('Test Employee 1', 'testemp1@test.com', 'employee', '0773333333', true, 'dept-uuid'),
  ('Test Employee 2', 'testemp2@test.com', 'employee', '0774444444', true, 'dept-uuid');
```

---

## ✅ Verification Checklist

- [ ] Phone column exists in employees table
- [ ] Sample employees have phone numbers
- [ ] WhatsApp API responds to direct test
- [ ] Admin can assign task to dept head
- [ ] Department head receives WhatsApp
- [ ] Dept head can assign task to employee
- [ ] Employee receives WhatsApp
- [ ] Bulk assignment sends multiple messages
- [ ] Console logs show success messages
- [ ] Messages have correct format and content

---

## 🔧 Quick Fix Commands

### Reset Phone Numbers
```sql
-- Clear all phone numbers (for testing)
UPDATE employees SET phone = NULL;

-- Add test phone numbers to first 3 employees
UPDATE employees 
SET phone = CASE 
  WHEN role = 'admin' THEN '0771111111'
  WHEN role = 'department_head' THEN '0772222222'
  WHEN role = 'employee' THEN '0773333333'
END
WHERE id IN (SELECT id FROM employees LIMIT 3);
```

### Check WhatsApp Service Status
```javascript
// Run in browser console on the app
import { notifyEmployeeTaskAssigned } from '@/lib/whatsappService';

// Test notification
await notifyEmployeeTaskAssigned(
  'Test Task',
  'employee-uuid-here',
  'Test Manager',
  null,
  'medium'
);
```

---

## 📈 Monitoring

### Track Notification Success Rate
```sql
-- Create a simple log table (optional)
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id),
  phone TEXT,
  message TEXT,
  success BOOLEAN,
  sent_at TIMESTAMP DEFAULT NOW()
);

-- Add logging to whatsappService.ts
-- Insert log after sendWhatsAppMessage call
```

---

## 🎯 Production Readiness

Before going live:

1. ✅ Test with multiple phone numbers
2. ✅ Verify all employees have phone numbers
3. ✅ Test network failures (disconnect internet)
4. ✅ Test invalid phone numbers
5. ✅ Confirm message formatting looks good
6. ✅ Check API rate limits (if any)
7. ✅ Review console for any errors
8. ✅ Test bulk assignment with 10+ employees

---

## 📞 Support

If you encounter issues:

1. Check this testing guide first
2. Review console logs in browser DevTools
3. Test WhatsApp API directly
4. Verify database phone numbers
5. Check network connectivity

---

**Happy Testing! 🚀**
