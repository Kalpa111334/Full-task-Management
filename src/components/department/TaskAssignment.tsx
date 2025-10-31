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
import { Plus, MapPin, Clock, User, AlertCircle, Check, ChevronsUpDown, Power, PowerOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
}

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  departments?: { name: string } | null;
}

interface TaskAssignmentProps {
  departmentId: string;
  assignedBy: string;
}

const TaskAssignment = ({ departmentId, assignedBy }: TaskAssignmentProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [openEmployeeDropdown, setOpenEmployeeDropdown] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assigned_to: "",
    priority: "medium",
    task_type: "normal",
    location_address: "",
    deadline: undefined as Date | undefined,
  });

  useEffect(() => {
    fetchTasks();
    fetchEmployees();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("tasks-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId]);

  const fetchTasks = async () => {
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
    
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      showError("Failed to fetch tasks");
      return;
    }

    setTasks(data || []);
  };

  const fetchEmployees = async () => {
    let query = supabase
      .from("employees")
      .select(`
        id,
        name,
        email,
        role,
        departments (name)
      `)
      .eq("is_active", true);

    // Filter by department if departmentId exists
    if (departmentId) {
      query = query.eq("department_id", departmentId).in("role", ["employee", "department_head"]);
    } else {
      // For unassigned tasks, show only employees without department
      query = query.is("department_id", null).in("role", ["employee", "department_head"]);
    }

    const { data, error } = await query.order("name");

    if (error) {
      showError("Failed to fetch employees");
      return;
    }

    setEmployees(data || []);
  };

  const handleToggleActive = async (taskId: string, currentStatus: boolean) => {
    const action = currentStatus ? "deactivate" : "activate";
    const confirmed = await showConfirm(
      `${action === "activate" ? "Activate" : "Deactivate"} Task?`,
      `Are you sure you want to ${action} this task? ${action === "deactivate" ? "Employees will not be able to start it." : "Employees will be able to start it."}`
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
    
    // Send notification to assigned employee
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
      "Are you sure you want to permanently delete this task? This action cannot be undone."
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

    // Get assigner name for notification
    const { data: assignerData } = await supabase
      .from("employees")
      .select("name")
      .eq("id", assignedBy)
      .single();

    const { error, data: newTask } = await supabase.from("tasks").insert([
      {
        title: formData.title,
        description: formData.description || null,
        assigned_to: formData.assigned_to || null,
        assigned_by: assignedBy,
        department_id: departmentId,
        priority: formData.priority as "low" | "medium" | "high" | "urgent",
        task_type: formData.task_type,
        location_address: formData.location_address || null,
        deadline: formData.deadline?.toISOString() || null,
        status: "pending",
      },
    ]).select();

    if (error) {
      showError("Failed to create task");
      return;
    }

    showSuccess("Task created successfully");
    
    // Send push notification if employee is assigned
    if (formData.assigned_to && formData.assigned_to !== 'unassigned' && newTask && newTask.length > 0) {
      const assignerName = assignerData?.name || "Department Head";
      await notifyTaskAssigned(formData.title, formData.assigned_to, assignerName);
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
      priority: "medium",
      task_type: "normal",
      location_address: "",
      deadline: undefined,
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
          <h2 className="text-lg sm:text-2xl font-bold">Task Management</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Assign and track tasks for your team</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary w-full sm:w-auto" size="sm">
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              Create Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Task Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="e.g., Deliver documents to client"
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
                <Label htmlFor="assigned_to">Assign To</Label>
                <Popover open={openEmployeeDropdown} onOpenChange={setOpenEmployeeDropdown}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openEmployeeDropdown}
                      className="w-full justify-between"
                    >
                      {formData.assigned_to
                        ? formData.assigned_to === "unassigned"
                          ? "Unassigned"
                          : (() => {
                              const emp = employees.find((e) => e.id === formData.assigned_to);
                              return emp ? `${emp.name} | ${emp.departments?.name || "No Department"}` : "Select employee";
                            })()
                        : "Select employee"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search employees..." />
                      <CommandList>
                        <CommandEmpty>No employee found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="unassigned"
                            onSelect={() => {
                              setFormData({ ...formData, assigned_to: "unassigned" });
                              setOpenEmployeeDropdown(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.assigned_to === "unassigned" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Unassigned
                          </CommandItem>
                          {employees.map((emp) => (
                            <CommandItem
                              key={emp.id}
                              value={`${emp.name} | ${emp.departments?.name || "No Department"}`}
                              onSelect={() => {
                                setFormData({ ...formData, assigned_to: emp.id });
                                setOpenEmployeeDropdown(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.assigned_to === emp.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {emp.name} | {emp.departments?.name || "No Department"}
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

              <div className="flex flex-col sm:flex-row gap-2">
                <Button type="submit" className="bg-gradient-primary sm:flex-1">
                  Create Task
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
              {task.location_address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate">{task.location_address}</span>
                </div>
              )}
              {task.deadline && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{format(new Date(task.deadline), "PPP")}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
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

        {tasks.length === 0 && (
          <Card className="p-12 col-span-full text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No tasks yet. Create your first task to get started.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TaskAssignment;
