import { supabase } from '@/integrations/supabase/client';

/**
 * WhatsApp Notification Service
 * Sends WhatsApp messages directly to GeeKHirusha API
 * Works on both localhost and Vercel
 */

const WHATSAPP_API_BASE_URL = 'https://api.geekhirusha.com/emptaskmanagement.php';

export type WhatsAppMessageType = 'text' | 'image' | 'video' | 'audio' | 'pdf';

interface WhatsAppMessageParams {
  number: string;
  type: WhatsAppMessageType;
  message?: string;
  mediaUrl?: string;
}

/**
 * Send a WhatsApp message via the API
 * @param params - Message parameters including number, type, message, and optional mediaUrl
 * @returns Promise<boolean> - True if message was sent successfully
 */
const sendWhatsAppMessage = async (params: WhatsAppMessageParams): Promise<boolean> => {
  try {
    console.log('📱 Sending WhatsApp message to:', params.number);
    console.log('📝 Message preview:', params.message?.substring(0, 50) + '...');
    
    // Build URL with parameters
    const url = new URL(WHATSAPP_API_BASE_URL);
    url.searchParams.append('number', params.number);
    url.searchParams.append('type', params.type);
    
    if (params.message) {
      url.searchParams.append('message', params.message);
    }
    
    if (params.mediaUrl) {
      url.searchParams.append('mediaUrl', params.mediaUrl);
    }

    console.log('🌐 API URL:', url.toString());
    
    // Call WhatsApp API
    const response = await fetch(url.toString(), {
      method: 'GET',
      mode: 'no-cors', // Important: Avoid CORS issues
    });

    // Note: With no-cors mode, we can't read the response
    // We'll assume success if no error is thrown
    console.log('✅ WhatsApp API request sent (no-cors mode)');
    console.log('📱 WhatsApp should be delivered to:', params.number);
    return true;
    
  } catch (error) {
    console.error('❌ Failed to send WhatsApp message:', error);
    return false;
  }
};

/**
 * Generate a task URL for the given task ID
 * @param taskId - Task ID
 * @returns Full URL to the task detail page
 */
const getTaskUrl = (taskId: string): string => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/task/${taskId}`;
};

/**
 * Format phone number to ensure it's in the correct format (94XXXXXXXXX)
 * @param phone - Phone number to format
 * @returns Formatted phone number or null if invalid
 */
const formatPhoneNumber = (phone: string | null | undefined): string | null => {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 0, replace with 94
  if (cleaned.startsWith('0')) {
    cleaned = '94' + cleaned.substring(1);
  }
  
  // If doesn't start with 94, add it
  if (!cleaned.startsWith('94')) {
    cleaned = '94' + cleaned;
  }
  
  // Validate length (94 + 9 digits = 11 digits total)
  if (cleaned.length !== 11) {
    console.warn('⚠️ Invalid phone number format:', phone);
    return null;
  }
  
  return cleaned;
};

/**
 * Get employee phone number by ID
 * @param employeeId - Employee ID
 * @returns Phone number or null if not found
 */
const getEmployeePhone = async (employeeId: string): Promise<string | null> => {
  try {
    console.log('🔍 Fetching phone for employee:', employeeId);
    
    const { data, error } = await supabase
      .from('employees')
      .select('phone')
      .eq('id', employeeId)
      .single();

    if (error) {
      console.error('❌ Failed to fetch employee phone:', error);
      return null;
    }

    if (!data) {
      console.error('❌ No employee data found for ID:', employeeId);
      return null;
    }

    console.log('📞 Raw phone from database:', data.phone);

    if (!data.phone) {
      console.warn('⚠️ Phone field is empty for employee:', employeeId);
      return null;
    }

    const formatted = formatPhoneNumber(data.phone);
    console.log('📱 Formatted phone:', formatted);
    
    return formatted;
  } catch (error) {
    console.error('❌ Error fetching employee phone:', error);
    return null;
  }
};

/**
 * Notification: Task assigned to Department Head by Admin
 */
export const notifyDeptHeadTaskAssigned = async (
  taskTitle: string,
  deptHeadId: string,
  assignedByName: string,
  taskId?: string
): Promise<boolean> => {
  console.log('📨 Starting WhatsApp notification for dept head:', deptHeadId);
  
  const phone = await getEmployeePhone(deptHeadId);
  if (!phone) {
    console.warn('⚠️ No phone number found for department head:', deptHeadId);
    console.warn('⚠️ Make sure phone number is added to database');
    return false;
  }

  console.log('✅ Phone found, sending WhatsApp to:', phone);

  let message = `🎯 *New Task Assigned*\n\n` +
    `Hello! You have been assigned a new task by *${assignedByName}*.\n\n` +
    `📋 *Task:* ${taskTitle}\n\n`;

  if (taskId) {
    const taskUrl = getTaskUrl(taskId);
    message += `🔗 *Click here to view the task:*\n${taskUrl}\n\n`;
  }

  message += `Please click the link above to access the task directly, or check your dashboard for details.\n\n` +
    `_Task Management System_`;

  const result = await sendWhatsAppMessage({
    number: phone,
    type: 'text',
    message,
  });

  console.log('📱 WhatsApp notification result:', result ? '✅ Sent' : '❌ Failed');
  return result;
};

/**
 * Notification: Task assigned to Employee by Department Head
 */
export const notifyEmployeeTaskAssigned = async (
  taskTitle: string,
  employeeId: string,
  assignedByName: string,
  deadline?: string | null,
  priority?: string,
  taskId?: string
): Promise<boolean> => {
  console.log('📨 Starting WhatsApp notification for employee:', employeeId);
  
  const phone = await getEmployeePhone(employeeId);
  if (!phone) {
    console.warn('⚠️ No phone number found for employee:', employeeId);
    console.warn('⚠️ Make sure phone number is added to database');
    return false;
  }

  console.log('✅ Phone found, sending WhatsApp to:', phone);

  let message = `✅ *Task Assigned*\n\n` +
    `Hello! You have been assigned a new task by *${assignedByName}*.\n\n` +
    `📋 *Task:* ${taskTitle}\n`;

  if (priority) {
    const priorityEmoji = {
      low: '🔵',
      medium: '🟡',
      high: '🟠',
      urgent: '🔴'
    }[priority] || '⚪';
    message += `${priorityEmoji} *Priority:* ${priority.toUpperCase()}\n`;
  }

  if (deadline) {
    try {
      const deadlineDate = new Date(deadline);
      const formattedDate = deadlineDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      message += `⏰ *Deadline:* ${formattedDate}\n`;
    } catch (e) {
      // If date parsing fails, skip deadline
    }
  }

  if (taskId) {
    const taskUrl = getTaskUrl(taskId);
    message += `\n🔗 *Click here to view the task:*\n${taskUrl}\n`;
  }

  message += `\nPlease click the link above to access the task directly and start working on it.\n\n` +
    `_Task Management System_`;

  const result = await sendWhatsAppMessage({
    number: phone,
    type: 'text',
    message,
  });

  console.log('📱 WhatsApp notification result:', result ? '✅ Sent' : '❌ Failed');
  return result;
};

/**
 * Notification: Bulk tasks assigned to multiple employees
 */
export const notifyBulkEmployeeTasksAssigned = async (
  taskTitle: string,
  employeeIds: string[],
  assignedByName: string,
  taskCount: number = 1,
  taskIds?: string[]
): Promise<void> => {
  // Send notifications to all employees in parallel
  const promises = employeeIds.map(async (employeeId, index) => {
    const phone = await getEmployeePhone(employeeId);
    if (!phone) {
      console.warn('⚠️ No phone number found for employee:', employeeId);
      return false;
    }

    let message = `✅ *${taskCount > 1 ? 'Tasks' : 'Task'} Assigned*\n\n` +
      `Hello! You have been assigned ${taskCount > 1 ? taskCount + ' new tasks' : 'a new task'} by *${assignedByName}*.\n\n` +
      `📋 *Task:* ${taskTitle}\n`;

    // Add task link if available (use corresponding taskId for this employee)
    if (taskIds && taskIds.length > 0) {
      const taskId = taskIds[index] || taskIds[0]; // Use corresponding taskId or fallback to first
      if (taskId) {
        const taskUrl = getTaskUrl(taskId);
        message += `\n🔗 *Click here to view your task:*\n${taskUrl}\n`;
      }
    }

    message += `\nPlease click the link above to access your task directly and start working on it.\n\n` +
      `_Task Management System_`;

    return sendWhatsAppMessage({
      number: phone,
      type: 'text',
      message,
    });
  });

  await Promise.allSettled(promises);
};

/**
 * Notification: Task status updated (started, completed, etc.)
 */
export const notifyTaskStatusUpdate = async (
  taskTitle: string,
  employeeId: string,
  status: string,
  additionalInfo?: string
): Promise<boolean> => {
  const phone = await getEmployeePhone(employeeId);
  if (!phone) {
    console.warn('⚠️ No phone number found for employee:', employeeId);
    return false;
  }

  const statusEmoji = {
    'pending': '⏳',
    'in_progress': '▶️',
    'completed': '✅',
    'approved': '🎉',
    'rejected': '❌'
  }[status] || '📌';

  let message = `${statusEmoji} *Task Status Update*\n\n` +
    `📋 *Task:* ${taskTitle}\n` +
    `🔄 *Status:* ${status.replace('_', ' ').toUpperCase()}\n`;

  if (additionalInfo) {
    message += `\n${additionalInfo}\n`;
  }

  message += `\nCheck your dashboard for more details.\n\n` +
    `_Task Management System_`;

  return sendWhatsAppMessage({
    number: phone,
    type: 'text',
    message,
  });
};

/**
 * Notification: Task proof received - notify department head when employee submits completion proof
 */
export const notifyDeptHeadTaskProofReceived = async (
  taskTitle: string,
  deptHeadId: string,
  employeeName: string,
  taskId: string
): Promise<boolean> => {
  console.log('📨 Starting WhatsApp notification for dept head - task proof received:', deptHeadId);
  
  const phone = await getEmployeePhone(deptHeadId);
  if (!phone) {
    console.warn('⚠️ No phone number found for department head:', deptHeadId);
    return false;
  }

  console.log('✅ Phone found, sending WhatsApp to:', phone);

  const taskUrl = getTaskUrl(taskId);

  let message = `📸 *Task Proof Received*\n\n` +
    `Hello! *${employeeName}* has submitted completion proof for a task.\n\n` +
    `📋 *Task:* ${taskTitle}\n\n` +
    `🔗 *Click here to review the task:*\n${taskUrl}\n\n` +
    `Please review the completion proof and approve or reject the task.\n\n` +
    `_Task Management System_`;

  const result = await sendWhatsAppMessage({
    number: phone,
    type: 'text',
    message,
  });

  console.log('📱 WhatsApp notification result:', result ? '✅ Sent' : '❌ Failed');
  return result;
};

/**
 * Notification: Task approved - notify employee when department head approves their task
 */
export const notifyEmployeeTaskApproved = async (
  taskTitle: string,
  employeeId: string,
  approverName: string,
  taskId: string
): Promise<boolean> => {
  console.log('📨 Starting WhatsApp notification for employee - task approved:', employeeId);
  
  const phone = await getEmployeePhone(employeeId);
  if (!phone) {
    console.warn('⚠️ No phone number found for employee:', employeeId);
    return false;
  }

  console.log('✅ Phone found, sending WhatsApp to:', phone);

  const taskUrl = getTaskUrl(taskId);

  let message = `🎉 *Task Approved*\n\n` +
    `Great news! Your task has been approved by *${approverName}*.\n\n` +
    `📋 *Task:* ${taskTitle}\n\n` +
    `🔗 *Click here to view the task:*\n${taskUrl}\n\n` +
    `Well done! The task has been marked as completed and approved.\n\n` +
    `_Task Management System_`;

  const result = await sendWhatsAppMessage({
    number: phone,
    type: 'text',
    message,
  });

  console.log('📱 WhatsApp notification result:', result ? '✅ Sent' : '❌ Failed');
  return result;
};

/**
 * Notification: Task rejected - notify employee when department head rejects their task
 */
export const notifyEmployeeTaskRejected = async (
  taskTitle: string,
  employeeId: string,
  approverName: string,
  rejectionReason: string,
  taskId: string
): Promise<boolean> => {
  console.log('📨 Starting WhatsApp notification for employee - task rejected:', employeeId);
  
  const phone = await getEmployeePhone(employeeId);
  if (!phone) {
    console.warn('⚠️ No phone number found for employee:', employeeId);
    return false;
  }

  console.log('✅ Phone found, sending WhatsApp to:', phone);

  const taskUrl = getTaskUrl(taskId);

  let message = `❌ *Task Rejected*\n\n` +
    `Your task has been rejected by *${approverName}*.\n\n` +
    `📋 *Task:* ${taskTitle}\n` +
    `📝 *Reason:* ${rejectionReason}\n\n` +
    `🔗 *Click here to view the task:*\n${taskUrl}\n\n` +
    `The task has been reassigned. Please review the feedback and resubmit.\n\n` +
    `_Task Management System_`;

  const result = await sendWhatsAppMessage({
    number: phone,
    type: 'text',
    message,
  });

  console.log('📱 WhatsApp notification result:', result ? '✅ Sent' : '❌ Failed');
  return result;
};
