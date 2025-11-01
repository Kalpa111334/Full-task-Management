import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { showSuccess, showError, showConfirm } from "@/lib/sweetalert";
import { Plus, MapPin, Clock, User, Check, ChevronsUpDown, Power, PowerOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { notifyTaskAssigned, notifyTaskDeactivated, notifyTaskActivated, notifyTaskDeleted } from "@/lib/notificationService";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  location_address: string | null;
  assigned_to: string | null;
  is_active: boolean;
  employee?: { name: string };
  department?: { name: string };
}

interface DepartmentHead {
  id: string;
  name: string;
  email: string;
  department_id: string;
  departments?: { name: string } | null;
}

interface AdminTaskAssignmentProps {
  adminId: string;
}

const AdminTaskAssignment = ({ adminId }: AdminTaskAssignmentProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departmentHeads, setDepartmentHeads] = useState<DepartmentHead[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [openDeptHeadDropdown, setOpenDeptHeadDropdown] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assigned_to: "",
    department_id: "",
    priority: "medium",
    task_type: "normal",
    location_address: "",
    deadline: undefined as Date | undefined,
    is_required: false,
  });

  useEffect(() => {
    fetchTasks();
    fetchDepartmentHeads();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("admin-tasks-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select(`
        *,
        employee:employees!tasks_assigned_to_fkey (name),
        department:departments (name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      showError("Failed to fetch tasks");
      return;
    }

    setTasks(data || []);
  };

  const fetchDepartmentHeads = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select(`
        id,
        name,
        email,
        department_id,
        departments (name)
      `)
      .eq("is_active", true)
      .eq("role", "department_head")
      .not("department_id", "is", null)
      .order("name");

    if (error) {
      showError("Failed to fetch department heads");
      return;
    }

    setDepartmentHeads(data || []);
  };

  const handleToggleActive = async (taskId: string, currentStatus: boolean) => {
    const action = currentStatus ? "deactivate" : "activate";
    const confirmed = await showConfirm(
      `${action === "activate" ? "Activate" : "Deactivate"} Task?`,
      `Are you sure you want to ${action} this task?`
    );

    if (!confirmed) return;

    const task = tasks.find(t => t.id === taskId);

    const { error } = await supabase
      .from("tasks")
      .update({ is_active: !currentStatus })
      .eq("id", taskId);

    if (error) {
      showError(`Failed to ${action} task`);
      return;
    }

    showSuccess(`Task ${action}d successfully`);
    
    // Notify assigned employee
    if (task?.assigned_to) {
      if (!currentStatus) {
        await notifyTaskActivated(task.title, task.assigned_to);
      } else {
        await notifyTaskDeactivated(task.title, task.assigned_to);
      }
    }
    
    fetchTasks();
  };

  const handleDeleteTask = async (taskId: string) => {
    const confirmed = await showConfirm(
      "Delete Task?",
      "Are you sure you want to permanently delete this task?"
    );

    if (!confirmed) return;

    const task = tasks.find(t => t.id === taskId);

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      showError("Failed to delete task");
      return;
    }

    showSuccess("Task deleted successfully");
    
    // Notify assigned employee
    if (task?.assigned_to) {
      await notifyTaskDeleted(task.title, task.assigned_to);
    }
    
    fetchTasks();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.assigned_to || !formData.department_id) {
      showError("Please select a department head");
      return;
    }

    // Get admin name for notification
    const { data: adminData } = await supabase
      .from("employees")
      .select("name")
      .eq("id", adminId)
      .single();

    // Build task data object
    const taskData: any = {
      title: formData.title,
      description: formData.description || null,
      assigned_to: formData.assigned_to,
      assigned_by: adminId,
      department_id: formData.department_id,
      priority: formData.priority as "low" | "medium" | "high" | "urgent",
      task_type: formData.task_type,
      location_address: formData.location_address || null,
      deadline: formData.deadline?.toISOString() || null,
      status: "pending",
    };

    // Only add is_required if the field exists (in case migration hasn't run)
    // We'll try to add it, and if it fails, retry without it
    const { error, data: newTask } = await supabase.from("tasks").insert([
      {
        ...taskData,
        is_required: formData.is_required,
      },
    ]).select();

    if (error) {
      // If error is about is_required column, try without it
      if (error.message?.includes("is_required") || error.message?.includes("column") || error.code === "42703") {
        console.warn("is_required column may not exist, trying without it:", error.message);
        const { error: retryError, data: retryTask } = await supabase.from("tasks").insert([taskData]).select();
        
        if (retryError) {
          console.error("Failed to create task:", retryError);
          showError(`Failed to create task: ${retryError.message || "Unknown error"}`);
          return;
        }
        
        // Success without is_required
        showSuccess("Task assigned to department head successfully");
        if (retryTask && retryTask.length > 0) {
          const adminName = adminData?.name || "Admin";
          await notifyTaskAssigned(formData.title, formData.assigned_to, adminName);
        }
        setIsDialogOpen(false);
        resetForm();
        fetchTasks();
        return;
      }
      
      console.error("Failed to create task:", error);
      showError(`Failed to create task: ${error.message || "Unknown error"}`);
      return;
    }

    showSuccess("Task assigned to department head successfully");

    // Send push notification
    if (newTask && newTask.length > 0) {
      const adminName = adminData?.name || "Admin";
      await notifyTaskAssigned(formData.title, formData.assigned_to, adminName);
    }

    setIsDialogOpen(false);
    resetForm();
    fetchTasks();
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      assigned_to: "",
      department_id: "",
      priority: "medium",
      task_type: "normal",
      location_address: "",
      deadline: undefined,
      is_required: false,
    });
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

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-4 mb-6">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold">Task Assignment</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Assign tasks to department heads</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary w-full sm:w-auto" size="sm">
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              Assign Task to Dept Head
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Assign Task to Department Head</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Task Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="e.g., Review team performance"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed task description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="task_type">Task Type *</Label>
                  <Select value={formData.task_type} onValueChange={(value) => setFormData({ ...formData, task_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal Task</SelectItem>
                      <SelectItem value="location_based">Location-Based Task</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority *</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assign to Department Head *</Label>
                <Popover open={openDeptHeadDropdown} onOpenChange={setOpenDeptHeadDropdown}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openDeptHeadDropdown}
                      className="w-full justify-between"
                    >
                      {formData.assigned_to
                        ? (() => {
                            const deptHead = departmentHeads.find((d) => d.id === formData.assigned_to);
                            return deptHead ? `${deptHead.name} | ${deptHead.departments?.name || "No Department"}` : "Select department head";
                          })()
                        : "Select department head"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search department heads..." />
                      <CommandList>
                        <CommandEmpty>No department head found.</CommandEmpty>
                        <CommandGroup>
                          {departmentHeads.map((deptHead) => (
                            <CommandItem
                              key={deptHead.id}
                              value={`${deptHead.name} | ${deptHead.departments?.name || "No Department"}`}
                              onSelect={() => {
                                setFormData({ 
                                  ...formData, 
                                  assigned_to: deptHead.id,
                                  department_id: deptHead.department_id 
                                });
                                setOpenDeptHeadDropdown(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.assigned_to === deptHead.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {deptHead.name} | {deptHead.departments?.name || "No Department"}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location Address</Label>
                  <Input
                    id="location"
                    value={formData.location_address}
                    onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                    placeholder="e.g., 123 Main Street"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Deadline</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.deadline && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.deadline ? format(formData.deadline, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.deadline}
                        onSelect={(date) => setFormData({ ...formData, deadline: date })}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_required"
                  checked={formData.is_required}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked as boolean })}
                />
                <Label htmlFor="is_required" className="text-sm font-normal cursor-pointer">
                  This task is required (Department Head must complete it)
                </Label>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button type="submit" className="bg-gradient-primary sm:flex-1">
                  Assign Task
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tasks Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => (
          <Card key={task.id} className="p-3 sm:p-4 hover:shadow-lg transition-all animate-fade-in">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-sm sm:text-base mb-1">{task.title}</h3>
                {task.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
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

            <div className="space-y-2 text-sm mb-3">
              {task.employee?.name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{task.employee.name}</span>
                </div>
              )}
              {task.department?.name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Dept: {task.department.name}</span>
                </div>
              )}
              {task.location_address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate">{task.location_address}</span>
                </div>
              )}
              {task.deadline && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{format(new Date(task.deadline), "MMM dd, yyyy")}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant={task.is_active ? "outline" : "default"}
                onClick={() => handleToggleActive(task.id, task.is_active)}
                className="flex-1"
              >
                {task.is_active ? (
                  <>
                    <PowerOff className="h-3 w-3 mr-1" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Power className="h-3 w-3 mr-1" />
                    Activate
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDeleteTask(task.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {tasks.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No tasks assigned yet. Create your first task to get started.</p>
        </Card>
      )}
    </div>
  );
};

export default AdminTaskAssignment;
