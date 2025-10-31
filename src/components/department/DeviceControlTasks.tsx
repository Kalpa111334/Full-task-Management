import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { showSuccess, showError } from "@/lib/sweetalert";
import { Users, Plus, CheckCircle2, Clock, Timer, Play, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  status: string;
  priority: string;
  deadline: string | null;
  created_at: string;
  employee: {
    name: string;
  } | null;
}

interface DeviceControlTasksProps {
  departmentId: string;
  departmentName: string;
  departmentHeadId: string;
}

const DeviceControlTasks = ({ departmentId, departmentName, departmentHeadId }: DeviceControlTasksProps) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [openEmployeeDropdown, setOpenEmployeeDropdown] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    deadline: "",
  });

  useEffect(() => {
    fetchEmployees();
    fetchTasks();

    const channel = supabase
      .channel("device-control-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        fetchTasks();
      })
      .subscribe();

    // Update current time every 30 seconds for more accurate countdown
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Update every 30 seconds

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timeInterval);
    };
  }, [departmentId]);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("department_id", departmentId)
      .eq("is_active", true)
      .eq("role", "employee")
      .order("name");

    if (error) {
      showError("Failed to load employees");
      return;
    }

    setEmployees(data || []);
  };

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*, employee:employees!tasks_assigned_to_fkey(name)")
      .eq("department_id", departmentId)
      .eq("task_type", "location_based")
      .order("created_at", { ascending: false });

    if (error) {
      showError("Failed to load tasks");
      return;
    }

    setTasks(data || []);
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const toggleAll = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map((emp) => emp.id));
    }
  };

  const handleCreateTasks = async () => {
    if (selectedEmployees.length === 0) {
      showError("Please select at least one employee");
      return;
    }

    if (!formData.title.trim()) {
      showError("Please enter a task title");
      return;
    }

    const tasksToCreate = selectedEmployees.map((employeeId) => ({
      title: formData.title,
      description: formData.description || null,
      priority: formData.priority as "low" | "medium" | "high" | "urgent",
      deadline: formData.deadline || null,
      assigned_to: employeeId,
      assigned_by: departmentHeadId,
      department_id: departmentId,
      task_type: "location_based",
      status: "pending" as const,
    }));

    const { error } = await supabase.from("tasks").insert(tasksToCreate);

    if (error) {
      showError("Failed to create tasks");
      return;
    }

    showSuccess(`Successfully created ${tasksToCreate.length} device control task(s)`);
    setShowCreateDialog(false);
    setSelectedEmployees([]);
    setFormData({
      title: "",
      description: "",
      priority: "medium",
      deadline: "",
    });
    fetchTasks();
  };

  const handleStartTask = async (taskId: string) => {
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

    showSuccess("Task started successfully");
    fetchTasks();
  };

  const handleCompleteTask = async (taskId: string) => {
    // Update task to completed
    const { error: taskError } = await supabase
      .from("tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        approved_by: departmentHeadId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (taskError) {
      showError("Failed to complete task");
      return;
    }

    // Create verification request for admin
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const { error: verificationError } = await supabase
        .from("task_verification_requests")
        .insert({
          task_id: taskId,
          requested_by: departmentHeadId,
          status: "pending",
        });

      if (verificationError) {
        console.error("Failed to create verification request:", verificationError);
      }
    }

    showSuccess("Task completed and sent for admin verification");
    fetchTasks();
  };

  const getTimeRemaining = (deadline: string | null) => {
    if (!deadline) return null;
    
    try {
      // Parse deadline - handle both ISO string and datetime-local format
      let deadlineTime: Date;
      if (deadline.includes('T')) {
        // ISO format or datetime-local format
        deadlineTime = new Date(deadline);
      } else {
        // Handle other formats
        deadlineTime = new Date(deadline);
      }
      
      const now = currentTime.getTime();
      const deadlineTimestamp = deadlineTime.getTime();
      const timeDiff = deadlineTimestamp - now;
      
      if (timeDiff <= 0) return "Overdue";
      
      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) return `${days}d ${hours}h`;
      if (hours > 0) return `${hours}h ${minutes}m`;
      if (minutes > 0) return `${minutes}m`;
      return "Less than 1m";
    } catch (error) {
      console.error("Error parsing deadline:", error);
      return "Invalid date";
    }
  };

  const getTimeRemainingColor = (deadline: string | null) => {
    if (!deadline) return "text-muted-foreground";
    
    try {
      let deadlineTime: Date;
      if (deadline.includes('T')) {
        deadlineTime = new Date(deadline);
      } else {
        deadlineTime = new Date(deadline);
      }
      
      const now = currentTime.getTime();
      const deadlineTimestamp = deadlineTime.getTime();
      const timeDiff = deadlineTimestamp - now;
      
      if (timeDiff <= 0) return "text-destructive";
      if (timeDiff <= 60 * 60 * 1000) return "text-destructive"; // 1 hour
      if (timeDiff <= 24 * 60 * 60 * 1000) return "text-warning"; // 1 day
      return "text-muted-foreground";
    } catch (error) {
      console.error("Error parsing deadline:", error);
      return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{departmentName}</h2>
          <p className="text-muted-foreground">Device Control Tasks</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="bg-gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          Create Task
        </Button>
      </div>

      {/* Active Tasks */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Active Tasks</h3>
        <div className="grid gap-4">
          {tasks.filter((t) => t.status !== "completed").map((task) => (
            <Card key={task.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold">{task.title}</h4>
                    <Badge variant="outline">
                      {task.status.replace("_", " ")}
                    </Badge>
                  </div>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{task.employee?.name || "Unknown"}</span>
                    </div>
                    {task.deadline && (
                      <div className="flex items-center gap-1">
                        <Timer className="h-4 w-4" />
                        <span className={getTimeRemainingColor(task.deadline)}>
                          {getTimeRemaining(task.deadline)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {task.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => handleStartTask(task.id)}
                      className="bg-primary"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start
                    </Button>
                  )}
                {task.status === "in_progress" && (
                  <Button
                    size="sm"
                    onClick={() => handleCompleteTask(task.id)}
                    className="bg-success"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Complete
                  </Button>
                )}
                </div>
              </div>
            </Card>
          ))}
          {tasks.filter((t) => t.status !== "completed").length === 0 && (
            <Card className="p-8 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No active tasks</p>
            </Card>
          )}
        </div>
      </div>

      {/* Completed Tasks */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Completed Tasks</h3>
        <div className="grid gap-4">
          {tasks.filter((t) => t.status === "completed").map((task) => (
            <Card key={task.id} className="p-4 opacity-75">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold">{task.title}</h4>
                    <Badge className="bg-success">Completed</Badge>
                  </div>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{task.employee?.name || "Unknown"}</span>
                    </div>
                    {task.deadline && (
                      <div className="flex items-center gap-1">
                        <Timer className="h-4 w-4" />
                        <span className={getTimeRemainingColor(task.deadline)}>
                          {getTimeRemaining(task.deadline)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Create Task Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Device Control Task</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Employee Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Select Employees</Label>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedEmployees.length === employees.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              
              <Popover open={openEmployeeDropdown} onOpenChange={setOpenEmployeeDropdown}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openEmployeeDropdown}
                    className="w-full justify-between"
                  >
                    {selectedEmployees.length > 0
                      ? `${selectedEmployees.length} employee(s) selected`
                      : "Search and select employees..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search employees..." />
                    <CommandList>
                      <CommandEmpty>No employees found.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((emp) => (
                          <CommandItem
                            key={emp.id}
                            value={`${emp.name} ${emp.email}`}
                            onSelect={() => toggleEmployee(emp.id)}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  selectedEmployees.includes(emp.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex-1">
                                <div className="font-medium">{emp.name}</div>
                                <div className="text-xs text-muted-foreground">{emp.email}</div>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              
              {employees.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  No employees in this department
                </p>
              )}
              
              {selectedEmployees.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedEmployees.map((empId) => {
                    const emp = employees.find((e) => e.id === empId);
                    return emp ? (
                      <Badge key={emp.id} variant="secondary" className="px-3 py-1">
                        {emp.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* Task Details */}
            <div>
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter task title"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter task description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
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

              <div>
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleCreateTasks} className="flex-1 bg-gradient-primary">
                Create & Assign Tasks
              </Button>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeviceControlTasks;
