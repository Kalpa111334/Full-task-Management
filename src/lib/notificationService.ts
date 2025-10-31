import { supabase } from '@/integrations/supabase/client';

/**
 * Notification Service for sending push notifications across the application
 * Handles all notification events for tasks, approvals, assignments, etc.
 */

export interface NotificationPayload {
  title: string;
  body: string;
  employeeIds: string[];
  data?: {
    taskId?: string;
    action?: string;
    url?: string;
    [key: string]: any;
  };
  actions?: Array<{
    action: string;
    title: string;
  }>;
}

/**
 * Send push notification via Supabase Edge Function
 */
export const sendPushNotification = async (payload: NotificationPayload): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: payload
    });

    if (error) {
      console.error('❌ Failed to send push notification:', error);
      return false;
    }

    console.log('✅ Push notification sent successfully:', data);
    return true;
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return false;
  }
};

/**
 * Notification Templates for different events
 */

// Task Assignment Notifications
export const notifyTaskAssigned = async (taskTitle: string, assignedToId: string, assignedByName: string) => {
  return sendPushNotification({
    title: '📋 New Task Assigned',
    body: `${assignedByName} assigned you: "${taskTitle}"`,
    employeeIds: [assignedToId],
    data: {
      action: 'task_assigned',
      url: '/employee'
    },
    actions: [
      { action: 'view', title: 'View Task' },
      { action: 'dismiss', title: 'Later' }
    ]
  });
};

export const notifyBulkTasksAssigned = async (taskCount: number, assignedToIds: string[], assignedByName: string) => {
  return sendPushNotification({
    title: '📋 Multiple Tasks Assigned',
    body: `${assignedByName} assigned you ${taskCount} new tasks`,
    employeeIds: assignedToIds,
    data: {
      action: 'bulk_tasks_assigned',
      url: '/employee'
    }
  });
};

// Task Status Change Notifications
export const notifyTaskStarted = async (taskTitle: string, employeeName: string, supervisorId: string) => {
  return sendPushNotification({
    title: '▶️ Task Started',
    body: `${employeeName} started: "${taskTitle}"`,
    employeeIds: [supervisorId],
    data: {
      action: 'task_started',
      url: '/department'
    }
  });
};

export const notifyTaskCompleted = async (taskTitle: string, employeeName: string, approverIds: string[]) => {
  return sendPushNotification({
    title: '✅ Task Completed',
    body: `${employeeName} completed: "${taskTitle}" - Pending approval`,
    employeeIds: approverIds,
    data: {
      action: 'task_completed',
      url: '/department'
    },
    actions: [
      { action: 'approve', title: 'Review' },
      { action: 'dismiss', title: 'Later' }
    ]
  });
};

export const notifyTaskApproved = async (taskTitle: string, approverName: string, employeeId: string) => {
  return sendPushNotification({
    title: '🎉 Task Approved',
    body: `${approverName} approved: "${taskTitle}"`,
    employeeIds: [employeeId],
    data: {
      action: 'task_approved',
      url: '/employee'
    }
  });
};

export const notifyTaskRejected = async (taskTitle: string, approverName: string, employeeId: string, reason?: string) => {
  return sendPushNotification({
    title: '❌ Task Rejected',
    body: `${approverName} rejected: "${taskTitle}"${reason ? ` - ${reason}` : ''}`,
    employeeIds: [employeeId],
    data: {
      action: 'task_rejected',
      url: '/employee'
    }
  });
};

// Task Verification Notifications
export const notifyTaskVerificationRequest = async (taskTitle: string, departmentHeadName: string, adminIds: string[]) => {
  return sendPushNotification({
    title: '🔍 Verification Request',
    body: `${departmentHeadName} requests verification for: "${taskTitle}"`,
    employeeIds: adminIds,
    data: {
      action: 'verification_request',
      url: '/admin'
    },
    actions: [
      { action: 'verify', title: 'Review' },
      { action: 'dismiss', title: 'Later' }
    ]
  });
};

export const notifyTaskVerificationApproved = async (taskTitle: string, employeeId: string, departmentHeadId: string) => {
  return sendPushNotification({
    title: '✨ Task Verified',
    body: `Admin verified: "${taskTitle}"`,
    employeeIds: [employeeId, departmentHeadId],
    data: {
      action: 'verification_approved',
      url: '/employee'
    }
  });
};

export const notifyTaskVerificationRejected = async (taskTitle: string, departmentHeadId: string, adminName: string) => {
  return sendPushNotification({
    title: '⚠️ Verification Rejected',
    body: `${adminName} rejected verification for: "${taskTitle}"`,
    employeeIds: [departmentHeadId],
    data: {
      action: 'verification_rejected',
      url: '/department'
    }
  });
};

// Task Update Notifications
export const notifyTaskUpdated = async (taskTitle: string, employeeId: string, updatedByName: string, changes: string) => {
  return sendPushNotification({
    title: '📝 Task Updated',
    body: `${updatedByName} updated "${taskTitle}": ${changes}`,
    employeeIds: [employeeId],
    data: {
      action: 'task_updated',
      url: '/employee'
    }
  });
};

export const notifyTaskDeactivated = async (taskTitle: string, employeeId: string) => {
  return sendPushNotification({
    title: '⏸️ Task Deactivated',
    body: `"${taskTitle}" has been deactivated`,
    employeeIds: [employeeId],
    data: {
      action: 'task_deactivated'
    }
  });
};

export const notifyTaskActivated = async (taskTitle: string, employeeId: string) => {
  return sendPushNotification({
    title: '▶️ Task Activated',
    body: `"${taskTitle}" is now available`,
    employeeIds: [employeeId],
    data: {
      action: 'task_activated',
      url: '/employee'
    }
  });
};

export const notifyTaskDeleted = async (taskTitle: string, employeeId: string) => {
  return sendPushNotification({
    title: '🗑️ Task Deleted',
    body: `"${taskTitle}" has been removed`,
    employeeIds: [employeeId],
    data: {
      action: 'task_deleted'
    }
  });
};

// Deadline Notifications
export const notifyTaskDeadlineApproaching = async (taskTitle: string, employeeId: string, hoursRemaining: number) => {
  return sendPushNotification({
    title: '⏰ Deadline Approaching',
    body: `"${taskTitle}" is due in ${hoursRemaining} hours`,
    employeeIds: [employeeId],
    data: {
      action: 'deadline_approaching',
      url: '/employee'
    },
    actions: [
      { action: 'view', title: 'View Task' },
      { action: 'dismiss', title: 'OK' }
    ]
  });
};

export const notifyTaskOverdue = async (taskTitle: string, employeeId: string) => {
  return sendPushNotification({
    title: '🚨 Task Overdue',
    body: `"${taskTitle}" is now overdue!`,
    employeeIds: [employeeId],
    data: {
      action: 'task_overdue',
      url: '/employee'
    }
  });
};

// Employee Management Notifications
export const notifyEmployeeAdded = async (employeeName: string, departmentName: string, employeeId: string) => {
  return sendPushNotification({
    title: '👋 Welcome to Task Vision',
    body: `Welcome ${employeeName}! You've been added to ${departmentName}`,
    employeeIds: [employeeId],
    data: {
      action: 'employee_added',
      url: '/'
    }
  });
};

export const notifyEmployeeCredentials = async (employeeName: string, email: string, password: string, employeeId: string) => {
  return sendPushNotification({
    title: '🔐 Your Login Credentials',
    body: `${employeeName}, your login is ${email} / ${password}. Keep this safe.`,
    employeeIds: [employeeId],
    data: {
      action: 'employee_credentials',
      url: '/login'
    }
  });
};

export const notifyEmployeeRoleChanged = async (employeeName: string, newRole: string, employeeId: string) => {
  return sendPushNotification({
    title: '🔄 Role Updated',
    body: `Your role has been changed to ${newRole}`,
    employeeIds: [employeeId],
    data: {
      action: 'role_changed',
      url: '/'
    }
  });
};

export const notifyEmployeeDepartmentChanged = async (employeeName: string, newDepartmentName: string, employeeId: string) => {
  return sendPushNotification({
    title: '🏢 Department Changed',
    body: `You've been moved to ${newDepartmentName}`,
    employeeIds: [employeeId],
    data: {
      action: 'department_changed',
      url: '/'
    }
  });
};

export const notifyEmployeeDeactivated = async (employeeId: string) => {
  return sendPushNotification({
    title: '⚠️ Account Deactivated',
    body: 'Your account has been deactivated. Please contact your administrator.',
    employeeIds: [employeeId],
    data: {
      action: 'account_deactivated'
    }
  });
};

// Department Management Notifications
export const notifyDepartmentHeadAssigned = async (departmentName: string, employeeId: string) => {
  return sendPushNotification({
    title: '👑 Department Head Assigned',
    body: `You are now the head of ${departmentName}`,
    employeeIds: [employeeId],
    data: {
      action: 'dept_head_assigned',
      url: '/department'
    }
  });
};

export const notifyNewEmployeeInDepartment = async (newEmployeeName: string, departmentHeadId: string) => {
  return sendPushNotification({
    title: '👥 New Team Member',
    body: `${newEmployeeName} joined your department`,
    employeeIds: [departmentHeadId],
    data: {
      action: 'new_team_member',
      url: '/department'
    }
  });
};

// Device Control Task Notifications
export const notifyDeviceControlTaskCreated = async (deviceType: string, action: string, employeeIds: string[]) => {
  return sendPushNotification({
    title: '🔧 Device Control Task',
    body: `New task: ${action} ${deviceType}`,
    employeeIds: employeeIds,
    data: {
      action: 'device_control_task',
      url: '/employee'
    }
  });
};

// Location & Tracking Notifications
export const notifyLocationTrackingEnabled = async (employeeId: string) => {
  return sendPushNotification({
    title: '📍 Location Tracking',
    body: 'Location tracking is now active',
    employeeIds: [employeeId],
    data: {
      action: 'tracking_enabled'
    }
  });
};

export const notifyLowBattery = async (employeeId: string, batteryLevel: number) => {
  return sendPushNotification({
    title: '🔋 Low Battery Warning',
    body: `Your device battery is at ${batteryLevel}%. Please charge soon.`,
    employeeIds: [employeeId],
    data: {
      action: 'low_battery'
    }
  });
};

// Report & Analytics Notifications
export const notifyReportGenerated = async (reportType: string, employeeIds: string[]) => {
  return sendPushNotification({
    title: '📊 Report Ready',
    body: `Your ${reportType} report is ready to view`,
    employeeIds: employeeIds,
    data: {
      action: 'report_generated',
      url: '/department'
    }
  });
};

// Emergency & Alert Notifications
export const notifyEmergencyAlert = async (message: string, allEmployeeIds: string[]) => {
  return sendPushNotification({
    title: '🚨 EMERGENCY ALERT',
    body: message,
    employeeIds: allEmployeeIds,
    data: {
      action: 'emergency_alert',
      url: '/'
    },
    actions: [
      { action: 'acknowledge', title: 'Acknowledge' }
    ]
  });
};

export const notifySystemMaintenance = async (scheduledTime: string, allEmployeeIds: string[]) => {
  return sendPushNotification({
    title: '🔧 System Maintenance',
    body: `Scheduled maintenance at ${scheduledTime}`,
    employeeIds: allEmployeeIds,
    data: {
      action: 'system_maintenance'
    }
  });
};

// Bulk Operations Notifications
export const notifyBulkOperation = async (operation: string, count: number, employeeIds: string[]) => {
  return sendPushNotification({
    title: '⚡ Bulk Operation Complete',
    body: `${operation}: ${count} items processed`,
    employeeIds: employeeIds,
    data: {
      action: 'bulk_operation'
    }
  });
};

// Location & Real-time Tracking Notifications (Uber-like)
export const notifyLocationUpdate = async (employeeName: string, taskTitle: string, employeeId: string) => {
  return sendPushNotification({
    title: '📍 Location Update',
    body: `${employeeName} is working on: "${taskTitle}"`,
    employeeIds: [employeeId],
    data: {
      action: 'location_update',
      url: '/employee'
    }
  });
};

export const notifyDriverArriving = async (employeeName: string, location: string, adminId: string) => {
  return sendPushNotification({
    title: '🚗 Employee Approaching',
    body: `${employeeName} is arriving at ${location}`,
    employeeIds: [adminId],
    data: {
      action: 'driver_arriving',
      url: '/admin'
    },
    actions: [
      { action: 'track', title: 'Track Live' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  });
};

export const notifyTaskStarted = async (taskTitle: string, employeeName: string, supervisorId: string) => {
  return sendPushNotification({
    title: '▶️ Task Started',
    body: `${employeeName} started: "${taskTitle}"`,
    employeeIds: [supervisorId],
    data: {
      action: 'task_started',
      url: '/department'
    }
  });
};

export const notifyTaskCompleted = async (taskTitle: string, employeeName: string, approverIds: string[]) => {
  return sendPushNotification({
    title: '✅ Task Completed',
    body: `${employeeName} completed: "${taskTitle}" - Pending approval`,
    employeeIds: approverIds,
    data: {
      action: 'task_completed',
      url: '/department'
    },
    actions: [
      { action: 'approve', title: 'Review' },
      { action: 'dismiss', title: 'Later' }
    ]
  });
};

// Rejected Task Auto-Reassignment
export const notifyTaskReassigned = async (taskTitle: string, previousEmployeeId: string, newEmployeeId: string, reassignedByName: string) => {
  // Notify the employee who will now work on this task
  await sendPushNotification({
    title: '🔄 Task Reassigned to You',
    body: `${reassignedByName} reassigned "${taskTitle}" to you`,
    employeeIds: [newEmployeeId],
    data: {
      action: 'task_reassigned',
      url: '/employee'
    }
  });

  // Notify the previous employee that task was reassigned
  await sendPushNotification({
    title: '📋 Task Reassigned',
    body: `Task "${taskTitle}" has been reassigned to another employee`,
    employeeIds: [previousEmployeeId],
    data: {
      action: 'task_reassigned_from',
      url: '/employee'
    }
  });
};

// Enhanced Location Tracking with Live Updates
export const notifyLiveLocationTracking = async (employeeId: string, isActive: boolean) => {
  const title = isActive ? '📍 Live Tracking Started' : '⏹️ Live Tracking Stopped';
  const body = isActive ? 'Your location is now being tracked in real-time' : 'Live location tracking has been stopped';
  
  return sendPushNotification({
    title,
    body,
    employeeIds: [employeeId],
    data: {
      action: 'live_tracking_toggle',
      trackingActive: isActive
    }
  });
};

export const notifyGeofenceBreach = async (employeeName: string, location: string, supervisorId: string) => {
  return sendPushNotification({
    title: '⚠️ Location Alert',
    body: `${employeeName} has left the designated area: ${location}`,
    employeeIds: [supervisorId],
    data: {
      action: 'geofence_breach',
      url: '/admin',
      location
    }
  });
};

export const notifyProximityAlert = async (employeeName: string, distance: number, supervisorId: string) => {
  return sendPushNotification({
    title: '🎯 Proximity Alert',
    body: `${employeeName} is ${distance}m away from target location`,
    employeeIds: [supervisorId],
    data: {
      action: 'proximity_alert',
      url: '/admin'
    }
  });
};
