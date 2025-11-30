import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { showSuccess, showError } from "@/lib/sweetalert";
import { Plus, Trash2, ClipboardList, Users } from "lucide-react";
import { notifyEmployeeChecklistAssigned } from "@/lib/whatsappService";

interface ChecklistItem {
  id?: string;
  title: string;
  description: string;
  order_index: number;
}

interface Checklist {
  id: string;
  title: string;
  description: string | null;
  department_id: string | null;
  status: string;
  created_at: string;
  items_count: number;
  completed_items_count: number;
  assigned_employees_count: number;
}

interface Employee {
  id: string;
  name: string;
  department_id: string | null;
}

interface ChecklistManagementProps {
  departmentHeadId: string;
  departmentId: string | null;
}

// Helper function to get department head's accessible departments
const getDeptHeadDepartments = async (deptHeadId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from("department_head_departments")
      .select("department_id")
      .eq("department_head_id", deptHeadId);

    if (error) {
      console.error("Error fetching department head departments:", error);
      return [];
    }

    return (data || []).map(dhd => dhd.department_id);
  } catch (error) {
    console.error("Error fetching department head departments:", error);
    return [];
  }
};

const ChecklistManagement = ({ departmentHeadId, departmentId }: ChecklistManagementProps) => {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deptHeadDepartmentIds, setDeptHeadDepartmentIds] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });
  
  const [items, setItems] = useState<ChecklistItem[]>([
    { title: "", description: "", order_index: 0 },
  ]);

  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  useEffect(() => {
    fetchDeptHeadDepartments();
  }, [departmentHeadId]);

  useEffect(() => {
    if (deptHeadDepartmentIds.length > 0 || departmentId) {
      fetchChecklists();
      fetchEmployees();
    }
  }, [deptHeadDepartmentIds, departmentId, departmentHeadId]);

  const fetchDeptHeadDepartments = async () => {
    const deptIds = await getDeptHeadDepartments(departmentHeadId);
    setDeptHeadDepartmentIds(deptIds);
  };

  const fetchChecklists = async () => {
    try {
      let query = supabase
        .from("checklists")
        .select(`
          *,
          items:checklist_items(id, is_completed),
          assigned_employees:checklist_assignments(employee_id)
        `)
        .eq("created_by", departmentHeadId);

      // Filter by accessible departments
      if (deptHeadDepartmentIds.length > 0) {
        query = query.in("department_id", deptHeadDepartmentIds);
      } else if (departmentId) {
        query = query.eq("department_id", departmentId);
      } else {
        // No departments assigned
        setChecklists([]);
        return;
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      const checklistsWithCounts = (data || []).map((checklist: any) => {
        const allItems = checklist.items || [];
        const completedItems = allItems.filter((item: any) => item.is_completed);
        const assignedEmployees = checklist.assigned_employees || [];
        return {
          ...checklist,
          items_count: allItems.length,
          completed_items_count: completedItems.length,
          assigned_employees_count: assignedEmployees.length,
        };
      });

      setChecklists(checklistsWithCounts);
    } catch (error) {
      console.error("Error fetching checklists:", error);
      showError("Failed to fetch checklists");
    }
  };

  const fetchEmployees = async () => {
    try {
      let query = supabase
        .from("employees")
        .select("id, name, department_id")
        .eq("role", "employee")
        .eq("is_active", true);

      // Filter by accessible departments
      if (deptHeadDepartmentIds.length > 0) {
        query = query.in("department_id", deptHeadDepartmentIds);
      } else if (departmentId) {
        query = query.eq("department_id", departmentId);
      } else {
        // No departments assigned
        setEmployees([]);
        return;
      }

      const { data, error } = await query.order("name");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
      showError("Failed to fetch employees");
    }
  };

  const addItem = () => {
    setItems([...items, { title: "", description: "", order_index: items.length }]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index).map((item, i) => ({
      ...item,
      order_index: i,
    }));
    setItems(newItems);
  };

  const updateItem = (index: number, field: keyof ChecklistItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      showError("Please enter a checklist title");
      return;
    }

    if (items.length === 0 || items.some(item => !item.title.trim())) {
      showError("Please add at least one checklist item with a title");
      return;
    }

    if (selectedEmployees.length === 0) {
      showError("Please select at least one employee to assign");
      return;
    }

    // Get the department from the first selected employee (all should be from same department for a checklist)
    const firstEmployee = employees.find(emp => selectedEmployees.includes(emp.id));
    if (!firstEmployee || !firstEmployee.department_id) {
      showError("Selected employees must have a department assigned");
      return;
    }

    const checklistDepartmentId = firstEmployee.department_id;

    setLoading(true);
    try {
      // Create checklist
      const { data: checklist, error: checklistError } = await supabase
        .from("checklists")
        .insert({
          title: formData.title,
          description: formData.description || null,
          created_by: departmentHeadId,
          department_id: checklistDepartmentId,
          status: "pending",
        })
        .select()
        .single();

      if (checklistError) throw checklistError;

      // Create checklist items
      const itemsToInsert = items.map((item, index) => ({
        checklist_id: checklist.id,
        title: item.title,
        description: item.description || null,
        order_index: index,
        is_completed: false,
      }));

      const { error: itemsError } = await supabase
        .from("checklist_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Assign to multiple employees
      const assignmentsToInsert = selectedEmployees.map(employeeId => ({
        checklist_id: checklist.id,
        employee_id: employeeId,
        assigned_by: departmentHeadId,
      }));

      const { error: assignmentsError } = await supabase
        .from("checklist_assignments")
        .insert(assignmentsToInsert);

      if (assignmentsError) throw assignmentsError;

      // Send WhatsApp notifications to all assigned employees
      const checklistUrl = `${window.location.origin}/checklist/${checklist.id}`;
      await Promise.all(
        selectedEmployees.map(employeeId =>
          notifyEmployeeChecklistAssigned(
            formData.title,
            employeeId,
            checklist.id,
            checklistUrl
          )
        )
      );

      showSuccess("Checklist created and assigned successfully!");
      
      // Reset form
      setFormData({ title: "", description: "" });
      setItems([{ title: "", description: "", order_index: 0 }]);
      setSelectedEmployees([]);
      setShowCreateForm(false);
      fetchChecklists();
    } catch (error: any) {
      console.error("Error creating checklist:", error);
      showError(error?.message || "Failed to create checklist");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
      in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-800" },
      completed: { label: "Completed", className: "bg-green-100 text-green-800" },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  if (deptHeadDepartmentIds.length === 0 && !departmentId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Please assign at least one department first</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Digital Checklists</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Create and manage digital checklists for your employees
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-gradient-primary"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Checklist
        </Button>
      </div>

      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Checklist</CardTitle>
            <CardDescription>Create a checklist and assign it to employees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Checklist Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter checklist title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter checklist description (optional)"
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Checklist Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {items.map((item, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Item title *"
                        value={item.title}
                        onChange={(e) => updateItem(index, "title", e.target.value)}
                      />
                      <Textarea
                        placeholder="Item description (optional)"
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        rows={2}
                      />
                    </div>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <div className="space-y-3">
              <Label>Assign to Employees * (Select multiple)</Label>
              <Card className="p-4 max-h-60 overflow-y-auto">
                {employees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No employees in your department</p>
                ) : (
                  <div className="space-y-2">
                    {employees.map((emp) => (
                      <div key={emp.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`emp-${emp.id}`}
                          checked={selectedEmployees.includes(emp.id)}
                          onCheckedChange={() => toggleEmployee(emp.id)}
                        />
                        <Label
                          htmlFor={`emp-${emp.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {emp.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              {selectedEmployees.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedEmployees.length} employee(s) selected
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={loading} className="bg-gradient-primary">
                {loading ? "Creating..." : "Create & Assign"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setFormData({ title: "", description: "" });
                  setItems([{ title: "", description: "", order_index: 0 }]);
                  setSelectedEmployees([]);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Checklists</CardTitle>
          <CardDescription>View and manage all your checklists</CardDescription>
        </CardHeader>
        <CardContent>
          {checklists.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No checklists created yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checklists.map((checklist) => (
                    <TableRow key={checklist.id}>
                      <TableCell className="font-medium">{checklist.title}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {checklist.assigned_employees_count} employee(s)
                        </div>
                      </TableCell>
                      <TableCell>
                        {checklist.items_count > 0
                          ? `${checklist.completed_items_count}/${checklist.items_count}`
                          : "0/0"}
                      </TableCell>
                      <TableCell>{getStatusBadge(checklist.status)}</TableCell>
                      <TableCell>
                        {new Date(checklist.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ChecklistManagement;

