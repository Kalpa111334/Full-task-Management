import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError } from "@/lib/sweetalert";
import { MapPin, Clock, CheckCircle2, Play, AlertCircle, Camera } from "lucide-react";
import { format } from "date-fns";
import TaskCompletion from "./TaskCompletion";
import { notifyTaskStarted } from "@/lib/notificationService";
import { sortTasksByStatus, isTaskNewToday } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  location_address: string | null;
  created_at: string;
  is_active: boolean;
}

interface EmployeeTaskListProps {
  employeeId: string;
}

const EmployeeTaskList = ({ employeeId }: EmployeeTaskListProps) => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  const isToday = (isoDate: string | null) => {
    if (!isoDate) return false;
    const d = new Date(isoDate);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  useEffect(() => {
    fetchTasks();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("employee-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employeeId]);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_to", employeeId);

    if (error) {
      showError("Failed to fetch tasks");
      return;
    }

    // Sort tasks: pending/in_progress at top, completed at bottom
    const sortedTasks = sortTasksByStatus(data || []);
    setTasks(sortedTasks);
  };

  const startTask = async (taskId: string, isActive: boolean) => {
    if (!isActive) {
      showError("This task is currently inactive and cannot be started");
      return;
    }

    // Get task details for notification
    const { data: taskData } = await supabase
      .from("tasks")
      .select("title, assigned_by")
      .eq("id", taskId)
      .single();

    const { error } = await supabase
      .from("tasks")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (error) {
      showError("Failed to start task");
      return;
    }

    showSuccess("Task started! Time tracking began.");
    
    // Send notification to supervisor
    if (taskData?.assigned_by) {
      const { data: employeeData } = await supabase
        .from("employees")
        .select("name")
        .eq("id", employeeId)
        .single();
      
      const employeeName = employeeData?.name || "Employee";
      await notifyTaskStarted(taskData.title, employeeName, taskData.assigned_by);
    }
    
    fetchTasks();
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
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  const filteredTasks = filter === "all" ? tasks : tasks.filter((task) => task.status === filter);
  const pendingTasks = filteredTasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const completedTasks = filteredTasks.filter((t) => t.status === "completed");
  
  // Separate pending tasks by whether they're new today
  const newPendingTasks = pendingTasks.filter((t) => isTaskNewToday(t.created_at));
  const otherPendingTasks = pendingTasks.filter((t) => !isTaskNewToday(t.created_at));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 mb-6">
        <h2 className="text-lg sm:text-2xl font-bold">My Tasks</h2>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-hide">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className={`${filter === "all" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
          >
            All
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
            className={`${filter === "pending" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
          >
            Pending
          </Button>
          <Button
            variant={filter === "in_progress" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("in_progress")}
            className={`${filter === "in_progress" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
          >
            In Progress
          </Button>
          <Button
            variant={filter === "completed" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("completed")}
            className={`${filter === "completed" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
          >
            Completed
          </Button>
        </div>
      </div>

      {/* New Pending Tasks (Highlighted) */}
      {newPendingTasks.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm sm:text-base font-semibold flex items-center gap-2">
              <span className="inline-block h-2 w-2 bg-primary rounded-full animate-pulse"></span>
              New Tasks Today
            </h3>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary">
              {newPendingTasks.length}
            </Badge>
          </div>
          <div className="grid gap-3 sm:gap-4">
            {newPendingTasks.map((task) => (
              <Card 
                key={task.id} 
                className="p-4 sm:p-6 hover:shadow-lg transition-all animate-fade-in border-l-4 border-l-primary cursor-pointer bg-primary/5"
                onClick={() => navigate(`/task/${task.id}`)}
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="font-semibold text-sm sm:text-lg truncate">{task.title}</h3>
                      <div className="flex gap-1 sm:gap-2">
                        <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                          {task.priority}
                        </Badge>
                        <Badge className={`${getStatusColor(task.status)} text-xs`}>
                          {task.status.replace("_", " ")}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">Today</Badge>
                      </div>
                    </div>
                    {task.description && (
                      <p className="text-xs sm:text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-3 sm:mb-4">
                  {task.location_address && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="truncate">{task.location_address}</span>
                    </div>
                  )}
                  {task.deadline && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span>Due: {format(new Date(task.deadline), "PP")}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  {task.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          startTask(task.id, task.is_active);
                        }}
                        disabled={!task.is_active}
                        className="bg-primary w-full sm:w-auto disabled:opacity-50"
                      >
                        <Play className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                        {task.is_active ? "Start Task" : "Task Inactive"}
                      </Button>
                      {!task.is_active && (
                        <p className="text-xs text-muted-foreground">
                          This task has been deactivated by management
                        </p>
                      )}
                    </>
                  )}
                  {task.status === "in_progress" && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCompletingTaskId(task.id);
                      }}
                      className="bg-success w-full sm:w-auto"
                    >
                      <Camera className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                      Complete with Photo
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Other Pending/In Progress Tasks */}
      {otherPendingTasks.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm sm:text-base font-semibold mb-2">Pending Tasks</h3>
          <div className="grid gap-3 sm:gap-4">
            {otherPendingTasks.map((task) => (
              <Card 
                key={task.id} 
                className="p-4 sm:p-6 hover:shadow-lg transition-all animate-fade-in cursor-pointer"
                onClick={() => navigate(`/task/${task.id}`)}
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="font-semibold text-sm sm:text-lg truncate">{task.title}</h3>
                      <div className="flex gap-1 sm:gap-2">
                        <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                          {task.priority}
                        </Badge>
                        <Badge className={`${getStatusColor(task.status)} text-xs`}>
                          {task.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    {task.description && (
                      <p className="text-xs sm:text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-3 sm:mb-4">
                  {task.location_address && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="truncate">{task.location_address}</span>
                    </div>
                  )}
                  {task.deadline && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span>Due: {format(new Date(task.deadline), "PP")}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  {task.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          startTask(task.id, task.is_active);
                        }}
                        disabled={!task.is_active}
                        className="bg-primary w-full sm:w-auto disabled:opacity-50"
                      >
                        <Play className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                        {task.is_active ? "Start Task" : "Task Inactive"}
                      </Button>
                      {!task.is_active && (
                        <p className="text-xs text-muted-foreground">
                          This task has been deactivated by management
                        </p>
                      )}
                    </>
                  )}
                  {task.status === "in_progress" && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCompletingTaskId(task.id);
                      }}
                      className="bg-success w-full sm:w-auto"
                    >
                      <Camera className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                      Complete with Photo
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Tasks (At Bottom) */}
      {completedTasks.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-sm sm:text-base font-semibold mb-4 text-muted-foreground">Completed Tasks</h3>
      <div className="grid gap-3 sm:gap-4">
            {completedTasks.map((task) => (
              <Card 
                key={task.id} 
                className="p-4 sm:p-6 hover:shadow-lg transition-all animate-fade-in cursor-pointer"
                onClick={() => navigate(`/task/${task.id}`)}
              >
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                  <h3 className="font-semibold text-sm sm:text-lg truncate">{task.title}</h3>
                  <div className="flex gap-1 sm:gap-2">
                    <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                      {task.priority}
                    </Badge>
                    <Badge className={`${getStatusColor(task.status)} text-xs`}>
                      {task.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                {task.description && (
                  <p className="text-xs sm:text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
                )}
              </div>
            </div>

            <div className="space-y-2 mb-3 sm:mb-4">
              {task.location_address && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">{task.location_address}</span>
                </div>
              )}
              {task.deadline && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span>Due: {format(new Date(task.deadline), "PP")}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {task.status === "pending" && (
                <>
                  <Button
                    size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          startTask(task.id, task.is_active);
                        }}
                    disabled={!task.is_active}
                    className="bg-primary w-full sm:w-auto disabled:opacity-50"
                  >
                    <Play className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    {task.is_active ? "Start Task" : "Task Inactive"}
                  </Button>
                  {!task.is_active && (
                    <p className="text-xs text-muted-foreground">
                      This task has been deactivated by management
                    </p>
                  )}
                </>
              )}
              {task.status === "in_progress" && (
                <Button
                  size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCompletingTaskId(task.id);
                      }}
                  className="bg-success w-full sm:w-auto"
                >
                  <Camera className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  Complete with Photo
                </Button>
              )}
            </div>
          </Card>
        ))}
          </div>
        </div>
      )}

        {filteredTasks.length === 0 && (
          <Card className="p-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {filter === "all" ? "No tasks assigned yet" : `No ${filter.replace("_", " ")} tasks`}
            </p>
          </Card>
        )}

      {completingTaskId && (
        <TaskCompletion
          taskId={completingTaskId}
          isOpen={!!completingTaskId}
          onClose={() => setCompletingTaskId(null)}
          onComplete={fetchTasks}
        />
      )}
    </div>
  );
};

export default EmployeeTaskList;
