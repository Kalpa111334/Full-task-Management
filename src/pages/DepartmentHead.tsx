import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { showSuccess, showError } from "@/lib/sweetalert";
import { ClipboardList, LogOut, Map, Users, Plus, CheckCircle, ListChecks } from "lucide-react";
import TaskAssignment from "@/components/department/TaskAssignment";
import DepartmentStats from "@/components/department/DepartmentStats";
import MapView from "@/components/map/MapView";
import SelfLocationPublisher from "@/components/map/SelfLocationPublisher";
import TaskApproval from "@/components/department/TaskApproval";
import BulkTaskAssignment from "@/components/department/BulkTaskAssignment";
import DepartmentSelector from "@/components/department/DepartmentSelector";
import DepartmentHeadAdminTasks from "@/components/department/DepartmentHeadAdminTasks";
import ChecklistManagement from "@/components/department/ChecklistManagement";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";

const DepartmentHead = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"tasks" | "admin-tasks" | "approvals" | "map" | "team" | "checklists">("tasks");
  const [employee, setEmployee] = useState<any>(null);

  useEffect(() => {
    const employeeData = localStorage.getItem("employee");
    if (!employeeData) {
      navigate("/");
      return;
    }

    const parsed = JSON.parse(employeeData);
    if (parsed.role !== "department_head") {
      showError("Access denied");
      navigate("/");
      return;
    }

    console.log("DepartmentHead employee data:", parsed);
    setEmployee(parsed);
  }, [navigate]);

  const refreshEmployeeData = async () => {
    try {
      const employeeData = localStorage.getItem("employee");
      if (!employeeData) return;

      const parsed = JSON.parse(employeeData);
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", parsed.id)
        .single();

      if (error) {
        console.error("Error refreshing employee data:", error);
        return;
      }

      localStorage.setItem("employee", JSON.stringify(data));
      setEmployee(data);
      showSuccess("Employee data refreshed");
    } catch (error) {
      console.error("Error refreshing employee data:", error);
    }
  };

  const assignDepartment = async () => {
    try {
      // First, get or create the Purchasing Department
      let { data: department } = await supabase
        .from("departments")
        .select("*")
        .eq("name", "Purchasing Department")
        .single();

      if (!department) {
        const { data: newDept, error: deptError } = await supabase
          .from("departments")
          .insert({ name: "Purchasing Department", description: "Department responsible for purchasing activities" })
          .select()
          .single();

        if (deptError) {
          showError("Failed to create department");
          return;
        }
        department = newDept;
      }

      // Assign the department head to the department
      const { error: updateError } = await supabase
        .from("employees")
        .update({ department_id: department.id })
        .eq("id", employee.id);

      if (updateError) {
        showError("Failed to assign department");
        return;
      }

      // Refresh employee data
      await refreshEmployeeData();
      showSuccess("Department assigned successfully!");
    } catch (error) {
      console.error("Error assigning department:", error);
      showError("Failed to assign department");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("employee");
    showSuccess("Logged out successfully");
    navigate("/");
  };

  if (!employee) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <SelfLocationPublisher />
      {/* Header */}
      <header className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-gradient-primary p-1.5 sm:p-2 rounded-lg">
                <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold">Department Head</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Welcome, {employee.name}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {!employee.department_id && (
                <Button variant="outline" onClick={assignDepartment} size="sm" className="sm:h-10">
                  <span className="hidden sm:inline">Assign Department</span>
                  <span className="sm:hidden">Assign</span>
                </Button>
              )}
              <PushNotificationToggle />
              <Button variant="outline" onClick={handleLogout} size="sm" className="sm:h-10">
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
          <Button
            variant={activeTab === "tasks" ? "default" : "outline"}
            onClick={() => setActiveTab("tasks")}
            className={`${activeTab === "tasks" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
            size="sm"
          >
            <ClipboardList className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Task Management</span>
            <span className="sm:hidden">Tasks</span>
          </Button>
          <Button
            variant={activeTab === "admin-tasks" ? "default" : "outline"}
            onClick={() => setActiveTab("admin-tasks")}
            className={`${activeTab === "admin-tasks" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
            size="sm"
          >
            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Admin Tasks</span>
            <span className="sm:hidden">Admin</span>
          </Button>
          <Button
            variant={activeTab === "approvals" ? "default" : "outline"}
            onClick={() => setActiveTab("approvals")}
            className={`${activeTab === "approvals" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
            size="sm"
          >
            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Approvals</span>
            <span className="sm:hidden">Approve</span>
          </Button>
          <Button
            variant={activeTab === "map" ? "default" : "outline"}
            onClick={() => setActiveTab("map")}
            className={`${activeTab === "map" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
            size="sm"
          >
            <Map className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Live Map</span>
            <span className="sm:hidden">Map</span>
          </Button>
          <Button
            variant={activeTab === "team" ? "default" : "outline"}
            onClick={() => setActiveTab("team")}
            className={`${activeTab === "team" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
            size="sm"
          >
            <Users className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Team Overview</span>
            <span className="sm:hidden">Team</span>
          </Button>
          <Button
            variant={activeTab === "checklists" ? "default" : "outline"}
            onClick={() => setActiveTab("checklists")}
            className={`${activeTab === "checklists" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
            size="sm"
          >
            <ListChecks className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Checklists</span>
            <span className="sm:hidden">Lists</span>
          </Button>
        </div>

        {/* Content */}
        {activeTab === "tasks" && <TaskAssignment departmentId={employee.department_id} assignedBy={employee.id} />}
        {activeTab === "admin-tasks" && <DepartmentHeadAdminTasks departmentHeadId={employee.id} />}
        {activeTab === "approvals" && <TaskApproval departmentId={employee.department_id} approvedBy={employee.id} />}
        {activeTab === "map" && <MapView departmentId={employee.department_id} />}
        {activeTab === "team" && <DepartmentSelector departmentHeadId={employee.id} departmentHeadDeptId={employee.department_id} />}
        {activeTab === "checklists" && <ChecklistManagement departmentHeadId={employee.id} departmentId={employee.department_id} />}
      </div>
    </div>
  );
};

export default DepartmentHead;
