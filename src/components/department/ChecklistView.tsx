import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess, showError } from "@/lib/sweetalert";
import { Users, CheckCircle2, Clock } from "lucide-react";
import { notifyEmployeeChecklistAssigned } from "@/lib/whatsappService";

interface ChecklistItem {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  completed_by_employee: { name: string } | null;
}

interface Checklist {
  id: string;
  title: string;
  description: string | null;
  assigned_to_dept_head: string | null;
  department_id: string | null;
  status: string;
  items: ChecklistItem[];
  assigned_employees: Array<{
    id: string;
    employee_id: string;
    employee: { name: string; id: string };
  }>;
}

interface Employee {
  id: string;
  name: string;
  department_id: string | null;
}

interface ChecklistViewProps {
  departmentHeadId: string;
  departmentId: string | null;
}

const ChecklistView = ({ departmentHeadId, departmentId }: ChecklistViewProps) => {
  const { id } = useParams<{ id: string }>();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (id) {
      fetchChecklist();
      fetchEmployees();
    }
  }, [id, departmentId]);

  const fetchChecklist = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("checklists")
        .select(`
          *,
          items:checklist_items(
            id,
            title,
            description,
            order_index,
            is_completed,
            completed_by,
            completed_at,
            completed_by_employee:employees!checklist_items_completed_by_fkey(name)
          ),
          assigned_employees:checklist_assignments(
            id,
            employee_id,
            employee:employees!checklist_assignments_employee_id_fkey(name, id)
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      // Sort items by order_index
      if (data?.items) {
        data.items.sort((a: ChecklistItem, b: ChecklistItem) => a.order_index - b.order_index);
      }

      setChecklist(data);
    } catch (error: any) {
      console.error("Error fetching checklist:", error);
      showError(error?.message || "Failed to fetch checklist");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    if (!departmentId) return;

    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, department_id")
        .eq("department_id", departmentId)
        .eq("role", "employee")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
      showError("Failed to fetch employees");
    }
  };

  const handleAssignToEmployee = async () => {
    if (!selectedEmployee || !id) {
      showError("Please select an employee");
      return;
    }

    setAssigning(true);
    try {
      // Check if already assigned
      const { data: existing } = await supabase
        .from("checklist_assignments")
        .select("id")
        .eq("checklist_id", id)
        .eq("employee_id", selectedEmployee)
        .single();

      if (existing) {
        showError("Checklist is already assigned to this employee");
        setAssigning(false);
        return;
      }

      // Create assignment
      const { error: assignError } = await supabase
        .from("checklist_assignments")
        .insert({
          checklist_id: id,
          employee_id: selectedEmployee,
          assigned_by: departmentHeadId,
        });

      if (assignError) throw assignError;

      // Send WhatsApp notification
      const checklistUrl = `${window.location.origin}/checklist/${id}`;
      await notifyEmployeeChecklistAssigned(
        checklist?.title || "Checklist",
        selectedEmployee,
        id,
        checklistUrl
      );

      showSuccess("Checklist assigned successfully!");
      setSelectedEmployee("");
      fetchChecklist();
    } catch (error: any) {
      console.error("Error assigning checklist:", error);
      showError(error?.message || "Failed to assign checklist");
    } finally {
      setAssigning(false);
    }
  };

  const getProgress = () => {
    if (!checklist?.items) return { completed: 0, total: 0, percentage: 0 };
    const total = checklist.items.length;
    const completed = checklist.items.filter(item => item.is_completed).length;
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Clock className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading checklist...</p>
        </div>
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Checklist not found</p>
      </div>
    );
  }

  const progress = getProgress();
  const assignedEmployeeIds = checklist.assigned_employees?.map(ae => ae.employee_id) || [];
  const availableEmployees = employees.filter(emp => !assignedEmployeeIds.includes(emp.id));

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">{checklist.title}</h2>
        {checklist.description && (
          <p className="text-muted-foreground">{checklist.description}</p>
        )}
      </div>

      {/* Progress Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Progress</p>
              <p className="text-2xl font-bold">
                {progress.completed} / {progress.total}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Completion</p>
              <p className="text-2xl font-bold">{progress.percentage}%</p>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-gradient-primary h-2 rounded-full transition-all"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Assign to Employee Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Assign to Employees</CardTitle>
          <CardDescription>
            Assign this checklist to employees in your department
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {availableEmployees.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No available employees
                  </div>
                ) : (
                  availableEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAssignToEmployee}
              disabled={!selectedEmployee || assigning || availableEmployees.length === 0}
              className="bg-gradient-primary"
            >
              {assigning ? "Assigning..." : "Assign"}
            </Button>
          </div>

          {checklist.assigned_employees && checklist.assigned_employees.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Assigned Employees:</p>
              <div className="flex flex-wrap gap-2">
                {checklist.assigned_employees.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full"
                  >
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm">{assignment.employee.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checklist Items */}
      <Card>
        <CardHeader>
          <CardTitle>Checklist Items</CardTitle>
          <CardDescription>View all items in this checklist</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {checklist.items && checklist.items.length > 0 ? (
              checklist.items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-4 border rounded-lg ${
                    item.is_completed ? "bg-green-50 border-green-200" : "bg-card"
                  }`}
                >
                  <div className="mt-1">
                    {item.is_completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${item.is_completed ? "line-through text-muted-foreground" : ""}`}>
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    )}
                    {item.is_completed && item.completed_by_employee && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Completed by {item.completed_by_employee.name}
                        {item.completed_at && (
                          <> on {new Date(item.completed_at).toLocaleDateString()}</>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No items in this checklist</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChecklistView;

