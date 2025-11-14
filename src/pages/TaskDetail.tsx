import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError } from "@/lib/sweetalert";
import { MapPin, Clock, User, ArrowLeft, Play, Power, PowerOff, Trash2, Camera, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { notifyTaskStarted } from "@/lib/notificationService";
import TaskCompletion from "@/components/employee/TaskCompletion";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  assigned_to: string | null;
  assigned_by: string | null;
  is_active: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  completion_photo_url: string | null;
  employee?: { name: string } | null;
  assigned_by_employee?: { name: string } | null;
  department?: { name: string } | null;
}

const TaskDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  useEffect(() => {
    // Check session validity
    const sessionExpiry = localStorage.getItem("session_expiry");
    const now = Date.now();
    
    if (sessionExpiry && parseInt(sessionExpiry) > now) {
      setHasValidSession(true);
      const employeeData = localStorage.getItem("employee");
      if (employeeData) {
        setCurrentUser(JSON.parse(employeeData));
      }
    } else {
      setHasValidSession(false);
      // Clear expired session
      localStorage.removeItem("employee");
      localStorage.removeItem("session_expiry");
    }
    
    fetchTask();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`task-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `id=eq.${id}` }, () => {
        fetchTask();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchTask = async () => {
    if (!id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select(`
        *,
        employee:employees!tasks_assigned_to_fkey (name),
        assigned_by_employee:employees!tasks_assigned_by_fkey (name),
        department:departments (name)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      showError("Task not found");
      navigate(-1);
      return;
    }

    setTask(data);
    setLoading(false);
  };

  const handleStartTask = async () => {
    if (!task || !task.is_active) {
      showError("This task is currently inactive and cannot be started");
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    if (error) {
      showError("Failed to start task");
      return;
    }

    showSuccess("Task started successfully! Time tracking began.");
    
    // Send notification if task is assigned to an employee
    if (task.assigned_to && task.assigned_by && currentUser) {
      const employeeName = currentUser.name || "Employee";
      await notifyTaskStarted(task.title, employeeName, task.assigned_by);
    }
    
    fetchTask();
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

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-warning text-warning-foreground",
      in_progress: "bg-primary text-primary-foreground",
      completed: "bg-success text-success-foreground",
      approved: "bg-success text-success-foreground",
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading task...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Task not found</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  // Only users with valid sessions can manage tasks
  const canManageTask = hasValidSession && currentUser && (
    currentUser.role === "admin" ||
    currentUser.role === "super_admin" ||
    (currentUser.role === "department_head" && task.department?.name) ||
    (currentUser.id === task.assigned_to)
  );

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold flex-1">{task.title}</h1>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Details Card */}
            <Card className="p-4 sm:p-6">
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge className={getPriorityColor(task.priority)}>
                  {task.priority}
                </Badge>
                <Badge className={getStatusColor(task.status)}>
                  {task.status.replace("_", " ")}
                </Badge>
                <Badge variant={task.is_active ? "default" : "secondary"}>
                  {task.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>

              {task.description && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

              <div className="space-y-4">
                {task.employee && (
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Assigned To</p>
                      <p className="font-medium">{task.employee.name}</p>
                    </div>
                  </div>
                )}

                {task.assigned_by_employee && (
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Assigned By</p>
                      <p className="font-medium">{task.assigned_by_employee.name}</p>
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

                {task.location_address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-medium">{task.location_address}</p>
                      {task.location_lat && task.location_lng && (
                        <a
                          href={`https://www.google.com/maps?q=${task.location_lat},${task.location_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline mt-1"
                        >
                          Open in Google Maps
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {task.start_date && task.end_date && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Task Schedule</p>
                      <p className="font-medium">
                        {format(new Date(task.start_date), "MMM dd, yyyy")} {task.start_time} - {format(new Date(task.end_date), "MMM dd, yyyy")} {task.end_time}
                      </p>
                    </div>
                  </div>
                )}

                {task.started_at && (
                  <div className="flex items-center gap-3">
                    <Play className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Started At</p>
                      <p className="font-medium text-blue-600">{format(new Date(task.started_at), "PPpp")}</p>
                    </div>
                  </div>
                )}

                {task.completed_at && (
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div>
                      <p className="text-sm text-muted-foreground">Completed At</p>
                      <p className="font-medium text-success">{format(new Date(task.completed_at), "PPpp")}</p>
                    </div>
                  </div>
                )}

                {task.completion_photo_url && (
                  <div className="mt-6 pt-6 border-t">
                    <div className="flex items-center gap-2 mb-3">
                      <Camera className="h-5 w-5 text-success" />
                      <h3 className="font-semibold text-success">Task Completion Proof Photo</h3>
                    </div>
                    <div className="relative group">
                      <img
                        src={task.completion_photo_url}
                        alt="Task completion proof"
                        className="rounded-lg w-full h-auto object-contain border-2 border-success/20 cursor-pointer hover:border-success/40 transition-all"
                        onClick={() => {
                          const modal = document.createElement('div');
                          modal.className = 'fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4';
                          modal.onclick = () => modal.remove();
                          const img = document.createElement('img');
                          img.src = task.completion_photo_url!;
                          img.className = 'max-w-full max-h-full object-contain';
                          modal.appendChild(img);
                          document.body.appendChild(modal);
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <p className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded">
                          Click to view full size
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Photo submitted on {task.completed_at ? format(new Date(task.completed_at), "PPpp") : "Unknown date"}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Actions Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-4 sm:p-6">
              <h3 className="font-semibold mb-4">Actions</h3>
              <div className="space-y-3">
                {!hasValidSession && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive font-medium mb-1">Session Expired</p>
                    <p className="text-xs text-muted-foreground">
                      Please log in to perform actions on this task.
                    </p>
                    <Button
                      onClick={() => navigate("/login")}
                      variant="outline"
                      size="sm"
                      className="w-full mt-3"
                    >
                      Go to Login
                    </Button>
                  </div>
                )}
                
                {canManageTask && task.status === "pending" && task.is_active && (
                  <Button
                    onClick={handleStartTask}
                    className="w-full bg-primary"
                    size="lg"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Task
                  </Button>
                )}

                {canManageTask && task.status === "in_progress" && (
                  <Button
                    onClick={() => setCompletingTaskId(task.id)}
                    className="w-full bg-success"
                    size="lg"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Complete with Photo
                  </Button>
                )}

                {!task.is_active && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      This task has been deactivated by management
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t space-y-2 text-sm text-muted-foreground">
                <p>Created: {format(new Date(task.created_at), "PPpp")}</p>
                {task.id && (
                  <p className="text-xs break-all">Task ID: {task.id}</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {completingTaskId && (
        <TaskCompletion
          taskId={completingTaskId}
          isOpen={!!completingTaskId}
          onClose={() => {
            setCompletingTaskId(null);
            fetchTask();
          }}
          onComplete={() => {
            setCompletingTaskId(null);
            fetchTask();
          }}
        />
      )}
    </div>
  );
};

export default TaskDetail;

