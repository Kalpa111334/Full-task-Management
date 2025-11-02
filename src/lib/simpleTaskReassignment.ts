import { supabase } from '@/integrations/supabase/client';
import { notifyTaskRejected } from './notificationService';
import { notifyEmployeeTaskRejected, notifyEmployeeTaskAssigned } from './whatsappService';

/**
 * Simple Task Reassignment Service
 * Reassigns only the rejected task back to the employee (no duplicate tasks)
 */
export class SimpleTaskReassignmentService {
  /**
   * Reassign a rejected task back to the employee
   * @param taskId - The task ID that was rejected
   * @param rejectedById - ID of the person who rejected the task
   * @param rejectionReason - Reason for rejection
   * @returns Promise with success status
   */
  static async reassignRejectedTask(
    taskId: string,
    rejectedById: string,
    rejectionReason: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get task details
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select(`
          *,
          employee:employees!tasks_assigned_to_fkey (id, name, email)
        `)
        .eq('id', taskId)
        .single();

      if (taskError || !task) {
        console.error('Failed to fetch task for reassignment:', taskError);
        return {
          success: false,
          message: 'Failed to fetch task details'
        };
      }

      const originalEmployeeId = task.assigned_to;
      if (!originalEmployeeId) {
        return {
          success: false,
          message: 'Task has no assigned employee'
        };
      }

      // Get rejecter name
      const { data: rejecterData } = await supabase
        .from('employees')
        .select('name')
        .eq('id', rejectedById)
        .single();

      const rejecterName = rejecterData?.name || 'Administrator';

      // Reassign the original task back to the employee
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          status: 'pending',
          assigned_to: originalEmployeeId,
          completed_at: null,
          completion_photo_url: null,
          rejection_reason: rejectionReason,
          rejection_count: (task.rejection_count || 0) + 1,
          is_active: true
        })
        .eq('id', taskId);

      if (updateError) {
        console.error('Failed to reassign task:', updateError);
        return {
          success: false,
          message: 'Failed to reassign task'
        };
      }

      // Send notifications
      // Push notification
      await notifyTaskRejected(
        task.title,
        rejecterName,
        originalEmployeeId,
        rejectionReason
      );

      // WhatsApp notification about rejection
      await notifyEmployeeTaskRejected(
        task.title,
        originalEmployeeId,
        rejecterName,
        rejectionReason,
        taskId
      );

      // WhatsApp notification about reassignment
      await notifyEmployeeTaskAssigned(
        task.title,
        originalEmployeeId,
        rejecterName,
        task.deadline,
        task.priority,
        taskId
      );

      console.log('✅ Task reassigned successfully:', {
        taskId,
        employeeId: originalEmployeeId
      });

      return {
        success: true,
        message: 'Task rejected and reassigned to employee'
      };

    } catch (error) {
      console.error('Error in simple task reassignment:', error);
      return {
        success: false,
        message: 'An error occurred during reassignment'
      };
    }
  }
}

