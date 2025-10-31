import { supabase } from '@/integrations/supabase/client';
import { notifyTaskReassigned } from './notificationService';

export interface ReassignmentRule {
  id: string;
  task_type: string;
  priority: string;
  auto_reassign: boolean;
  reassignment_delay_hours: number;
  fallback_employee_id?: string;
}

export class TaskAutoReassignmentService {
  
  /**
   * Handle task rejection and auto-reassignment
   */
  static async handleTaskRejection(
    taskId: string, 
    rejectedById: string, 
    rejectionReason: string
  ): Promise<boolean> {
    try {
      // Get task details
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select(`
          *,
          employee:employees!tasks_assigned_to_fkey (id, name, email),
          department:departments (id, name)
        `)
        .eq('id', taskId)
        .single();

      if (taskError || !task) {
        console.error('Failed to fetch task for reassignment:', taskError);
        return false;
      }

      // Check if task should be auto-reassigned
      const shouldReassign = await this.shouldAutoReassign(task, rejectionReason);
      if (!shouldReassign) {
        console.log('Task rejection does not require auto-reassignment');
        return false;
      }

      // Find replacement employee
      const newEmployeeId = await this.findReplacementEmployee(
        task.department_id,
        task.task_type,
        task.priority,
        task.assigned_to
      );

      if (!newEmployeeId) {
        console.log('No replacement employee found for auto-reassignment');
        return false;
      }

      // Get employee names for notification
      const { data: employees } = await supabase
        .from('employees')
        .select('name')
        .in('id', [task.assigned_to, newEmployeeId]);

      const previousEmployee = employees?.find(e => e.id === task.assigned_to);
      const newEmployee = employees?.find(e => e.id === newEmployeeId);
      const reassignedBy = employees?.find(e => e.id === rejectedById);

      // Update task assignment
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          assigned_to: newEmployeeId,
          status: 'pending',
          reassigned_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
          original_assigned_to: task.assigned_to,
          rejection_count: (task.rejection_count || 0) + 1
        })
        .eq('id', taskId);

      if (updateError) {
        console.error('Failed to update task with new assignment:', updateError);
        return false;
      }

      // Create audit log entry
      await supabase.from('task_reassignment_logs').insert({
        task_id: taskId,
        from_employee_id: task.assigned_to,
        to_employee_id: newEmployeeId,
        rejected_by_id: rejectedById,
        reason: rejectionReason,
        auto_reassigned: true,
        created_at: new Date().toISOString()
      });

      // Send notifications
      await notifyTaskReassigned(
        task.title,
        task.assigned_to,
        newEmployeeId,
        reassignedBy?.name || 'Department Head'
      );

      console.log('✅ Task auto-reassigned successfully:', taskId);
      return true;

    } catch (error) {
      console.error('Error in task auto-reassignment:', error);
      return false;
    }
  }

  /**
   * Determine if a task should be auto-reassigned based on rules and rejection reason
   */
  private static async shouldAutoReassign(task: any, rejectionReason: string): Promise<boolean> {
    try {
      // Get reassignment rules for the task type and priority
      const { data: rules } = await supabase
        .from('reassignment_rules')
        .select('*')
        .eq('task_type', task.task_type)
        .eq('priority', task.priority)
        .eq('auto_reassign', true)
        .single();

      if (!rules) {
        // Default behavior: auto-reassign critical/high priority tasks
        return task.priority === 'high' || task.priority === 'critical';
      }

      // Check rejection reason patterns
      const autoReassignReasons = rules.auto_reassign_reasons || [];
      const reasonMatches = autoReassignReasons.some((pattern: string) => 
        rejectionReason.toLowerCase().includes(pattern.toLowerCase())
      );

      // Check if task has been rejected too many times
      const maxRejections = rules.max_rejections || 2;
      const currentRejections = task.rejection_count || 0;
      
      return reasonMatches || currentRejections >= maxRejections;

    } catch (error) {
      console.error('Error checking reassignment rules:', error);
      // Default to auto-reassign for high priority tasks
      return task.priority === 'high' || task.priority === 'critical';
    }
  }

  /**
   * Find the best replacement employee for a task
   */
  private static async findReplacementEmployee(
    departmentId: string | null,
    taskType: string,
    priority: string,
    excludeEmployeeId: string
  ): Promise<string | null> {
    try {
      let query = supabase
        .from('employees')
        .select('id, name, role, current_task_count')
        .eq('is_active', true)
        .neq('id', excludeEmployeeId);

      // Filter by department if specified
      if (departmentId) {
        query = query.eq('department_id', departmentId);
      }

      // Get available employees
      const { data: employees } = await query;

      if (!employees || employees.length === 0) {
        return null;
      }

      // Find employee with lowest task load (best available)
      const sortedEmployees = employees.sort((a, b) => {
        // Prioritize department heads, then employees with fewer current tasks
        const roleWeight = a.role === 'department_head' ? 0 : 1;
        const otherRoleWeight = b.role === 'department_head' ? 0 : 1;
        
        if (roleWeight !== otherRoleWeight) {
          return roleWeight - otherRoleWeight;
        }
        
        return (a.current_task_count || 0) - (b.current_task_count || 0);
      });

      return sortedEmployees[0]?.id || null;

    } catch (error) {
      console.error('Error finding replacement employee:', error);
      return null;
    }
  }

  /**
   * Create default reassignment rules
   */
  static async createDefaultRules(): Promise<void> {
    const defaultRules = [
      {
        task_type: 'normal',
        priority: 'low',
        auto_reassign: false,
        reassignment_delay_hours: 24
      },
      {
        task_type: 'normal',
        priority: 'medium',
        auto_reassign: true,
        reassignment_delay_hours: 12,
        auto_reassign_reasons: ['unable to complete', 'out of office', 'emergency'],
        max_rejections: 2
      },
      {
        task_type: 'normal',
        priority: 'high',
        auto_reassign: true,
        reassignment_delay_hours: 6,
        auto_reassign_reasons: ['unable to complete', 'out of office', 'emergency', 'capacity'],
        max_rejections: 1
      },
      {
        task_type: 'normal',
        priority: 'critical',
        auto_reassign: true,
        reassignment_delay_hours: 2,
        auto_reassign_reasons: ['unable to complete', 'out of office', 'emergency', 'capacity'],
        max_rejections: 0
      },
      {
        task_type: 'location_based',
        priority: 'high',
        auto_reassign: true,
        reassignment_delay_hours: 1,
        auto_reassign_reasons: ['unable to reach location', 'location not accessible'],
        max_rejections: 1
      },
      {
        task_type: 'device_control',
        priority: 'critical',
        auto_reassign: true,
        reassignment_delay_hours: 1,
        auto_reassign_reasons: ['device unavailable', 'technical issue'],
        max_rejections: 0
      }
    ];

    for (const rule of defaultRules) {
      await supabase
        .from('reassignment_rules')
        .upsert(rule, { onConflict: 'task_type,priority' });
    }
  }

  /**
   * Get reassignment statistics
   */
  static async getReassignmentStats(): Promise<any> {
    try {
      const { data: stats } = await supabase
        .rpc('get_reassignment_stats');

      return stats;
    } catch (error) {
      console.error('Error fetching reassignment stats:', error);
      return null;
    }
  }
}