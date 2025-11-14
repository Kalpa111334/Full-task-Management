import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { showSuccess, showError, showConfirm } from "@/lib/sweetalert";
import { Plus, MapPin, Clock, User, Check, ChevronsUpDown, Power, PowerOff, Trash2, Paperclip, X, Repeat, Search, Filter, Building2, Play, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn, sortTasksByStatus, isTaskNewToday } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { notifyTaskAssigned, notifyTaskDeactivated, notifyTaskActivated, notifyTaskDeleted } from "@/lib/notificationService";
import { notifyDeptHeadTaskAssigned } from "@/lib/whatsappService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline?: string | null;
  start_date?: string | null;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  location_address: string | null;
  assigned_to: string | null;
  assigned_by?: string | null;
  is_active: boolean;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  completion_photo_url?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  department_id?: string | null;
  employee?: { name: string };
  department?: { name: string };
}

interface Department {
  id: string;
  name: string;
}

interface DepartmentHead {
  id: string;
  name: string;
  email: string;
  role: string;
  department_id: string;
  departments?: { name: string } | null;
}

interface AdminTaskAssignmentProps {
  adminId: string;
}

const AdminTaskAssignment = ({ adminId }: AdminTaskAssignmentProps) => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentHeads, setDepartmentHeads] = useState<DepartmentHead[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [openDeptHeadDropdown, setOpenDeptHeadDropdown] = useState(false);
  const [adminDepartmentIds, setAdminDepartmentIds] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("all");
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assigned_to: "",
    department_id: "",
    priority: "medium",
    task_type: "normal",
    location_address: "",
    start_date: new Date() as Date,
    start_time: "09:00" as string,
    end_date: new Date() as Date,
    end_time: "17:00" as string,
    is_required: false,
    attachment: null as File | null,
    is_recurring: false,
    recurrence_type: "daily" as "daily" | "weekly" | "monthly" | null,
    recurrence_day: undefined as number | undefined,
    recurrence_end_date: undefined as Date | undefined,
  });

  useEffect(() => {
    fetchAdminDepartments();
  }, [adminId]);

  useEffect(() => {
    if (adminDepartmentIds.length > 0 || !adminId || isSuperAdmin) {
      fetchTasks();
      fetchDepartmentHeads();
      fetchDepartments();
    }

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
  }, [adminDepartmentIds, isSuperAdmin]);

  const fetchAdminDepartments = async () => {
    if (!adminId) {
      setAdminDepartmentIds([]);
      return;
    }

    // Check if user is super_admin
    const { data: employeeData } = await supabase
      .from("employees")
      .select("role")
      .eq("id", adminId)
      .single();

    if (employeeData?.role === "super_admin") {
      // Super admin sees all tasks
      setIsSuperAdmin(true);
      setAdminDepartmentIds([]);
      return;
    }

    setIsSuperAdmin(false);
    // Fetch admin's assigned departments
    const { data, error } = await supabase
      .from("admin_departments")
      .select("department_id")
      .eq("admin_id", adminId);

    if (error) {
      console.error("Failed to fetch admin departments:", error);
      setAdminDepartmentIds([]);
      return;
    }

    setAdminDepartmentIds((data || []).map(ad => ad.department_id));
  };

  const fetchTasks = async () => {
    let query = supabase
      .from("tasks")
      .select(`
        *,
        employee:employees!tasks_assigned_to_fkey (name),
        department:departments (name)
      `);

    // Filter by admin's departments if not super admin
    if (adminId && adminDepartmentIds.length > 0) {
      query = query.in("department_id", adminDepartmentIds);
    }

    const { data, error } = await query;

    if (error) {
      showError("Failed to fetch tasks");
      return;
    }

    // Sort tasks: pending/in_progress at top, completed at bottom
    const sortedTasks = sortTasksByStatus(data || []);
    setTasks(sortedTasks);
  };

  const fetchDepartments = async () => {
    let query = supabase
      .from("departments")
      .select("id, name")
      .order("name");

    // Filter by admin's departments if not super admin
    if (adminId && adminDepartmentIds.length > 0 && !isSuperAdmin) {
      query = query.in("id", adminDepartmentIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch departments:", error);
      return;
    }

    setDepartments(data || []);
  };

  const fetchDepartmentHeads = async () => {
    // Check if user is super admin
    const employeeData = localStorage.getItem("employee");
    const isSuperAdmin = employeeData && JSON.parse(employeeData).role === "super_admin";

    let query = supabase
      .from("employees")
      .select(`
        id,
        name,
        email,
        role,
        department_id,
        departments:departments(name)
      `)
      .eq("is_active", true)
      .order("name");

    // Super admin sees all employees, admins, and department heads
    if (isSuperAdmin) {
      // No filter - show everyone
    } else {
      // Regular admin - filter by role and departments
      query = query.eq("role", "department_head").not("department_id", "is", null);
      
      // Filter by admin's departments
      if (adminId && adminDepartmentIds.length > 0) {
        query = query.in("department_id", adminDepartmentIds);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch department heads:", error);
      showError("Failed to fetch employees");
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

    // Validate recurring task settings
    if (formData.is_recurring) {
      if (!formData.recurrence_type) {
        showError("Please select a recurrence frequency");
        return;
      }
      if ((formData.recurrence_type === "weekly" || formData.recurrence_type === "monthly") && 
          formData.recurrence_day === undefined) {
        showError(`Please select a ${formData.recurrence_type === "weekly" ? "day of week" : "day of month"} for recurring task`);
        return;
      }
    }

    // Get admin name for notification
    const { data: adminData } = await supabase
      .from("employees")
      .select("name")
      .eq("id", adminId)
      .single();

    // Upload attachment if present
    let attachmentUrl: string | null = null;
    if (formData.attachment) {
      try {
        const fileExt = formData.attachment.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `task-attachments/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(filePath, formData.attachment, {
            upsert: false,
            cacheControl: '3600',
          });

        if (uploadError) {
          // If bucket doesn't exist, create it and try again (for first time)
          if (uploadError.message.includes('Bucket not found')) {
            // Try creating bucket (this will fail if no permissions, but we try)
            await supabase.storage.createBucket('task-attachments', { public: true });
            // Retry upload
            const { error: retryError } = await supabase.storage
              .from('task-attachments')
              .upload(filePath, formData.attachment);
            
            if (retryError) {
              console.error('Attachment upload failed:', retryError);
              showError('Failed to upload attachment. Please try again.');
              return;
            }
          } else {
            console.error('Attachment upload failed:', uploadError);
            showError('Failed to upload attachment. Please try again.');
            return;
          }
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('task-attachments')
          .getPublicUrl(filePath);
        
        attachmentUrl = urlData?.publicUrl || null;
      } catch (attachError) {
        console.error('Attachment error:', attachError);
        showError('Failed to process attachment. Please try again.');
        return;
      }
    }

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
      start_date: formData.start_date?.toISOString() || null,
      start_time: formData.start_time,
      end_date: formData.end_date?.toISOString() || null,
      end_time: formData.end_time,
      status: "pending",
      is_recurring: formData.is_recurring || false,
      recurrence_type: formData.is_recurring && formData.recurrence_type ? formData.recurrence_type : null,
      recurrence_day: formData.is_recurring && formData.recurrence_day !== undefined ? formData.recurrence_day : null,
      recurrence_end_date: formData.is_recurring && formData.recurrence_end_date ? formData.recurrence_end_date.toISOString() : null,
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
          const taskId = retryTask[0]?.id;
          // Send push notification
          await notifyTaskAssigned(formData.title, formData.assigned_to, adminName);
          // Send WhatsApp notification with start and end dates/times
          await notifyDeptHeadTaskAssigned(
            formData.title, 
            formData.assigned_to, 
            adminName, 
            taskId,
            formData.start_time,
            formData.end_time,
            formData.start_date ? format(formData.start_date, "MMM dd, yyyy") : undefined,
            formData.end_date ? format(formData.end_date, "MMM dd, yyyy") : undefined
          );
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

    // Create attachment record if attachment was uploaded
    if (newTask && newTask.length > 0 && attachmentUrl && formData.attachment) {
      const taskId = newTask[0]?.id;
      await supabase.from("task_attachments").insert([
        {
          task_id: taskId,
          file_name: formData.attachment.name,
          file_url: attachmentUrl,
          uploaded_by: adminId,
        },
      ]);
    }

    // Send push notification and WhatsApp notification
    if (newTask && newTask.length > 0) {
      const adminName = adminData?.name || "Admin";
      const taskId = newTask[0]?.id;
      // Send push notification
      await notifyTaskAssigned(formData.title, formData.assigned_to, adminName);
      // Send WhatsApp notification with start and end dates/times
      await notifyDeptHeadTaskAssigned(
        formData.title, 
        formData.assigned_to, 
        adminName, 
        taskId,
        formData.start_time,
        formData.end_time,
        formData.start_date ? format(formData.start_date, "MMM dd, yyyy") : undefined,
        formData.end_date ? format(formData.end_date, "MMM dd, yyyy") : undefined
      );
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
      start_date: new Date(),
      start_time: "09:00",
      end_date: new Date(),
      end_time: "17:00",
      is_required: false,
      attachment: null,
      is_recurring: false,
      recurrence_type: "daily",
      recurrence_day: undefined,
      recurrence_end_date: undefined,
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

  // Filter and categorize tasks
  const filteredTasks = tasks.filter(task => {
    // Search filter
    const matchesSearch = searchQuery === "" || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.employee?.name.toLowerCase().includes(searchQuery.toLowerCase());

    // Department filter
    const matchesDepartment = selectedDepartment === "all" || 
      task.department_id === selectedDepartment;

    return matchesSearch && matchesDepartment;
  });

  // Categorize tasks
  const pendingTasks = filteredTasks.filter(t => t.status === "pending");
  const inProgressTasks = filteredTasks.filter(t => t.status === "in_progress");
  const completedTasks = filteredTasks.filter(t => t.status === "completed");
  const newTodayTasks = filteredTasks.filter(t => isTaskNewToday(t.created_at) && t.status === "pending");

  // Get task counts
  const taskCounts = {
    all: filteredTasks.length,
    pending: pendingTasks.length,
    in_progress: inProgressTasks.length,
    completed: completedTasks.length,
    new: newTodayTasks.length,
  };

  // Get tasks to display based on active tab
  const getTasksForTab = () => {
    switch (activeTab) {
      case "pending":
        return pendingTasks;
      case "in_progress":
        return inProgressTasks;
      case "completed":
        return completedTasks;
      case "new":
        return newTodayTasks;
      default:
        return filteredTasks;
    }
  };

  const tasksToDisplay = getTasksForTab();

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-4 mb-6">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold">Task Assignment</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage and assign tasks efficiently</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary w-full sm:w-auto" size="sm">
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              Assign Task
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
                <Label htmlFor="assigned_to">Assign to Employee *</Label>
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
                            const employee = departmentHeads.find((d) => d.id === formData.assigned_to);
                            const roleLabel = employee?.role === "super_admin" ? "Super Admin" :
                                            employee?.role === "admin" ? "Admin" :
                                            employee?.role === "department_head" ? "Dept Head" : "Employee";
                            return employee ? `${employee.name} (${roleLabel}) | ${employee.departments?.name || "No Department"}` : "Select employee";
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
                          {departmentHeads.map((employee) => {
                            const roleLabel = employee.role === "super_admin" ? "Super Admin" :
                                            employee.role === "admin" ? "Admin" :
                                            employee.role === "department_head" ? "Dept Head" : "Employee";
                            return (
                              <CommandItem
                                key={employee.id}
                                value={`${employee.name} ${roleLabel} ${employee.departments?.name || ""}`}
                                onSelect={() => {
                                  setFormData({ 
                                    ...formData, 
                                    assigned_to: employee.id,
                                    department_id: employee.department_id 
                                  });
                                  setOpenDeptHeadDropdown(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.assigned_to === employee.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{employee.name} ({roleLabel})</span>
                                  <span className="text-xs text-muted-foreground">
                                    {employee.departments?.name || "No Department"}
                                  </span>
                                </div>
                              </CommandItem>
                            );
                          })}
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.start_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.start_date ? format(formData.start_date, "PPP") : "Pick start date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.start_date}
                          onSelect={(date) => setFormData({ ...formData, start_date: date })}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="start_time">Start Time *</Label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="start_time"
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        className="flex-1"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>End Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.end_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.end_date ? format(formData.end_date, "PPP") : "Pick end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.end_date}
                          onSelect={(date) => setFormData({ ...formData, end_date: date })}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_time">End Time *</Label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="end_time"
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        className="flex-1"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Attachment Upload */}
              <div className="space-y-2">
                <Label htmlFor="attachment">Attachment (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="attachment"
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) { // 10MB limit
                          showError("File size must be less than 10MB");
                          return;
                        }
                        setFormData({ ...formData, attachment: file });
                      }
                    }}
                    className="flex-1"
                  />
                  {formData.attachment && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, attachment: null })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {formData.attachment && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    {formData.attachment.name} ({(formData.attachment.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              {/* Recurring Task Options */}
              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_recurring"
                    checked={formData.is_recurring}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked as boolean })}
                  />
                  <Label htmlFor="is_recurring" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                    <Repeat className="h-4 w-4" />
                    Make this a recurring task
                  </Label>
                </div>

                {formData.is_recurring && (
                  <div className="space-y-3 pl-6 border-l-2">
                    <div className="space-y-2">
                      <Label htmlFor="recurrence_type">Repeat Frequency *</Label>
                      <Select
                        value={formData.recurrence_type || "daily"}
                        onValueChange={(value) => setFormData({ ...formData, recurrence_type: value as "daily" | "weekly" | "monthly" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.recurrence_type === "weekly" && (
                      <div className="space-y-2">
                        <Label htmlFor="recurrence_day">Day of Week *</Label>
                        <Select
                          value={formData.recurrence_day?.toString() || "0"}
                          onValueChange={(value) => setFormData({ ...formData, recurrence_day: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Sunday</SelectItem>
                            <SelectItem value="1">Monday</SelectItem>
                            <SelectItem value="2">Tuesday</SelectItem>
                            <SelectItem value="3">Wednesday</SelectItem>
                            <SelectItem value="4">Thursday</SelectItem>
                            <SelectItem value="5">Friday</SelectItem>
                            <SelectItem value="6">Saturday</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {formData.recurrence_type === "monthly" && (
                      <div className="space-y-2">
                        <Label htmlFor="recurrence_day">Day of Month * (1-31)</Label>
                        <Input
                          id="recurrence_day"
                          type="number"
                          min="1"
                          max="31"
                          value={formData.recurrence_day || ""}
                          onChange={(e) => {
                            const day = parseInt(e.target.value);
                            if (day >= 1 && day <= 31) {
                              setFormData({ ...formData, recurrence_day: day });
                            }
                          }}
                          placeholder="e.g., 1 (first day of month)"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>End Date (Optional)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.recurrence_end_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.recurrence_end_date ? format(formData.recurrence_end_date, "PPP") : "No end date (repeat indefinitely)"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.recurrence_end_date}
                            onSelect={(date) => setFormData({ ...formData, recurrence_end_date: date })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}
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

      {/* Filters Section */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks by title, description, or employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Department Filter */}
          <div className="w-full sm:w-64">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger>
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Tabs for Task Status */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 gap-2 h-auto sm:grid-cols-3 md:grid-cols-5 lg:w-auto lg:inline-grid lg:h-10">
          <TabsTrigger value="all" className="relative text-xs sm:text-sm flex-col sm:flex-row gap-1 sm:gap-0 h-auto sm:h-10 py-2 sm:py-0">
            <span>All</span>
            <Badge variant="secondary" className="sm:ml-2 h-4 sm:h-5 min-w-4 sm:min-w-5 px-1 text-[10px] sm:text-xs">
              {taskCounts.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="new" className="relative text-xs sm:text-sm flex-col sm:flex-row gap-1 sm:gap-0 h-auto sm:h-10 py-2 sm:py-0">
            <span className="whitespace-nowrap">New</span>
            <Badge variant="secondary" className="sm:ml-2 h-4 sm:h-5 min-w-4 sm:min-w-5 px-1 text-[10px] sm:text-xs bg-primary/20 text-primary">
              {taskCounts.new}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pending" className="relative text-xs sm:text-sm flex-col sm:flex-row gap-1 sm:gap-0 h-auto sm:h-10 py-2 sm:py-0">
            <span>Pending</span>
            <Badge variant="secondary" className="sm:ml-2 h-4 sm:h-5 min-w-4 sm:min-w-5 px-1 text-[10px] sm:text-xs bg-warning/20 text-warning">
              {taskCounts.pending}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="relative text-xs sm:text-sm flex-col sm:flex-row gap-1 sm:gap-0 h-auto sm:h-10 py-2 sm:py-0">
            <span className="whitespace-nowrap">Progress</span>
            <Badge variant="secondary" className="sm:ml-2 h-4 sm:h-5 min-w-4 sm:min-w-5 px-1 text-[10px] sm:text-xs bg-blue-500/20 text-blue-600">
              {taskCounts.in_progress}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="relative text-xs sm:text-sm flex-col sm:flex-row gap-1 sm:gap-0 h-auto sm:h-10 py-2 sm:py-0 col-span-2 sm:col-span-1">
            <span>Done</span>
            <Badge variant="secondary" className="sm:ml-2 h-4 sm:h-5 min-w-4 sm:min-w-5 px-1 text-[10px] sm:text-xs bg-success/20 text-success">
              {taskCounts.completed}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {tasksToDisplay.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                {searchQuery || selectedDepartment !== "all" 
                  ? "No tasks match your filters. Try adjusting your search or filters."
                  : `No ${activeTab === "all" ? "" : activeTab.replace("_", " ")} tasks found.`}
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {tasksToDisplay.map((task) => {
                const isNewToday = isTaskNewToday(task.created_at);
                return (
                  <Card 
                    key={task.id} 
                    className={`p-3 sm:p-4 hover:shadow-lg transition-all animate-fade-in cursor-pointer ${
                      isNewToday ? "border-l-4 border-l-primary bg-primary/5" : ""
                    } ${task.status === "completed" ? "opacity-75" : ""}`}
                    onClick={() => navigate(`/task/${task.id}`)}
                  >
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
                          <Building2 className="h-4 w-4" />
                          <span>{task.department.name}</span>
                        </div>
                      )}
                      {task.location_address && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate">{task.location_address}</span>
                        </div>
                      )}
                      {task.start_date && task.end_date && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>
                            {format(new Date(task.start_date), "MMM dd")} {task.start_time} - {format(new Date(task.end_date), "MMM dd")} {task.end_time}
                          </span>
                        </div>
                      )}
                      {task.started_at && (
                        <div className="flex items-center gap-2 text-blue-600">
                          <Play className="h-4 w-4" />
                          <span className="text-xs">
                            Started: {format(new Date(task.started_at), "MMM dd, HH:mm")}
                          </span>
                        </div>
                      )}
                      {task.completed_at && (
                        <div className="flex items-center gap-2 text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs">
                            Completed: {format(new Date(task.completed_at), "MMM dd, HH:mm")}
                          </span>
                        </div>
                      )}
                    </div>

                    {task.completion_photo_url && (
                      <div className="mb-3 p-2 bg-success/10 border border-success/20 rounded-lg">
                        <p className="text-xs text-success font-medium flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Has completion proof photo - Click to view
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={task.is_active ? "outline" : "default"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(task.id, task.is_active);
                        }}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(task.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {isNewToday && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                        <span className="inline-block h-1.5 w-1.5 bg-primary rounded-full animate-pulse"></span>
                        New Today
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminTaskAssignment;
