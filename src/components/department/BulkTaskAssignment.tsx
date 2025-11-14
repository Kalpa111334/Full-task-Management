import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess, showError } from "@/lib/sweetalert";
import { Users, Plus, UserCheck } from "lucide-react";
import { notifyBulkTasksAssigned } from "@/lib/notificationService";
import { notifyBulkEmployeeTasksAssigned } from "@/lib/whatsappService";

interface Employee {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
}

interface BulkTaskAssignmentProps {
  departmentId: string;
  assignedBy: string;
}

const BulkTaskAssignment = ({ departmentId, assignedBy }: BulkTaskAssignmentProps) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    location_address: "",
    location_lat: null as number | null,
    location_lng: null as number | null,
    deadline: "",
  });

  useEffect(() => {
    fetchEmployees();
  }, [departmentId]);

  const fetchEmployees = async () => {
    let query = supabase
      .from("employees")
      .select("*")
      .eq("is_active", true)
      .eq("role", "employee");

    // Only filter by department_id if it's not null
    if (departmentId) {
      query = query.eq("department_id", departmentId);
    }

    const { data, error } = await query.order("name");

    if (error) {
      console.error("Error loading employees:", error);
      showError("Failed to load employees");
      return;
    }
    setEmployees(data || []);
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const toggleAll = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map(e => e.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedEmployees.length === 0) {
      showError("Please select at least one employee");
      return;
    }

    if (!formData.title.trim()) {
      showError("Please enter a task title");
      return;
    }

    const tasks = selectedEmployees.map(employeeId => ({
      title: formData.title,
      description: formData.description,
      assigned_to: employeeId,
      assigned_by: assignedBy,
      department_id: departmentId,
      priority: formData.priority as "low" | "medium" | "high" | "urgent",
      location_address: formData.location_address || null,
      location_lat: formData.location_lat,
      location_lng: formData.location_lng,
      deadline: formData.deadline || null,
      status: "pending" as "pending",
    }));

    const { error, data: newTasks } = await supabase.from("tasks").insert(tasks).select();

    if (error) {
      showError("Failed to create tasks");
      return;
    }

    showSuccess(`Successfully assigned task to ${selectedEmployees.length} employee(s)`);
    
    // Get assigner name for notifications
    const { data: assignerData } = await supabase
      .from("employees")
      .select("name")
      .eq("id", assignedBy)
      .single();
    
    const assignerName = assignerData?.name || "Department Head";
    
    // Get task IDs for WhatsApp links
    const taskIds = newTasks ? newTasks.map(task => task.id) : [];
    
    // Send push notifications
    await notifyBulkTasksAssigned(formData.title, selectedEmployees, assignerName);
    
    // Send WhatsApp notifications
    await notifyBulkEmployeeTasksAssigned(formData.title, selectedEmployees, assignerName, 1, taskIds);
    
    setShowDialog(false);
    setSelectedEmployees([]);
    setFormData({
      title: "",
      description: "",
      priority: "medium",
      location_address: "",
      location_lat: null,
      location_lng: null,
      deadline: "",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Team Members
          </h2>
          <p className="text-muted-foreground mt-1">
            Select employees and assign tasks in bulk
          </p>
        </div>
        <Button
          onClick={() => setShowDialog(true)}
          disabled={selectedEmployees.length === 0}
          className="bg-gradient-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Assign Task to Selected ({selectedEmployees.length})
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedEmployees.length === employees.length && employees.length > 0}
              onCheckedChange={toggleAll}
            />
            <Label className="font-medium">Select All ({employees.length})</Label>
          </div>
          {selectedEmployees.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedEmployees.length} selected
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((employee) => (
            <Card
              key={employee.id}
              className={`p-4 cursor-pointer transition-all ${
                selectedEmployees.includes(employee.id)
                  ? "border-primary bg-primary/5"
                  : "hover:border-muted-foreground/50"
              }`}
              onClick={() => toggleEmployee(employee.id)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedEmployees.includes(employee.id)}
                  onCheckedChange={() => toggleEmployee(employee.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary flex-shrink-0" />
                    <h3 className="font-medium truncate">{employee.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {employee.email}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {employees.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No employees found in this department
          </div>
        )}
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Task to {selectedEmployees.length} Employee(s)</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter task title"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter task description"
                rows={4}
              />
            </div>

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
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location_address}
                onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                placeholder="Enter task location"
              />
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

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1 bg-gradient-primary">
                Create & Assign Tasks
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BulkTaskAssignment;
