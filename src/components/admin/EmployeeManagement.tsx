import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { showSuccess, showError, showConfirm } from "@/lib/sweetalert";
import { Plus, Edit, Trash2, UserCheck, UserX, Search, Eye, Filter, Loader2, MapPin, Clock, User, Calendar, Power, PowerOff, Camera, CheckCircle2 } from "lucide-react";
import { notifyEmployeeAdded, notifyEmployeeCredentials, notifyDepartmentHeadAssigned } from "@/lib/notificationService";
import { notifyEmployeeRegistered, notifyDepartmentHeadRegistered } from "@/lib/whatsappService";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  department_id: string | null;
  phone: string | null;
  is_active: boolean;
  admin_departments?: string[]; // Array of department names for admins
  department?: { name: string };
}

interface Department {
  id: string;
  name: string;
}

interface EmployeeTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  department: { name: string } | null;
}

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  is_active: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  completion_photo_url: string | null;
  employee?: { name: string; email: string } | null;
  assigned_by_employee?: { name: string } | null;
  department?: { name: string } | null;
}

interface EmployeeManagementProps {
  adminId?: string;
}

const EmployeeManagement = ({ adminId }: EmployeeManagementProps = {}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedAdminDepartments, setSelectedAdminDepartments] = useState<string[]>([]);
  const [adminDepartmentIds, setAdminDepartmentIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [viewingEmployeeTasks, setViewingEmployeeTasks] = useState<Employee | null>(null);
  const [employeeTasks, setEmployeeTasks] = useState<EmployeeTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null);
  const [loadingTaskDetail, setLoadingTaskDetail] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);
  const tasksPerPage = 5;
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
    department_id: "",
    phone: "",
  });

  useEffect(() => {
    fetchAdminDepartments();
  }, [adminId]);

  useEffect(() => {
    if (adminDepartmentIds.length > 0 || !adminId) {
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
    }
  }, [adminDepartmentIds]);

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
      // Super admin sees all employees
      setAdminDepartmentIds([]);
      return;
    }

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

  const fetchEmployees = async () => {
    let query = supabase
      .from("employees")
      .select(`
        *,
        department:departments(name)
      `)
      .order("created_at", { ascending: false });

    // Filter by admin's departments if not super admin
    if (adminId && adminDepartmentIds.length > 0) {
      query = query.in("department_id", adminDepartmentIds);
    }

    const { data, error } = await query;

    if (error) {
      showError("Failed to fetch employees");
      return;
    }

    // Fetch admin departments for each admin/super_admin
    const employeesWithDepts = await Promise.all(
      (data || []).map(async (employee) => {
        if (employee.role === "admin" || employee.role === "super_admin") {
          const { data: adminDepts } = await supabase
            .from("admin_departments")
            .select("department_id, departments:departments(name)")
            .eq("admin_id", employee.id);

          const deptNames = (adminDepts || [])
            .map((ad: any) => ad.departments?.name)
            .filter(Boolean);

          return { ...employee, admin_departments: deptNames };
        }
        return employee;
      })
    );

    setEmployees(employeesWithDepts || []);
    setFilteredEmployees(employeesWithDepts || []);
  };

  const fetchDepartments = async () => {
    let query = supabase
      .from("departments")
      .select("id, name")
      .order("name");

    // Filter by admin's departments if not super admin
    if (adminId && adminDepartmentIds.length > 0) {
      query = query.in("id", adminDepartmentIds);
    }

    const { data, error } = await query;

    if (error) {
      showError("Failed to fetch departments");
      return;
    }

    setDepartments(data || []);
  };

  const loadAdminDepartments = async (employeeId: string) => {
    const { data, error } = await supabase
      .from("admin_departments")
      .select("department_id")
      .eq("admin_id", employeeId);

    if (error) {
      console.error("Failed to fetch admin departments:", error);
      return [];
    }

    return (data || []).map(ad => ad.department_id);
  };

  // Filter employees based on search and filters
  useEffect(() => {
    let filtered = [...employees];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(emp => 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply department filter
    if (filterDepartment && filterDepartment !== "all") {
      filtered = filtered.filter(emp => emp.department_id === filterDepartment);
    }

    // Apply role filter
    if (filterRole && filterRole !== "all") {
      filtered = filtered.filter(emp => emp.role === filterRole);
    }

    setFilteredEmployees(filtered);
  }, [searchTerm, filterDepartment, filterRole, employees]);

  // Real-time subscription for employee tasks
  useEffect(() => {
    if (!viewingEmployeeTasks) return;

    const channel = supabase
      .channel(`tasks-${viewingEmployeeTasks.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `assigned_to=eq.${viewingEmployeeTasks.id}`,
        },
        (payload) => {
          console.log("Task change detected:", payload);
          // Refresh tasks when changes occur
          fetchEmployeeTasks(viewingEmployeeTasks.id, currentPage);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewingEmployeeTasks, currentPage]);

  // Fetch employee tasks with pagination
  const fetchEmployeeTasks = async (employeeId: string, page: number = 1) => {
    setLoadingTasks(true);
    try {
      const from = (page - 1) * tasksPerPage;
      const to = from + tasksPerPage - 1;

      // Get total count
      const { count } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", employeeId);

      setTotalTasks(count || 0);

      // Get paginated data
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          description,
          status,
          priority,
          deadline,
          department:departments(name)
        `)
        .eq("assigned_to", employeeId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        showError("Failed to fetch employee tasks");
        return;
      }

      setEmployeeTasks(data || []);
    } finally {
      setLoadingTasks(false);
    }
  };

  const viewEmployeeTasks = async (employee: Employee) => {
    setViewingEmployeeTasks(employee);
    setCurrentPage(1);
    await fetchEmployeeTasks(employee.id, 1);
  };

  const handlePageChange = (newPage: number) => {
    if (viewingEmployeeTasks) {
      setCurrentPage(newPage);
      fetchEmployeeTasks(viewingEmployeeTasks.id, newPage);
    }
  };

  // Fetch detailed task information
  const fetchTaskDetail = async (taskId: string) => {
    setLoadingTaskDetail(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          employee:employees!tasks_assigned_to_fkey (name, email),
          assigned_by_employee:employees!tasks_assigned_by_fkey (name),
          department:departments (name)
        `)
        .eq("id", taskId)
        .single();

      if (error) {
        showError("Failed to fetch task details");
        return;
      }

      setSelectedTask(data);
    } finally {
      setLoadingTaskDetail(false);
    }
  };

  const handleTaskClick = async (taskId: string) => {
    await fetchTaskDetail(taskId);
  };

  const updateAdminDepartments = async (adminId: string, departmentIds: string[]) => {
    // First, delete existing admin department associations
    const { error: deleteError } = await supabase
      .from("admin_departments")
      .delete()
      .eq("admin_id", adminId);

    if (deleteError) {
      console.error("Failed to delete existing admin departments:", deleteError);
      throw deleteError;
    }

    // Then insert new associations
    if (departmentIds.length > 0) {
      const insertData = departmentIds.map(deptId => ({
        admin_id: adminId,
        department_id: deptId
      }));

      const { error: insertError } = await supabase
        .from("admin_departments")
        .insert(insertData);

      if (insertError) {
        console.error("Failed to insert admin departments:", insertError);
        throw insertError;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation: If role is admin or super_admin and no departments selected
    if ((formData.role === "admin" || formData.role === "super_admin") && selectedAdminDepartments.length === 0) {
      showError("Please select at least one department for admin role");
      return;
    }

    if (editingEmployee) {
      const wasDeptHead = editingEmployee.role === "department_head";
      const prevDepartmentId = editingEmployee.department_id;

      const updateData: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role as "admin" | "super_admin" | "department_head" | "employee",
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

      // Update admin departments if role is admin or super_admin
      if (formData.role === "admin" || formData.role === "super_admin") {
        try {
          await updateAdminDepartments(editingEmployee.id, selectedAdminDepartments);
        } catch (err) {
          console.error("Failed to update admin departments:", err);
          showError("Employee updated but failed to update department assignments");
          return;
        }
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
            role: formData.role as "admin" | "super_admin" | "department_head" | "employee",
            department_id: formData.department_id && formData.department_id !== "none" ? formData.department_id : null,
            phone: formData.phone || null,
          },
        ])
        .select();

      if (error || !created || created.length === 0) {
        showError("Failed to add employee");
        return;
      }

      const employeeId = created[0].id as string;

      // Create admin department associations if role is admin or super_admin
      if ((formData.role === "admin" || formData.role === "super_admin") && selectedAdminDepartments.length > 0) {
        try {
          await updateAdminDepartments(employeeId, selectedAdminDepartments);
        } catch (err) {
          console.error("Failed to create admin departments:", err);
          showError("Employee created but failed to assign departments");
          return;
        }
      }

      showSuccess("Employee added successfully");

      // Send welcome + credentials notifications
      try {
        const employeeName = created[0].name as string;
        const employeeRole = created[0].role as string;
        let departmentName: string | null = null;
        if (created[0].department_id) {
          const { data: dept } = await supabase
            .from("departments")
            .select("name")
            .eq("id", created[0].department_id)
            .single();
          if (dept?.name) departmentName = dept.name;
        }

        // Push notifications (if they have PWA)
        await notifyEmployeeAdded(employeeName, departmentName || "No Department", employeeId);
        await notifyEmployeeCredentials(employeeName, formData.email, formData.password, employeeId);

        // WhatsApp notification with credentials (if they have phone number)
        if (employeeRole === "department_head") {
          await notifyDepartmentHeadRegistered(
            employeeName,
            employeeId,
            formData.email,
            formData.password,
            departmentName
          );
        } else {
          await notifyEmployeeRegistered(
            employeeName,
            employeeId,
            formData.email,
            formData.password,
            employeeRole,
            departmentName
          );
        }
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

  const openEditDialog = async (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      password: "",
      role: employee.role,
      department_id: employee.department_id || "none",
      phone: employee.phone || "",
    });

    // Load admin departments if employee is admin or super_admin
    if (employee.role === "admin" || employee.role === "super_admin") {
      const adminDepts = await loadAdminDepartments(employee.id);
      setSelectedAdminDepartments(adminDepts);
    } else {
      setSelectedAdminDepartments([]);
    }

    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingEmployee(null);
    setSelectedAdminDepartments([]);
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
      super_admin: "bg-purple-600 text-white",
      admin: "bg-destructive text-destructive-foreground",
      department_head: "bg-secondary text-secondary-foreground",
      employee: "bg-muted text-muted-foreground",
    };
    return colors[role as keyof typeof colors] || colors.employee;
  };

  const toggleAdminDepartment = (departmentId: string) => {
    setSelectedAdminDepartments(prev => 
      prev.includes(departmentId)
        ? prev.filter(id => id !== departmentId)
        : [...prev, departmentId]
    );
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
                  <Select value={formData.role} onValueChange={(value) => {
                    setFormData({ ...formData, role: value });
                    // Clear admin departments when changing away from admin roles
                    if (value !== "admin" && value !== "super_admin") {
                      setSelectedAdminDepartments([]);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="department_head">Department Head</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Primary Department</Label>
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

              {/* Multi-Department Selection for Admin/Super Admin */}
              {(formData.role === "admin" || formData.role === "super_admin") && (
                <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
                  <Label className="text-base font-semibold">
                    Manage Departments * 
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      (Select departments this admin can manage)
                    </span>
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {departments.map((dept) => (
                      <div key={dept.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`dept-${dept.id}`}
                          checked={selectedAdminDepartments.includes(dept.id)}
                          onCheckedChange={() => toggleAdminDepartment(dept.id)}
                        />
                        <Label
                          htmlFor={`dept-${dept.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {dept.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedAdminDepartments.length === 0 && (
                    <p className="text-xs text-destructive mt-2">
                      Please select at least one department
                    </p>
                  )}
                </div>
              )}

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

      {/* Search and Filter Section */}
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="search" className="mb-2 block">Search Employees</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="filterDept" className="mb-2 block">Filter by Department</Label>
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger id="filterDept">
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
          <div>
            <Label htmlFor="filterRole" className="mb-2 block">Filter by Role</Label>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger id="filterRole">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="department_head">Department Head</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          Showing {filteredEmployees.length} of {employees.length} employees
        </div>
      </Card>

      <div className="grid gap-3 sm:gap-4">
        {filteredEmployees.map((employee) => (
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
                {employee.department && (
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Department: {employee.department.name}
                  </p>
                )}
                {(employee.role === "admin" || employee.role === "super_admin") && employee.admin_departments && employee.admin_departments.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Manages Departments:</p>
                    <div className="flex flex-wrap gap-1">
                      {employee.admin_departments.map((deptName, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {deptName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => viewEmployeeTasks(employee)}
                  className="flex-1 sm:flex-none"
                  title="View Tasks"
                >
                  <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
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

      {/* Employee Tasks Dialog */}
      <Dialog open={!!viewingEmployeeTasks} onOpenChange={(open) => !open && setViewingEmployeeTasks(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Tasks Assigned to {viewingEmployeeTasks?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {loadingTasks ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading tasks...</p>
              </div>
            ) : employeeTasks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No tasks assigned to this employee.</p>
            ) : (
              <div className="space-y-3">{employeeTasks.map((task) => (
                  <Card 
                    key={task.id} 
                    className="p-4 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleTaskClick(task.id)}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold">{task.title}</h4>
                        <div className="flex gap-2">
                          <Badge variant={
                            task.priority === 'high' ? 'destructive' :
                            task.priority === 'medium' ? 'default' : 'secondary'
                          }>
                            {task.priority}
                          </Badge>
                          <Badge variant={
                            task.status === 'completed' ? 'default' :
                            task.status === 'in_progress' ? 'default' :
                            task.status === 'pending' ? 'secondary' : 'outline'
                          }>
                            {task.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {task.department && (
                          <span>Department: {task.department.name}</span>
                        )}
                        {task.deadline && (
                          <span>Due: {new Date(task.deadline).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            
            {/* Pagination Controls */}
            {!loadingTasks && totalTasks > tasksPerPage && (
              <div className="flex items-center justify-between border-t pt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * tasksPerPage) + 1} to {Math.min(currentPage * tasksPerPage, totalTasks)} of {totalTasks} tasks
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.ceil(totalTasks / tasksPerPage) }, (_, i) => i + 1)
                      .filter(page => {
                        // Show first page, last page, current page, and adjacent pages
                        const totalPages = Math.ceil(totalTasks / tasksPerPage);
                        return page === 1 || 
                               page === totalPages || 
                               Math.abs(page - currentPage) <= 1;
                      })
                      .map((page, idx, arr) => {
                        // Add ellipsis if there's a gap
                        const prevPage = arr[idx - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;
                        
                        return (
                          <>
                            {showEllipsis && (
                              <span key={`ellipsis-${page}`} className="px-2 text-muted-foreground">
                                ...
                              </span>
                            )}
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(page)}
                              className="min-w-[2.5rem]"
                            >
                              {page}
                            </Button>
                          </>
                        );
                      })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(totalTasks / tasksPerPage)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Task Details</DialogTitle>
          </DialogHeader>
          
          {loadingTaskDetail ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading task details...</p>
            </div>
          ) : selectedTask ? (
            <div className="space-y-6">
              {/* Title and Status */}
              <div className="space-y-3">
                <h3 className="text-xl font-bold">{selectedTask.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={
                    selectedTask.priority === 'urgent' ? 'destructive' :
                    selectedTask.priority === 'high' ? 'destructive' :
                    selectedTask.priority === 'medium' ? 'default' : 'secondary'
                  } className="text-sm">
                    Priority: {selectedTask.priority}
                  </Badge>
                  <Badge variant={
                    selectedTask.status === 'completed' ? 'default' :
                    selectedTask.status === 'in_progress' ? 'default' :
                    selectedTask.status === 'pending' ? 'secondary' : 'outline'
                  } className="text-sm">
                    Status: {selectedTask.status.replace('_', ' ')}
                  </Badge>
                  {selectedTask.is_active ? (
                    <Badge variant="default" className="text-sm bg-green-500">
                      <Power className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-sm">
                      <PowerOff className="h-3 w-3 mr-1" />
                      Inactive
                    </Badge>
                  )}
                </div>
              </div>

              {/* Description */}
              {selectedTask.description && (
                <Card className="p-4">
                  <h4 className="font-semibold mb-2">Description</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap">{selectedTask.description}</p>
                </Card>
              )}

              {/* Task Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Assigned To */}
                {selectedTask.employee && (
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 mt-0.5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">Assigned To</p>
                        <p className="text-sm text-muted-foreground">{selectedTask.employee.name}</p>
                        {selectedTask.employee.email && (
                          <p className="text-xs text-muted-foreground">{selectedTask.employee.email}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Assigned By */}
                {selectedTask.assigned_by_employee && (
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 mt-0.5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">Assigned By</p>
                        <p className="text-sm text-muted-foreground">{selectedTask.assigned_by_employee.name}</p>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Department */}
                {selectedTask.department && (
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 mt-0.5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">Department</p>
                        <p className="text-sm text-muted-foreground">{selectedTask.department.name}</p>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Deadline */}
                {selectedTask.deadline && (
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 mt-0.5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">Deadline</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(selectedTask.deadline), "PPP")}
                        </p>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Location */}
                {selectedTask.location_address && (
                  <Card className="p-4 md:col-span-2">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 mt-0.5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">Location</p>
                        <p className="text-sm text-muted-foreground">{selectedTask.location_address}</p>
                        {selectedTask.location_lat && selectedTask.location_lng && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Coordinates: {selectedTask.location_lat.toFixed(6)}, {selectedTask.location_lng.toFixed(6)}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              {/* Timeline */}
              <Card className="p-4">
                <h4 className="font-semibold mb-3">Timeline</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Created</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(selectedTask.created_at), "PPpp")}
                      </p>
                    </div>
                  </div>
                  
                  {selectedTask.started_at && (
                    <div className="flex items-start gap-3">
                      <Clock className="h-4 w-4 mt-0.5 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">Started</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(selectedTask.started_at), "PPpp")}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {selectedTask.completed_at && (
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500" />
                      <div>
                        <p className="text-sm font-medium">Completed</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(selectedTask.completed_at), "PPpp")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Completion Photo */}
              {selectedTask.completion_photo_url && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Camera className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Completion Photo</h4>
                  </div>
                  <img 
                    src={selectedTask.completion_photo_url} 
                    alt="Task completion" 
                    className="w-full rounded-lg border"
                  />
                </Card>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeManagement;
