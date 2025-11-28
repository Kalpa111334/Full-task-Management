import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SplashScreen from "@/components/SplashScreen";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import DepartmentHead from "./pages/DepartmentHead";
import Employee from "./pages/Employee";
import TaskDetail from "./pages/TaskDetail";
import TaskAction from "./pages/TaskAction";
import NotFound from "./pages/NotFound";
import SelfLocationPublisher from "@/components/map/SelfLocationPublisher";
import ChecklistView from "@/components/department/ChecklistView";
import EmployeeChecklistView from "@/components/employee/EmployeeChecklistView";

const queryClient = new QueryClient();

// Checklist Route Component - determines if user is employee or department head
const ChecklistRoute = () => {
  const employeeData = localStorage.getItem("employee");
  if (!employeeData) {
    window.location.href = "/login";
    return null;
  }

  const employee = JSON.parse(employeeData);
  
  if (employee.role === "employee") {
    return <EmployeeChecklistView employeeId={employee.id} />;
  } else if (employee.role === "department_head") {
    return <ChecklistView departmentHeadId={employee.id} departmentId={employee.department_id} />;
  } else {
    // Admin can also view checklists
    return <ChecklistView departmentHeadId={employee.id} departmentId={null} />;
  }
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Check if splash has been shown in this session
    const splashShown = sessionStorage.getItem("splashShown");
    if (splashShown) {
      setShowSplash(false);
    }
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem("splashShown", "true");
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SelfLocationPublisher />
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/department-head" element={<DepartmentHead />} />
            <Route path="/employee" element={<Employee />} />
            <Route path="/task/:id" element={<TaskDetail />} />
            <Route path="/task-action/:id" element={<TaskAction />} />
            <Route path="/checklist/:id" element={<ChecklistRoute />} />
            <Route path="/index" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
