# WhatsApp Integration Guide 📱

## Overview

This application now features **real-time WhatsApp notifications** for task assignments using the GeeKHirusha API. This ensures that both department heads and employees receive instant notifications on WhatsApp when tasks are assigned to them.

---

## 🎯 Features Implemented

### 1. Admin → Department Head Notifications
When an admin assigns a task to a department head:
- ✅ **Push notification** sent via PWA
- ✅ **WhatsApp message** sent to department head's phone
- 📋 Message includes task title and assigner name

### 2. Department Head → Employee Notifications
When a department head assigns a task to an employee:
- ✅ **Push notification** sent via PWA
- ✅ **WhatsApp message** sent to employee's phone
- 📋 Message includes task details, priority, and deadline

### 3. Bulk Task Assignment Notifications
When assigning tasks to multiple employees:
- ✅ **Push notifications** sent to all employees
- ✅ **WhatsApp messages** sent to all employees simultaneously
- 📋 Messages personalized for each employee

---

## 🔧 API Configuration

### WhatsApp API Details
- **Base URL**: `https://api.geekhirusha.com/emptaskmanagement.php`
- **Method**: GET
- **Required Parameters**:
  - `number`: Recipient's phone number (format: 94XXXXXXXXX)
  - `type`: Message type (text, image, video, audio, pdf)
- **Optional Parameters**:
  - `message`: Text content or caption
  - `mediaUrl`: Public URL for media files

### Phone Number Format
- Phone numbers are automatically formatted to Sri Lankan format (94XXXXXXXXX)
- Handles various input formats:
  - `0771234567` → `94771234567`
  - `771234567` → `94771234567`
  - `+94771234567` → `94771234567`

---

## 📝 Implementation Details

### Files Modified/Created

1. **`src/lib/whatsappService.ts`** (NEW)
   - Core WhatsApp notification service
   - Functions for sending messages
   - Phone number formatting and validation
   - Employee phone lookup

2. **`src/components/admin/AdminTaskAssignment.tsx`** (MODIFIED)
   - Added WhatsApp notification on task assignment
   - Notifies department heads when tasks are assigned

3. **`src/components/department/TaskAssignment.tsx`** (MODIFIED)
   - Added WhatsApp notification for employee task assignments
   - Includes priority and deadline information

4. **`src/components/department/BulkTaskAssignment.tsx`** (MODIFIED)
   - Added bulk WhatsApp notifications
   - Sends messages to multiple employees simultaneously

---

## 📱 Message Templates

### Department Head Task Assignment
```
🎯 *New Task Assigned*

Hello! You have been assigned a new task by *[Admin Name]*.

📋 *Task:* [Task Title]

Please check your dashboard for details and assign it to your team members.

_Task Management System_
```

### Employee Task Assignment
```
✅ *Task Assigned*

Hello! You have been assigned a new task by *[Department Head Name]*.

📋 *Task:* [Task Title]
🟡 *Priority:* MEDIUM
⏰ *Deadline:* Dec 15, 2025, 5:00 PM

Please check your dashboard to view details and start working on the task.

_Task Management System_
```

### Bulk Task Assignment
```
✅ *Task Assigned*

Hello! You have been assigned a new task by *[Department Head Name]*.

📋 *Task:* [Task Title]

Please check your dashboard to view details and start working.

_Task Management System_
```

---

## 🔍 How It Works

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN ASSIGNS TASK                       │
│                             ↓                                │
│                  Task Created in Database                    │
│                             ↓                                │
│              ┌──────────────┴──────────────┐                │
│              ↓                              ↓                │
│    Push Notification Sent        WhatsApp API Called        │
│   (via Supabase Function)    (via whatsappService.ts)       │
│              ↓                              ↓                │
│    Department Head receives         Fetch employee phone    │
│    PWA notification                 from database           │
│                                             ↓                │
│                              Format phone number (94XXX)    │
│                                             ↓                │
│                              Send GET request to API        │
│                                             ↓                │
│                       Department Head receives WhatsApp     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              DEPARTMENT HEAD ASSIGNS TASK                    │
│                             ↓                                │
│                  Task Created in Database                    │
│                             ↓                                │
│              ┌──────────────┴──────────────┐                │
│              ↓                              ↓                │
│    Push Notification Sent        WhatsApp API Called        │
│   (via Supabase Function)    (with task details)            │
│              ↓                              ↓                │
│    Employee receives                Fetch employee phone    │
│    PWA notification                        ↓                │
│                              Include priority & deadline    │
│                                             ↓                │
│                              Send formatted message         │
│                                             ↓                │
│                       Employee receives WhatsApp            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Usage Examples

### Sending a Task Assignment Notification (Admin → Dept Head)
```typescript
import { notifyDeptHeadTaskAssigned } from '@/lib/whatsappService';

// After creating task in database
await notifyDeptHeadTaskAssigned(
  taskTitle,           // "Install new software"
  deptHeadId,         // UUID from database
  adminName           // "John Admin"
);
```

### Sending a Task Assignment Notification (Dept Head → Employee)
```typescript
import { notifyEmployeeTaskAssigned } from '@/lib/whatsappService';

await notifyEmployeeTaskAssigned(
  taskTitle,           // "Fix printer issue"
  employeeId,         // UUID from database
  deptHeadName,       // "Sarah Manager"
  deadline,           // "2025-12-15T17:00:00Z"
  priority            // "high"
);
```

### Sending Bulk Notifications
```typescript
import { notifyBulkEmployeeTasksAssigned } from '@/lib/whatsappService';

await notifyBulkEmployeeTasksAssigned(
  taskTitle,           // "Weekly team meeting"
  employeeIds,        // ["uuid1", "uuid2", "uuid3"]
  deptHeadName,       // "Sarah Manager"
  1                   // number of tasks
);
```

---

## ⚙️ Configuration Requirements

### Database Schema
Ensure the `employees` table has a `phone` column:
```sql
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone TEXT;
```

### Employee Phone Numbers
- Phone numbers must be stored in the `employees` table
- Update phone numbers via admin panel or database directly
- Example: `UPDATE employees SET phone = '0771234567' WHERE id = 'xxx';`

---

## 🛠️ Testing

### Test WhatsApp API Directly
```bash
curl "https://api.geekhirusha.com/emptaskmanagement.php?number=94771234567&type=text&message=Hello%20Test"
```

### Test via Application
1. Ensure employee has a valid phone number in database
2. Assign a task to the employee
3. Check console logs for API calls
4. Verify WhatsApp message received

### Console Logs
The service provides detailed logging:
- `📱 Sending WhatsApp message to: 94XXXXXXXXX`
- `✅ WhatsApp message sent successfully`
- `❌ WhatsApp API error: [error details]`
- `⚠️ No phone number found for employee: [id]`
- `⚠️ Invalid phone number format: [number]`

---

## 🔐 Security Considerations

1. **API Endpoint**: Currently using HTTP (not HTTPS)
   - Consider using HTTPS in production for security
   
2. **Phone Number Privacy**: 
   - Phone numbers are stored in database
   - Ensure proper access controls are in place

3. **Rate Limiting**:
   - API may have rate limits
   - Bulk operations send messages in parallel using `Promise.allSettled`

---

## 📊 Error Handling

The service gracefully handles various error scenarios:

1. **Missing Phone Number**: Logs warning, continues execution
2. **Invalid Phone Format**: Logs warning, skips notification
3. **API Failure**: Logs error, returns false
4. **Database Errors**: Logs error, returns null

All errors are non-blocking to ensure the main task assignment flow continues even if WhatsApp notifications fail.

---

## 🔮 Future Enhancements

- [ ] Add media support (images, videos, PDFs)
- [ ] Send task completion notifications via WhatsApp
- [ ] Add WhatsApp notification preferences in user settings
- [ ] Support for message templates with dynamic content
- [ ] Add delivery status tracking
- [ ] Support for WhatsApp Business API features
- [ ] Add notification history/audit log

---

## 📞 Support

For issues or questions:
- Check console logs for error messages
- Verify phone numbers are correctly formatted in database
- Test API endpoint directly first
- Ensure employees have phone numbers in the system

---

## 🎉 Benefits

✅ **Real-time notifications** - Instant alerts on WhatsApp
✅ **High delivery rate** - WhatsApp has better open rates than email
✅ **User-friendly** - Everyone uses WhatsApp
✅ **Dual notifications** - PWA + WhatsApp for redundancy
✅ **Detailed information** - Priority, deadline, and task details included
✅ **Scalable** - Handles bulk assignments efficiently

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Status**: ✅ Production Ready
