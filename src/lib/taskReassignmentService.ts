import { supabase } from '@/integrations/supabase/client';
import { notifyTaskAssigned, notifyTaskRejected } from './notificationService';
import { notifyEmployeeTaskAssigned, notifyDeptHeadTaskAssigned } from './whatsappService';

/**
 * Automatic Task Reassignment Service
 * Handles automatic reassignment of rejected tasks to both employee and department head
 */
export class TaskReassignmentService {
  /**
   * Reassign a rejected task to both the original employee and department head
   * @param taskId - The task ID that was rejected
   * @param rejectedById - ID of the person who rejected the task
   * @param rejectionReason - Reason for rejection
   * @returns Promise with success status and details
   */
  static async reassignRejectedTask(
    taskId: string,
    rejectedById: string,
    rejectionReason: string
  ): Promise<{ success: boolean; employeeReassigned: boolean; deptHeadReassigned: boolean; message: string }> {
    try {
      // Get task details
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select(`
          *,
          employee:employees!tasks_assigned_to_fkey (id, name, email, department_id)
        `)
        .eq('id', taskId)
        .single();

      if (taskError || !task) {
        console.error('Failed to fetch task for reassignment:', taskError);
        return {
          success: false,
          employeeReassigned: false,
          deptHeadReassigned: false,
          message: 'Failed to fetch task details'
        };
      }

      const originalEmployeeId = task.assigned_to;
      if (!originalEmployeeId) {
        return {
          success: false,
          employeeReassigned: false,
          deptHeadReassigned: false,
          message: 'Task has no assigned employee'
        };
      }

      // Check if the original assignee is a department head or employee
      const { data: originalAssignee } = await supabase
        .from('employees')
        .select('id, name, role, department_id')
        .eq('id', originalEmployeeId)
        .single();

      const isOriginalAssigneeDeptHead = originalAssignee?.role === 'department_head';

      // Get department head for the task's department
      let departmentHeadId: string | null = null;
      if (task.department_id) {
        const { data: deptHead } = await supabase
          .from('employees')
          .select('id, name')
          .eq('department_id', task.department_id)
          .eq('role', 'department_head')
          .eq('is_active', true)
          .maybeSingle();
        
        departmentHeadId = deptHead?.id || null;
      }

      // Find employee in department (if needed)
      let employeeInDept: string | null = null;
      if (task.department_id && isOriginalAssigneeDeptHead) {
        const { data: employees } = await supabase
          .from('employees')
          .select('id, name')
          .eq('department_id', task.department_id)
          .eq('role', 'employee')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        
        employeeInDept = employees?.id || null;
      }

      // Get rejecter name
      const { data: rejecterData } = await supabase
        .from('employees')
        .select('name')
        .eq('id', rejectedById)
        .single();

      const rejecterName = rejecterData?.name || 'Administrator';

      // Step 1: Reassign original task to the original assignee (reset status, clear completion data)
      const { error: employeeReassignError } = await supabase
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

      if (employeeReassignError) {
        console.error('Failed to reassign task:', employeeReassignError);
        return {
          success: false,
          employeeReassigned: false,
          deptHeadReassigned: false,
          message: 'Failed to reassign task'
        };
      }

      // Step 2: Create additional task for the other party
      let deptHeadTaskId: string | null = null;
      let employeeNewTaskId: string | null = null;

      if (isOriginalAssigneeDeptHead && employeeInDept) {
        // Original was dept head: create a new task for an employee
        const { data: newEmployeeTask, error: employeeTaskError } = await supabase
          .from('tasks')
          .insert({
            title: `${task.title} (Rejected - Requires Attention)`,
            description: task.description ? 
              `${task.description}\n\n⚠️ Original task was rejected by ${rejecterName}.\nReason: ${rejectionReason}\nThis task requires your attention.` :
              `⚠️ Original task was rejected by ${rejecterName}.\nReason: ${rejectionReason}\nThis task requires your attention.`,
            assigned_to: employeeInDept,
            assigned_by: rejectedById,
            department_id: task.department_id,
            priority: task.priority,
            task_type: task.task_type,
            location_address: task.location_address,
            location_lat: task.location_lat,
            location_lng: task.location_lng,
            deadline: task.deadline,
            status: 'pending',
            is_active: true
          })
          .select()
          .single();

        if (!employeeTaskError && newEmployeeTask?.id) {
          employeeNewTaskId = newEmployeeTask.id;
        }
      } else if (!isOriginalAssigneeDeptHead && departmentHeadId && departmentHeadId !== originalEmployeeId) {
        // Original was employee: create a new task for department head
        const { data: newTask, error: deptHeadTaskError } = await supabase
          .from('tasks')
          .insert({
            title: `${task.title} (Rejected - Requires Attention)`,
            description: task.description ? 
              `${task.description}\n\n⚠️ Original task was rejected by ${rejecterName}.\nReason: ${rejectionReason}\nThis task requires your attention.` :
              `⚠️ Original task was rejected by ${rejecterName}.\nReason: ${rejectionReason}\nThis task requires your attention.`,
            assigned_to: deptHeadForTask,
            assigned_by: rejectedById,
            department_id: task.department_id,
            priority: task.priority,
            task_type: task.task_type,
            location_address: task.location_address,
            location_lat: task.location_lat,
            location_lng: task.location_lng,
            deadline: task.deadline,
            status: 'pending',
            is_active: true
          })
          .select()
          .single();

        if (deptHeadTaskError) {
          console.error('Failed to create task for department head:', deptHeadTaskError);
          // Continue even if this fails - employee reassignment succeeded
        } else {
          deptHeadTaskId = newTask?.id || null;
        }
      }

      // Step 3: Send notifications
      // Notify original assignee about rejection and reassignment
      if (originalEmployeeId) {
        await notifyTaskRejected(
          task.title,
          rejecterName,
          originalEmployeeId,
          rejectionReason
        );

        await notifyTaskAssigned(
          task.title,
          originalEmployeeId,
          rejecterName
        );

        // Send WhatsApp notification with task link
        await notifyEmployeeTaskAssigned(
          task.title,
          originalEmployeeId,
          rejecterName,
          task.deadline,
          task.priority,
          taskId
        );
      }

      // Notify employee if new task was created for them
      if (employeeNewTaskId && employeeInDept) {
        await notifyTaskAssigned(
          `${task.title} (Rejected - Requires Attention)`,
          employeeInDept,
          rejecterName
        );

        await notifyEmployeeTaskAssigned(
          `${task.title} (Rejected - Requires Attention)`,
          employeeInDept,
          rejecterName,
          task.deadline,
          task.priority,
          employeeNewTaskId
        );
      }

      // Notify department head if task was created for them
      if (deptHeadTaskId && departmentHeadId) {
        await notifyTaskAssigned(
          `${task.title} (Rejected - Requires Attention)`,
          departmentHeadId,
          rejecterName
        );

        await notifyDeptHeadTaskAssigned(
          `${task.title} (Rejected - Requires Attention)`,
          departmentHeadId,
          rejecterName,
          deptHeadTaskId
        );
      }

      console.log('✅ Task reassigned successfully:', {
        taskId,
        originalAssigneeId: originalEmployeeId,
        originalAssigneeWasDeptHead: isOriginalAssigneeDeptHead,
        employeeNewTaskId,
        deptHeadTaskId
      });

      const hasBothAssignments = (employeeNewTaskId || (isOriginalAssigneeDeptHead && originalEmployeeId)) && 
                                  (deptHeadTaskId || (!isOriginalAssigneeDeptHead && originalEmployeeId));

      return {
        success: true,
        employeeReassigned: true,
        deptHeadReassigned: !!deptHeadTaskId || isOriginalAssigneeDeptHead,
        message: hasBothAssignments
          ? 'Task reassigned to both employee and department head'
          : (isOriginalAssigneeDeptHead
              ? (employeeNewTaskId 
                  ? 'Task reassigned to department head and employee'
                  : 'Task reassigned to department head (no employee found)')
              : (deptHeadTaskId
                  ? 'Task reassigned to employee and department head'
                  : 'Task reassigned to employee (no department head found)'))
      };

    } catch (error) {
      console.error('Error in task reassignment:', error);
      return {
        success: false,
        employeeReassigned: false,
        deptHeadReassigned: false,
        message: 'An error occurred during reassignment'
      };
    }
  }
}

