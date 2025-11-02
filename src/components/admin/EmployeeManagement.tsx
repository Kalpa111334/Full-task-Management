import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { showSuccess, showError, showConfirm } from "@/lib/sweetalert";
import { Plus, Edit, Trash2, UserCheck, UserX } from "lucide-react";
import { notifyEmployeeAdded, notifyEmployeeCredentials, notifyDepartmentHeadAssigned } from "@/lib/notificationService";
import { Badge } from "@/components/ui/badge";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  department_id: string | null;
  phone: string | null;
  is_active: boolean;
}

interface Department {
  id: string;
  name: string;
}

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
    department_id: "",
    phone: "",
  });

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();

    // Subscribe to real-time updates for employees table
    const channel = supabase
      .channel("employees-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "employees" },
        (payload) => {
          // Update specific employee in state for real-time updates
          if (payload.new && payload.new.id) {
            setEmployees(prevEmployees =>
              prevEmployees.map(emp =>
                emp.id === payload.new.id ? { ...emp, ...payload.new } : emp
              )
            );
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "employees" },
        () => {
          fetchEmployees(); // Refetch all for new employees
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "employees" },
        (payload) => {
          // Remove deleted employee from state
          if (payload.old && payload.old.id) {
            setEmployees(prevEmployees =>
              prevEmployees.filter(emp => emp.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      showError("Failed to fetch employees");
      return;
    }

    setEmployees(data || []);
  };

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from("departments")
      .select("id, name")
      .order("name");

    if (error) {
      showError("Failed to fetch departments");
      return;
    }

    setDepartments(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingEmployee) {
      const wasDeptHead = editingEmployee.role === "department_head";
      const prevDepartmentId = editingEmployee.department_id;

      const updateData: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role as "admin" | "department_head" | "employee",
        department_id: formData.department_id && formData.department_id !== "none" ? formData.department_id : null,
        // Always include phone field - trim whitespace and use null if empty
        phone: formData.phone && formData.phone.trim() !== "" ? formData.phone.trim() : null,
      };

      if (formData.password) {
        updateData.password = formData.password;
      }

      // Log the update data for debugging
      console.log("Updating employee with data:", updateData);

      const { data: updatedRows, error } = await supabase
        .from("employees")
        .update(updateData)
        .eq("id", editingEmployee.id)
        .select();

      if (error) {
        console.error("Failed to update employee:", error);
        showError(`Failed to update employee: ${error.message}`);
        return;
      }

      // Verify the update was successful
      if (!updatedRows || updatedRows.length === 0) {
        console.error("Update returned no rows");
        showError("Failed to update employee - no data returned");
        return;
      }

      // Log the updated data for verification
      console.log("Employee updated successfully:", updatedRows[0]);
      console.log("Phone number in database:", updatedRows[0].phone);

      // Verify phone was actually saved by fetching again
      const { data: verifyData, error: verifyError } = await supabase
        .from("employees")
        .select("phone")
        .eq("id", editingEmployee.id)
        .single();

      if (verifyError) {
        console.error("Failed to verify phone update:", verifyError);
      } else {
        console.log("Verified phone in database:", verifyData?.phone);
        // If phone doesn't match, update it explicitly
        if (verifyData?.phone !== updateData.phone) {
          console.warn("Phone mismatch detected, attempting explicit update");
          const { error: phoneUpdateError } = await supabase
            .from("employees")
            .update({ phone: updateData.phone })
            .eq("id", editingEmployee.id);
          
          if (phoneUpdateError) {
            console.error("Failed to update phone explicitly:", phoneUpdateError);
          } else {
            console.log("Phone updated explicitly");
            // Refetch to get updated data
            const { data: refetchData } = await supabase
              .from("employees")
              .select("*")
              .eq("id", editingEmployee.id)
              .single();
            
            if (refetchData) {
              updatedRows[0] = refetchData;
            }
          }
        }
      }

      // Update local state immediately for instant UI feedback
      if (updatedRows && updatedRows.length > 0) {
        setEmployees(prevEmployees =>
          prevEmployees.map(emp =>
            emp.id === editingEmployee.id ? updatedRows[0] : emp
          )
        );
      }

      showSuccess("Employee updated successfully");

      // Post-update notifications
      try {
        const updated = updatedRows && updatedRows[0] ? updatedRows[0] : null;
        const isNowDeptHead = updateData.role === "department_head";
        const newDepartmentId = updateData.department_id as string | null;

        // If they just became a department head or department head moved departments, notify
        if ((!wasDeptHead && isNowDeptHead) || (isNowDeptHead && prevDepartmentId !== newDepartmentId)) {
          let departmentName = "Department";
          if (newDepartmentId) {
            const { data: dept } = await supabase
              .from("departments")
              .select("name")
              .eq("id", newDepartmentId)
              .single();
            if (dept?.name) departmentName = dept.name;
          }
          await notifyDepartmentHeadAssigned(departmentName, editingEmployee.id);
        }

        // If password changed, re-send credentials (use current email/password from form)
        if (formData.password) {
          await notifyEmployeeCredentials(formData.name, formData.email, formData.password, editingEmployee.id);
        }
      } catch (e) {
        console.error("Post-update notification failed", e);
      }
    } else {
      const { data: created, error } = await supabase
        .from("employees")
        .insert([
          {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            role: formData.role as "admin" | "department_head" | "employee",
            department_id: formData.department_id && formData.department_id !== "none" ? formData.department_id : null,
            phone: formData.phone || null,
          },
        ])
        .select();

      if (error || !created || created.length === 0) {
        showError("Failed to add employee");
        return;
      }

      showSuccess("Employee added successfully");

      // Send welcome + credentials push if they have the PWA
      try {
        const employeeId = created[0].id as string;
        const employeeName = created[0].name as string;
        let departmentName = "No Department";
        if (created[0].department_id) {
          const { data: dept } = await supabase
            .from("departments")
            .select("name")
            .eq("id", created[0].department_id)
            .single();
          if (dept?.name) departmentName = dept.name;
        }

        await notifyEmployeeAdded(employeeName, departmentName, employeeId);
        await notifyEmployeeCredentials(employeeName, formData.email, formData.password, employeeId);
      } catch (e) {
        // Non-fatal
        console.error("Failed to send employee notifications", e);
      }
    }

    setIsDialogOpen(false);
    resetForm();
    fetchEmployees();
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm(
      "Delete Employee",
      "Are you sure you want to delete this employee?"
    );
    if (!confirmed) return;

    const { error } = await supabase.from("employees").delete().eq("id", id);

    if (error) {
      showError("Failed to delete employee");
      return;
    }

    showSuccess("Employee deleted successfully");
    fetchEmployees();
  };

  const toggleActive = async (employee: Employee) => {
    const { error } = await supabase
      .from("employees")
      .update({ is_active: !employee.is_active })
      .eq("id", employee.id);

    if (error) {
      showError("Failed to update employee status");
      return;
    }

    showSuccess(`Employee ${employee.is_active ? "deactivated" : "activated"}`);
    fetchEmployees();
  };

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      password: "",
      role: employee.role,
      department_id: employee.department_id || "none",
      phone: employee.phone || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingEmployee(null);
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "employee",
      department_id: "none",
      phone: "",
    });
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: "bg-destructive text-destructive-foreground",
      department_head: "bg-secondary text-secondary-foreground",
      employee: "bg-muted text-muted-foreground",
    };
    return colors[role as keyof typeof colors] || colors.employee;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-lg sm:text-2xl font-bold">Employee Management</h2>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary w-full sm:w-auto" size="sm">
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEmployee ? "Edit Employee" : "Add New Employee"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password {!editingEmployee && "*"}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingEmployee}
                    placeholder={editingEmployee ? "Leave blank to keep current" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="department_head">Department Head</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={formData.department_id}
                    onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button type="submit" className="bg-gradient-primary sm:flex-1">
                  {editingEmployee ? "Update Employee" : "Add Employee"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:gap-4">
        {employees.map((employee) => (
          <Card key={employee.id} className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                  <h3 className="font-semibold text-sm sm:text-lg truncate">{employee.name}</h3>
                  <div className="flex gap-1 sm:gap-2">
                    <Badge className={`${getRoleBadge(employee.role)} text-xs`}>
                      {employee.role.replace("_", " ")}
                    </Badge>
                    {employee.is_active ? (
                      <Badge variant="outline" className="border-success text-success text-xs">
                        <UserCheck className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-destructive text-destructive text-xs">
                        <UserX className="h-3 w-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{employee.email}</p>
                {employee.phone && (
                  <p className="text-xs sm:text-sm text-muted-foreground">Phone: {employee.phone}</p>
                )}
              </div>
              <div className="flex gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleActive(employee)}
                  className="flex-1 sm:flex-none"
                >
                  {employee.is_active ? <UserX className="h-3 w-3 sm:h-4 sm:w-4" /> : <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEditDialog(employee)} className="flex-1 sm:flex-none">
                  <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(employee.id)} className="flex-1 sm:flex-none">
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default EmployeeManagement;
