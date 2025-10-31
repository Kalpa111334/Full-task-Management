import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { showSuccess, showError } from "@/lib/sweetalert";
import { ClipboardList, LogOut, MapPin, Clock } from "lucide-react";
import EmployeeTaskList from "@/components/employee/EmployeeTaskList";
import EmployeeStats from "@/components/employee/EmployeeStats";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";

const Employee = () => {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"tasks" | "stats">("tasks");

  useEffect(() => {
    const employeeData = localStorage.getItem("employee");
    if (!employeeData) {
      navigate("/");
      return;
    }

    const parsed = JSON.parse(employeeData);
    if (parsed.role !== "employee") {
      showError("Access denied");
      navigate("/");
      return;
    }

    setEmployee(parsed);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("employee");
    showSuccess("Logged out successfully. Location tracking continues in background for 24 hours.");
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
                <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold">My Tasks</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Welcome, {employee.name}</p>
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

      {/* Navigation */}
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
          <Button
            variant={activeTab === "tasks" ? "default" : "outline"}
            onClick={() => setActiveTab("tasks")}
            className={`${activeTab === "tasks" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
            size="sm"
          >
            <ClipboardList className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">My Tasks</span>
            <span className="sm:hidden">Tasks</span>
          </Button>
          <Button
            variant={activeTab === "stats" ? "default" : "outline"}
            onClick={() => setActiveTab("stats")}
            className={`${activeTab === "stats" ? "bg-gradient-primary" : ""} whitespace-nowrap flex-shrink-0`}
            size="sm"
          >
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Performance</span>
            <span className="sm:hidden">Stats</span>
          </Button>
        </div>

        {/* Content */}
        {activeTab === "tasks" && <EmployeeTaskList employeeId={employee.id} />}
        {activeTab === "stats" && <EmployeeStats employeeId={employee.id} />}
      </div>
    </div>
  );
};

export default Employee;
