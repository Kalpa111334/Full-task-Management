# 🔔 Push Notification Quick Reference

## Import the Service

```typescript
import { 
  notifyTaskAssigned,
  notifyTaskCompleted,
  notifyTaskApproved,
  // ... import what you need
} from '@/lib/notificationService';
```

## Common Patterns

### 1. Task Assignment
```typescript
// Get assigner name
const { data: assignerData } = await supabase
  .from("employees")
  .select("name")
  .eq("id", assignerId)
  .single();

await notifyTaskAssigned(
  taskTitle,
  assignedToEmployeeId,
  assignerData?.name || "Manager"
);
```

### 2. Task Completion
```typescript
// Get employee name
const { data: employeeData } = await supabase
  .from("employees")
  .select("name")
  .eq("id", employeeId)
  .single();

// Notify department head and admins
const approverIds = [departmentHeadId, ...adminIds];

await notifyTaskCompleted(
  taskTitle,
  employeeData?.name || "Employee",
  approverIds
);
```

### 3. Task Status Change
```typescript
// On task activation
await notifyTaskActivated(taskTitle, employeeId);

// On task deactivation
await notifyTaskDeactivated(taskTitle, employeeId);

// On task deletion
await notifyTaskDeleted(taskTitle, employeeId);
```

### 4. Approval/Rejection
```typescript
// On approval
await notifyTaskApproved(
  taskTitle,
  approverName,
  employeeId
);

// On rejection with reason
await notifyTaskRejected(
  taskTitle,
  approverName,
  employeeId,
  rejectionReason // optional
);
```

### 5. Bulk Operations
```typescript
const employeeIds = ['id1', 'id2', 'id3'];

await notifyBulkTasksAssigned(
  taskCount,
  employeeIds,
  assignerName
);
```

### 6. Emergency Alerts
```typescript
// Get all active employees
const { data: employees } = await supabase
  .from('employees')
  .select('id')
  .eq('is_active', true);

const employeeIds = employees?.map(e => e.id) || [];

await notifyEmergencyAlert(
  "Emergency message here",
  employeeIds
);
```

## Available Notification Functions

### Task Operations
- `notifyTaskAssigned(taskTitle, employeeId, assignerName)`
- `notifyBulkTasksAssigned(count, employeeIds, assignerName)`
- `notifyTaskStarted(taskTitle, employeeName, supervisorId)`
- `notifyTaskCompleted(taskTitle, employeeName, approverIds)`
- `notifyTaskApproved(taskTitle, approverName, employeeId)`
- `notifyTaskRejected(taskTitle, approverName, employeeId, reason?)`
- `notifyTaskUpdated(taskTitle, employeeId, updaterName, changes)`
- `notifyTaskActivated(taskTitle, employeeId)`
- `notifyTaskDeactivated(taskTitle, employeeId)`
- `notifyTaskDeleted(taskTitle, employeeId)`

### Verification
- `notifyTaskVerificationRequest(taskTitle, deptHeadName, adminIds)`
- `notifyTaskVerificationApproved(taskTitle, employeeId, deptHeadId)`
- `notifyTaskVerificationRejected(taskTitle, deptHeadId, adminName)`

### Deadlines
- `notifyTaskDeadlineApproaching(taskTitle, employeeId, hoursRemaining)`
- `notifyTaskOverdue(taskTitle, employeeId)`

### Employee Management
- `notifyEmployeeAdded(employeeName, departmentName, employeeId)`
- `notifyEmployeeRoleChanged(employeeName, newRole, employeeId)`
- `notifyEmployeeDepartmentChanged(employeeName, newDept, employeeId)`
- `notifyEmployeeDeactivated(employeeId)`

### Department
- `notifyDepartmentHeadAssigned(departmentName, employeeId)`
- `notifyNewEmployeeInDepartment(newEmployeeName, deptHeadId)`

### Device Control
- `notifyDeviceControlTaskCreated(deviceType, action, employeeIds)`

### System
- `notifyLocationTrackingEnabled(employeeId)`
- `notifyLowBattery(employeeId, batteryLevel)`
- `notifyReportGenerated(reportType, employeeIds)`
- `notifyEmergencyAlert(message, allEmployeeIds)`
- `notifySystemMaintenance(scheduledTime, allEmployeeIds)`
- `notifyBulkOperation(operation, count, employeeIds)`

## Error Handling

All notification functions return a boolean:
```typescript
const success = await notifyTaskAssigned(...);
if (!success) {
  console.warn('Notification failed, but operation succeeded');
}
```

Notifications fail silently to not disrupt main operations.

## Best Practices

1. ✅ **Always get user names** for personalized notifications
2. ✅ **Use try-catch** if critical (though functions handle errors)
3. ✅ **Notify all stakeholders** (employee, supervisor, admin as needed)
4. ✅ **Include context** (task title, reason, changes)
5. ✅ **Test notifications** in development
6. ❌ **Don't block** main operations waiting for notifications
7. ❌ **Don't send** duplicate notifications

## Testing

```typescript
// Test in browser console
import { notifyTaskAssigned } from '@/lib/notificationService';

// Replace with real IDs from your database
await notifyTaskAssigned(
  "Test Task",
  "your-employee-id",
  "Test Manager"
);
```

## Check Notification Permission

```typescript
if (Notification.permission === 'granted') {
  // Send notification
} else if (Notification.permission === 'default') {
  // Request permission
  await Notification.requestPermission();
}
```

## Troubleshooting

**Issue**: Notifications not sending
- Check service worker is registered
- Verify notification permission granted
- Check browser console for errors
- Test with manual notification first

**Issue**: No one receiving notifications
- Check Supabase edge function is deployed
- Verify VAPID keys are configured
- Check push_subscriptions table has entries

**Issue**: Some users not receiving
- Verify they have subscribed to push
- Check they haven't denied permission
- Verify their subscription is in database

---

**💡 Tip**: Keep `NOTIFICATION_SYSTEM.md` for complete documentation!
