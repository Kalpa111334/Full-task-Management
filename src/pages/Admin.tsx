import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { showSuccess, showError } from "@/lib/sweetalert";
import { Users, Building2, ClipboardList, LogOut, Plus, AlertCircle, CheckSquare, Eye, FileText } from "lucide-react";
import EmployeeManagement from "@/components/admin/EmployeeManagement";
import DepartmentManagement from "@/components/admin/DepartmentManagement";
import AdminStats from "@/components/admin/AdminStats";
import TaskVerification from "@/components/admin/TaskVerification";
import AdminTaskAssignment from "@/components/admin/AdminTaskAssignment";
import AdminTaskReview from "@/components/admin/AdminTaskReview";
import AdminReports from "@/components/admin/AdminReports";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";

const Admin = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "employees" | "departments" | "tasks" | "verifications" | "review" | "reports">("overview");
  const [employee, setEmployee] = useState<any>(null);

  useEffect(() => {
    const employeeData = localStorage.getItem("employee");
    if (!employeeData) {
      navigate("/");
      return;
    }

    const parsed = JSON.parse(employeeData);
    if (parsed.role !== "admin" && parsed.role !== "super_admin") {
      showError("Access denied");
      navigate("/");
      return;
    }

    setEmployee(parsed);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("employee");
    showSuccess("Logged out successfully");
    navigate("/");
  };

  if (!employee) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-gradient-primary p-1.5 sm:p-2 rounded-lg">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Welcome back, {employee.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
            variant={activeTab === "overview" ? "default" : "outline"}
            onClick={() => setActiveTab("overview")}
            className={`${activeTab === "overview" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
            size="sm"
          >
            <ClipboardList className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">Overview</span>
          </Button>
          <Button
            variant={activeTab === "employees" ? "default" : "outline"}
            onClick={() => setActiveTab("employees")}
            className={`${activeTab === "employees" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
            size="sm"
          >
            <Users className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Employees</span>
            <span className="sm:hidden">Staff</span>
          </Button>
          <Button
            variant={activeTab === "departments" ? "default" : "outline"}
            onClick={() => setActiveTab("departments")}
            className={`${activeTab === "departments" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
            size="sm"
          >
            <Building2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Departments</span>
            <span className="sm:hidden">Depts</span>
          </Button>
          <Button
            variant={activeTab === "tasks" ? "default" : "outline"}
            onClick={() => setActiveTab("tasks")}
            className={`${activeTab === "tasks" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
            size="sm"
          >
            <CheckSquare className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Task Assignment</span>
            <span className="sm:hidden">Tasks</span>
          </Button>
          <Button
            variant={activeTab === "verifications" ? "default" : "outline"}
            onClick={() => setActiveTab("verifications")}
            className={`${activeTab === "verifications" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
            size="sm"
          >
            <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Task Verification</span>
            <span className="sm:hidden">Verify</span>
          </Button>
          <Button
            variant={activeTab === "review" ? "default" : "outline"}
            onClick={() => setActiveTab("review")}
            className={`${activeTab === "review" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
            size="sm"
          >
            <Eye className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Review Tasks</span>
            <span className="sm:hidden">Review</span>
          </Button>
          <Button
            variant={activeTab === "reports" ? "default" : "outline"}
            onClick={() => setActiveTab("reports")}
            className={`${activeTab === "reports" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
            size="sm"
          >
            <FileText className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Reports</span>
            <span className="sm:hidden">Reports</span>
          </Button>
        </div>

        {/* Content */}
        {activeTab === "overview" && <AdminStats adminId={employee.id} />}
        {activeTab === "employees" && <EmployeeManagement adminId={employee.id} />}
        {activeTab === "departments" && <DepartmentManagement adminId={employee.id} />}
        {activeTab === "tasks" && <AdminTaskAssignment adminId={employee.id} />}
        {activeTab === "verifications" && <TaskVerification adminId={employee.id} />}
        {activeTab === "review" && <AdminTaskReview adminId={employee.id} />}
        {activeTab === "reports" && <AdminReports adminId={employee.id} />}
      </div>
    </div>
  );
};

export default Admin;
