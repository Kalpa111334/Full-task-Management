import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { showSuccess, showError } from "@/lib/sweetalert";
import { CheckCircle2, X, User, Clock, MapPin, Camera, AlertCircle, Loader2 } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { notifyEmployeeTaskApproved, notifyEmployeeTaskRejected } from "@/lib/whatsappService";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  completion_photo_url: string | null;
  completed_at: string | null;
  started_at: string | null;
  location_address: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  department_id: string | null;
  employee?: { name: string; phone: string | null };
  department?: { name: string };
}

const TaskAction = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  useEffect(() => {
    // Check session validity
    const sessionExpiry = localStorage.getItem("session_expiry");
    const now = Date.now();
    
    if (sessionExpiry && parseInt(sessionExpiry) > now) {
      setHasValidSession(true);
      const employeeData = localStorage.getItem("employee");
      if (employeeData) {
        const user = JSON.parse(employeeData);
        setCurrentUser(user);
        
        // Verify user is department head
        if (user.role !== "department_head" && user.role !== "admin" && user.role !== "super_admin") {
          showError("Only department heads and admins can approve/reject tasks");
          navigate("/login");
          return;
        }
      } else {
        setHasValidSession(false);
      }
    } else {
      setHasValidSession(false);
      localStorage.removeItem("employee");
      localStorage.removeItem("session_expiry");
    }
    
    if (id) {
      fetchTask();
    }
  }, [id]);

  const fetchTask = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          employee:employees!tasks_assigned_to_fkey (name, phone),
          department:departments (name)
        `)
        .eq("id", id)
        .single();

      if (error || !data) {
        showError("Task not found");
        return;
      }

      // Check if task is completed
      if (data.status !== "completed") {
        showError("This task is not completed yet");
        return;
      }

      // Check if task is already approved
      if (data.approved_at) {
        showError("This task has already been reviewed");
        return;
      }

      setTask(data);
    } catch (error) {
      console.error("Error fetching task:", error);
      showError("Failed to fetch task details");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!task || !currentUser) return;

    setProcessing(true);
    try {
      // Update task to approved
      const { error: taskError } = await supabase
        .from("tasks")
        .update({
          approved_by: currentUser.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", task.id);

      if (taskError) {
        showError("Failed to approve task");
        return;
      }

      // Send WhatsApp notification to employee
      if (task.assigned_to) {
        await notifyEmployeeTaskApproved(
          task.title,
          task.assigned_to,
          currentUser.name || "Department Head",
          task.id
        );
      }

      showSuccess("Task approved successfully!");
      
      // Redirect after 2 seconds
      setTimeout(() => {
        if (currentUser.role === "department_head") {
          navigate("/department-head");
        } else {
          navigate("/admin");
        }
      }, 2000);
    } catch (error) {
      console.error("Error approving task:", error);
      showError("Failed to approve task");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!task || !currentUser) return;

    if (!rejectionReason.trim()) {
      showError("Please provide a reason for rejection");
      return;
    }

    setProcessing(true);
    try {
      // Update task back to in_progress with rejection note
      const { error: taskError } = await supabase
        .from("tasks")
        .update({
          status: "in_progress",
          rejection_reason: rejectionReason,
          rejected_by: currentUser.id,
          rejected_at: new Date().toISOString(),
        })
        .eq("id", task.id);

      if (taskError) {
        showError("Failed to reject task");
        return;
      }

      // Send WhatsApp notification to employee
      if (task.assigned_to) {
        await notifyEmployeeTaskRejected(
          task.title,
          task.assigned_to,
          currentUser.name || "Department Head",
          rejectionReason,
          task.id
        );
      }

      showSuccess("Task rejected. Employee has been notified.");
      
      // Redirect after 2 seconds
      setTimeout(() => {
        if (currentUser.role === "department_head") {
          navigate("/department-head");
        } else {
          navigate("/admin");
        }
      }, 2000);
    } catch (error) {
      console.error("Error rejecting task:", error);
      showError("Failed to reject task");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading task...</p>
        </div>
      </div>
    );
  }

  if (!hasValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <Card className="max-w-md w-full p-6 space-y-4">
          <div className="text-center space-y-2">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Session Expired</h2>
            <p className="text-muted-foreground">
              Your session has expired. Please log in to continue.
            </p>
          </div>
          <Button 
            onClick={() => navigate("/login")} 
            className="w-full"
          >
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Task Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This task may have been deleted or you don't have permission to view it.
          </p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </Card>
      </div>
    );
  }

  const timeSpent = task.started_at && task.completed_at
    ? differenceInMinutes(new Date(task.completed_at), new Date(task.started_at))
    : 0;

  return (
    <div className="min-h-screen bg-gradient-subtle p-4">
      <div className="max-w-3xl mx-auto space-y-6 py-6">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-2">{task.title}</h1>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={
                    task.priority === 'urgent' ? 'destructive' :
                    task.priority === 'high' ? 'destructive' :
                    task.priority === 'medium' ? 'default' : 'secondary'
                  }>
                    {task.priority}
                  </Badge>
                  <Badge variant="default">
                    {task.status}
                  </Badge>
                </div>
              </div>
            </div>

            {task.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground">{task.description}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              {task.employee && (
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Employee</p>
                    <p className="font-medium">{task.employee.name}</p>
                  </div>
                </div>
              )}

              {task.department && (
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">{task.department.name}</p>
                  </div>
                </div>
              )}

              {task.completed_at && (
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Completed At</p>
                    <p className="font-medium">{format(new Date(task.completed_at), "PPpp")}</p>
                  </div>
                </div>
              )}

              {timeSpent > 0 && (
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Time Spent</p>
                    <p className="font-medium">
                      {Math.floor(timeSpent / 60)}h {timeSpent % 60}m
                    </p>
                  </div>
                </div>
              )}

              {task.location_address && (
                <div className="flex items-center gap-3 md:col-span-2">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{task.location_address}</p>
                  </div>
                </div>
              )}
            </div>

            {task.completion_photo_url && (
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <Camera className="h-5 w-5" />
                  <h3 className="font-semibold">Completion Photo</h3>
                </div>
                <img
                  src={task.completion_photo_url}
                  alt="Task completion"
                  className="rounded-lg w-full max-h-96 object-contain border"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Action Buttons - Always show both if user has valid session */}
        {hasValidSession && currentUser && (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Review Task</h2>
            <p className="text-muted-foreground mb-6">
              Please review the task completion proof and choose an action below.
            </p>
            
            <div className="space-y-4">
              {/* Approve Button */}
              <div className="flex gap-3">
                <Button
                  onClick={handleApprove}
                  disabled={processing}
                  className="flex-1 bg-green-500 hover:bg-green-600"
                  size="lg"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve Task
                    </>
                  )}
                </Button>
              </div>

              {/* Reject Button */}
              {!showRejectDialog ? (
                <Button
                  onClick={() => setShowRejectDialog(true)}
                  disabled={processing}
                  variant="destructive"
                  className="w-full"
                  size="lg"
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject Task
                </Button>
              ) : (
                <Card className="p-4 border-destructive/50 bg-destructive/5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-destructive">
                    <X className="h-5 w-5" />
                    Reject Task
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="reason">Rejection Reason *</Label>
                      <Textarea
                        id="reason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Explain why this task is being rejected..."
                        rows={4}
                        className="mt-2"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleReject}
                        disabled={processing || !rejectionReason.trim()}
                        variant="destructive"
                        className="flex-1"
                      >
                        {processing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Rejecting...
                          </>
                        ) : (
                          <>
                            <X className="h-4 w-4 mr-2" />
                            Confirm Rejection
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowRejectDialog(false);
                          setRejectionReason("");
                        }}
                        variant="outline"
                        disabled={processing}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TaskAction;
