import { supabase } from '@/integrations/supabase/client';

/**
 * WhatsApp Notification Service
 * Sends WhatsApp messages via Vercel serverless function
 * This avoids CORS issues when deployed on Vercel
 */

// Use serverless function in production, direct API in development
const WHATSAPP_API_ENDPOINT = '/api/send-whatsapp';

export type WhatsAppMessageType = 'text' | 'image' | 'video' | 'audio' | 'pdf';

interface WhatsAppMessageParams {
  number: string;
  type: WhatsAppMessageType;
  message?: string;
  mediaUrl?: string;
}

/**
 * Send a WhatsApp message via the serverless API
 * @param params - Message parameters including number, type, message, and optional mediaUrl
 * @returns Promise<boolean> - True if message was sent successfully
 */
const sendWhatsAppMessage = async (params: WhatsAppMessageParams): Promise<boolean> => {
  try {
    console.log('📱 Sending WhatsApp message to:', params.number);
    
    // Call our serverless function instead of direct API
    const response = await fetch(WHATSAPP_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: params.number,
        type: params.type,
        message: params.message,
        mediaUrl: params.mediaUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ WhatsApp API error:', errorData.error || response.statusText);
      return false;
    }

    const data = await response.json();
    console.log('✅ WhatsApp message sent successfully:', data);
    return true;
  } catch (error) {
    console.error('❌ Failed to send WhatsApp message:', error);
    return false;
  }
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
  assignedByName: string
): Promise<boolean> => {
  console.log('📨 Starting WhatsApp notification for dept head:', deptHeadId);
  
  const phone = await getEmployeePhone(deptHeadId);
  if (!phone) {
    console.warn('⚠️ No phone number found for department head:', deptHeadId);
    console.warn('⚠️ Make sure phone number is added to database');
    return false;
  }

  console.log('✅ Phone found, sending WhatsApp to:', phone);

  const message = `🎯 *New Task Assigned*\n\n` +
    `Hello! You have been assigned a new task by *${assignedByName}*.\n\n` +
    `📋 *Task:* ${taskTitle}\n\n` +
    `Please check your dashboard for details and assign it to your team members.\n\n` +
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
  priority?: string
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

  message += `\nPlease check your dashboard to view details and start working on the task.\n\n` +
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
  taskCount: number = 1
): Promise<void> => {
  // Send notifications to all employees in parallel
  const promises = employeeIds.map(async (employeeId) => {
    const phone = await getEmployeePhone(employeeId);
    if (!phone) {
      console.warn('⚠️ No phone number found for employee:', employeeId);
      return false;
    }

    const message = `✅ *${taskCount > 1 ? 'Tasks' : 'Task'} Assigned*\n\n` +
      `Hello! You have been assigned ${taskCount > 1 ? taskCount + ' new tasks' : 'a new task'} by *${assignedByName}*.\n\n` +
      `📋 *Task:* ${taskTitle}\n\n` +
      `Please check your dashboard to view details and start working.\n\n` +
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
