import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showSuccess, showError } from "@/lib/sweetalert";
import { CheckCircle2, X, User, Clock, MapPin } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { notifyTaskVerificationRequest, notifyTaskRejected } from "@/lib/notificationService";
import { TaskAutoReassignmentService } from "@/lib/taskAutoReassignment";
import { TaskReassignmentService } from "@/lib/taskReassignmentService";
import { notifyEmployeeTaskApproved, notifyEmployeeTaskRejected } from "@/lib/whatsappService";

interface Task {
  id: string;
  title: string;
  description: string | null;
  completion_photo_url: string | null;
  completed_at: string | null;
  started_at: string | null;
  location_address: string | null;
  assigned_to: string | null;
  employee?: { name: string };
}

interface TaskApprovalProps {
  departmentId: string;
  approvedBy: string;
}

const TaskApproval = ({ departmentId, approvedBy }: TaskApprovalProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchPendingApproval();

    const channel = supabase
      .channel("approval-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        fetchPendingApproval();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId]);

  const fetchPendingApproval = async () => {
    let query = supabase
      .from("tasks")
      .select(`
        *,
        employee:employees!tasks_assigned_to_fkey (name)
      `);
    
    if (departmentId) {
      query = query.eq("department_id", departmentId);
    } else {
      query = query.is("department_id", null);
    }
    
    const { data, error } = await query
      .eq("status", "completed")
      .is("approved_at", null)
      .order("completed_at", { ascending: false });

    if (error) {
      showError("Failed to fetch tasks");
      return;
    }

    setTasks(data || []);
  };

  const handleApprove = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    
    // Create verification request for admin approval
    const { error: verificationError } = await supabase
      .from("task_verification_requests")
      .insert({
        task_id: taskId,
        requested_by: approvedBy,
        status: "pending",
      });

    if (verificationError) {
      showError("Failed to create verification request");
      return;
    }

    // Update task to show it's been verified by department head
    const { error: taskError } = await supabase
      .from("tasks")
      .update({
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (taskError) {
      showError("Failed to update task");
      return;
    }

    showSuccess("Task verification sent to admin for approval");
    
    // Get approver name and notify admins
    const { data: approverData } = await supabase
      .from("employees")
      .select("name")
      .eq("id", approvedBy)
      .single();
    
    const approverName = approverData?.name || "Department Head";
    
    // Get all admins
    const { data: admins } = await supabase
      .from("employees")
      .select("id")
      .eq("role", "admin")
      .eq("is_active", true);
    
    if (admins && admins.length > 0 && task) {
      const adminIds = admins.map(a => a.id);
      await notifyTaskVerificationRequest(task.title, approverName, adminIds);
    }

    // Send WhatsApp notification to employee about task approval
    if (task && task.assigned_to) {
      await notifyEmployeeTaskApproved(
        task.title,
        task.assigned_to,
        approverName,
        taskId
      );
    }
    
    setSelectedTask(null);
    fetchPendingApproval();
  };

  const handleReject = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Prompt for rejection reason
    const reason = prompt("Please provide a reason for rejecting this task:");
    if (!reason || !reason.trim()) {
      showError("Rejection reason is required");
      return;
    }

    // Use automatic reassignment service (reassigns to employee and department head)
    const result = await TaskReassignmentService.reassignRejectedTask(
      taskId,
      approvedBy,
      reason
    );

    if (result.success) {
      if (result.deptHeadReassigned) {
        showSuccess("Task rejected and automatically reassigned to employee and department head");
      } else {
        showSuccess("Task rejected and automatically reassigned to employee");
      }
    } else {
      // Fallback: try the old auto-reassignment service
      const reassignmentSuccess = await TaskAutoReassignmentService.handleTaskRejection(
        taskId,
        approvedBy,
        reason
      );

      if (reassignmentSuccess) {
        showSuccess("Task has been automatically reassigned to another employee");
      } else {
        // Final fallback: just reassign to employee
        const { error } = await supabase
          .from("tasks")
          .update({
            status: "pending",
            completed_at: null,
            completion_photo_url: null,
            rejection_reason: reason,
            rejection_count: (task.rejection_count || 0) + 1
          })
          .eq("id", taskId);

        if (error) {
          showError("Failed to reject task");
          return;
        }

        showSuccess("Task rejected. Employee can resubmit.");
        
        // Notify employee about rejection (push notification)
        if (task.assigned_to) {
          const { data: approverData } = await supabase
            .from("employees")
            .select("name")
            .eq("id", approvedBy)
            .single();
          
          const approverName = approverData?.name || "Department Head";
          await notifyTaskRejected(task.title, approverName, task.assigned_to, reason);

          // Send WhatsApp notification to employee about task rejection
          await notifyEmployeeTaskRejected(
            task.title,
            task.assigned_to,
            approverName,
            reason,
            taskId
          );
        }
      }
    }
    
    setSelectedTask(null);
    fetchPendingApproval();
  };

  const calculateTimeSpent = (startedAt: string | null, completedAt: string | null) => {
    if (!startedAt || !completedAt) return "N/A";
    const minutes = differenceInMinutes(new Date(completedAt), new Date(startedAt));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-2xl font-bold">Task Approvals</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">Review and approve completed tasks</p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => (
          <Card key={task.id} className="p-3 sm:p-4 hover:shadow-lg transition-all cursor-pointer" onClick={() => setSelectedTask(task)}>
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-sm sm:text-base mb-1">{task.title}</h3>
                <Badge className="bg-warning text-warning-foreground">Pending Approval</Badge>
              </div>

              <div className="space-y-2 text-sm">
                {task.employee?.name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{task.employee.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Time: {calculateTimeSpent(task.started_at, task.completed_at)}</span>
                </div>
                {task.completed_at && (
                  <div className="text-xs text-muted-foreground">
                    Completed: {format(new Date(task.completed_at), "PPp")}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}

        {tasks.length === 0 && (
          <Card className="p-12 col-span-full text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No tasks pending approval</p>
          </Card>
        )}
      </div>

      {selectedTask && (
        <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Task Completion</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-base sm:text-lg mb-2">{selectedTask.title}</h3>
                {selectedTask.description && (
                  <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Employee:</span>
                  <p className="font-medium">{selectedTask.employee?.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Time Spent:</span>
                  <p className="font-medium">{calculateTimeSpent(selectedTask.started_at, selectedTask.completed_at)}</p>
                </div>
                {selectedTask.location_address && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Location:</span>
                    <p className="font-medium">{selectedTask.location_address}</p>
                  </div>
                )}
              </div>

              {selectedTask.completion_photo_url && (
                <div>
                  <p className="text-sm font-medium mb-2">Completion Photo:</p>
                  <img
                    src={selectedTask.completion_photo_url}
                    alt="Task completion"
                    className="w-full rounded-lg"
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button
                  onClick={() => handleApprove(selectedTask.id)}
                  className="flex-1 bg-success"
                  size="sm"
                >
                  <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  Approve Task
                </Button>
                <Button
                  onClick={() => handleReject(selectedTask.id)}
                  variant="destructive"
                  className="flex-1"
                  size="sm"
                >
                  <X className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  Reject & Reopen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default TaskApproval;
