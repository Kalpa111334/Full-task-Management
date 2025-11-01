import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { showSuccess, showError } from "@/lib/sweetalert";
import { CheckCircle, XCircle, Clock, AlertCircle, User, MapPin, Camera } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  location_address: string | null;
  completed_at: string | null;
  completion_photo_url: string | null;
  admin_review_status: string | null;
  admin_rejection_reason: string | null;
  assigned_to: string;
  department_head: {
    name: string;
    email: string;
  };
  department: {
    name: string;
  } | null;
}

interface AdminTaskReviewProps {
  adminId: string;
}

const AdminTaskReview = ({ adminId }: AdminTaskReviewProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  useEffect(() => {
    fetchTasks();
    setupRealtimeSubscription();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    
    try {
      // Get all admin IDs
      const { data: admins, error: adminError } = await supabase
        .from("employees")
        .select("id")
        .eq("role", "admin");

      if (adminError) {
        console.error("Error fetching admins:", adminError);
        showError("Failed to load admin information");
        setLoading(false);
        return;
      }

      if (!admins || admins.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const adminIds = admins.map(a => a.id);

      // Fetch tasks awaiting admin review (assigned by admins and completed by department heads)
      // Query all tasks assigned by admins that have completion photos and are pending review
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          department_head:employees!tasks_assigned_to_fkey (name, email),
          department:departments (name)
        `)
        .in("assigned_by", adminIds)
        .not("completion_photo_url", "is", null)
        .order("completed_at", { ascending: false });

      if (error) {
        console.error("Error fetching tasks:", error);
        showError("Failed to load tasks awaiting review: " + error.message);
        setLoading(false);
        return;
      }

      // Filter for tasks awaiting review: status = 'awaiting_admin_review' OR admin_review_status = 'pending' OR (has photo and status not 'completed')
      const filteredData = (data || []).filter(task => {
        const isAwaitingReview = task.status === 'awaiting_admin_review' || 
                                task.admin_review_status === 'pending' || 
                                (!task.admin_review_status && task.completion_photo_url && task.status !== 'completed');
        return isAwaitingReview;
      });

      setTasks(filteredData);
    } catch (err: any) {
      console.error("Unexpected error:", err);
      showError("Failed to load tasks awaiting review");
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel("admin-task-review")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleApprove = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({
        admin_review_status: "approved",
        status: "completed",
      })
      .eq("id", taskId);

    if (error) {
      showError("Failed to approve task");
      return;
    }

    showSuccess("Task approved successfully");
    fetchTasks();
  };

  const handleReject = async () => {
    if (!selectedTask) return;

    if (!rejectReason.trim()) {
      showError("Please provide a reason for rejection");
      return;
    }

    // Update task with rejection
    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        admin_review_status: "rejected",
        admin_rejection_reason: rejectReason,
        status: "pending", // Reset to pending for re-assignment
      })
      .eq("id", selectedTask.id);

    if (updateError) {
      showError("Failed to reject task");
      return;
    }

    // Auto-reassign task to the same department head
    const { error: reassignError } = await supabase
      .from("tasks")
      .update({
        assigned_to: selectedTask.assigned_to,
        completed_at: null,
        completion_photo_url: null,
      })
      .eq("id", selectedTask.id);

    if (reassignError) {
      showError("Task rejected but failed to re-assign");
      return;
    }

    showSuccess("Task rejected and re-assigned to department head");
    
    // Reset state
    setShowRejectDialog(false);
    setSelectedTask(null);
    setRejectReason("");
    
    fetchTasks();
  };

  const openRejectDialog = (task: Task) => {
    setSelectedTask(task);
    setShowRejectDialog(true);
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: "bg-muted text-muted-foreground",
      medium: "bg-primary text-primary-foreground",
      high: "bg-warning text-warning-foreground",
      urgent: "bg-destructive text-destructive-foreground",
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <AlertCircle className="h-6 w-6" />
          Review Department Head Tasks
        </h2>
        <p className="text-muted-foreground mt-1">
          Review and approve tasks completed by department heads
        </p>
      </div>

      {tasks.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <Card key={task.id} className="p-6 border-l-4 border-l-blue-500">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold mb-2">{task.title}</h4>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                      <Badge className="bg-blue-500 text-white">
                        Awaiting Review
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>Department Head: {task.department_head.name}</span>
                      </div>
                      {task.department && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>Department: {task.department.name}</span>
                        </div>
                      )}
                      {task.location_address && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate">{task.location_address}</span>
                        </div>
                      )}
                      {task.completed_at && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Completed: {format(new Date(task.completed_at), "PPP p")}</span>
                        </div>
                      )}
                    </div>
                    {task.completion_photo_url && (
                      <div className="mt-4">
                        <img
                          src={task.completion_photo_url}
                          alt="Task completion photo"
                          className="w-full rounded-lg max-h-64 object-cover border"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() => handleApprove(task.id)}
                    className="bg-green-600 hover:bg-green-700 flex-1"
                    size="sm"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => openRejectDialog(task)}
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No tasks awaiting review</p>
        </Card>
      )}

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Task Completion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTask && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Task: <strong>{selectedTask.title}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Department Head: <strong>{selectedTask.department_head.name}</strong>
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="reason">Reason for Rejection *</Label>
              <Textarea
                id="reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this task completion is being rejected. The task will be automatically re-assigned to the department head."
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleReject}
                variant="destructive"
                className="flex-1"
              >
                Reject & Re-assign
              </Button>
              <Button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectReason("");
                  setSelectedTask(null);
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTaskReview;

