import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface DepartmentStatsProps {
  departmentId: string;
}

const DepartmentStats = ({ departmentId }: DepartmentStatsProps) => {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
  });
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
    fetchEmployees();
  }, [departmentId]);

  const fetchStats = async () => {
    try {
      // Fetch total employees count
      let empQuery = supabase
        .from("employees")
        .select("*", { count: "exact", head: true });
      
      if (departmentId) {
        empQuery = empQuery.eq("department_id", departmentId);
      } else {
        empQuery = empQuery.is("department_id", null);
      }
      
      const { count: totalEmployees } = await empQuery;

      // Fetch active employees count
      let activeEmpQuery = supabase
        .from("employees")
        .select("*", { count: "exact", head: true });
      
      if (departmentId) {
        activeEmpQuery = activeEmpQuery.eq("department_id", departmentId);
      } else {
        activeEmpQuery = activeEmpQuery.is("department_id", null);
      }
      
      const { count: activeEmployees } = await activeEmpQuery.eq("is_active", true);

      // Fetch tasks counts
      let tasksQuery = supabase
        .from("tasks")
        .select("*", { count: "exact", head: true });
      
      if (departmentId) {
        tasksQuery = tasksQuery.eq("department_id", departmentId);
      } else {
        tasksQuery = tasksQuery.is("department_id", null);
      }
      
      const { count: totalTasks } = await tasksQuery;

      let completedQuery = supabase
        .from("tasks")
        .select("*", { count: "exact", head: true });
      
      if (departmentId) {
        completedQuery = completedQuery.eq("department_id", departmentId);
      } else {
        completedQuery = completedQuery.is("department_id", null);
      }
      
      const { count: completedTasks } = await completedQuery.eq("status", "completed");

      let pendingQuery = supabase
        .from("tasks")
        .select("*", { count: "exact", head: true });
      
      if (departmentId) {
        pendingQuery = pendingQuery.eq("department_id", departmentId);
      } else {
        pendingQuery = pendingQuery.is("department_id", null);
      }
      
      const { count: pendingTasks } = await pendingQuery.eq("status", "pending");

      let inProgressQuery = supabase
        .from("tasks")
        .select("*", { count: "exact", head: true });
      
      if (departmentId) {
        inProgressQuery = inProgressQuery.eq("department_id", departmentId);
      } else {
        inProgressQuery = inProgressQuery.is("department_id", null);
      }
      
      const { count: inProgressTasks } = await inProgressQuery.eq("status", "in_progress");

      setStats({
        totalEmployees: totalEmployees || 0,
        activeEmployees: activeEmployees || 0,
        totalTasks: totalTasks || 0,
        completedTasks: completedTasks || 0,
        pendingTasks: pendingTasks || 0,
        inProgressTasks: inProgressTasks || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchEmployees = async () => {
    let query = supabase
      .from("employees")
      .select("*");
    
    if (departmentId) {
      query = query.eq("department_id", departmentId);
    } else {
      query = query.is("department_id", null);
    }
    
    const { data, error } = await query.order("name");

    if (!error && data) {
      setEmployees(data);
    }
  };

  const statCards = [
    {
      title: "Team Members",
      value: stats.totalEmployees,
      subtitle: `${stats.activeEmployees} active`,
      icon: Users,
      color: "bg-primary",
    },
    {
      title: "Completed Tasks",
      value: stats.completedTasks,
      subtitle: `${stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}% completion`,
      icon: CheckCircle2,
      color: "bg-success",
    },
    {
      title: "In Progress",
      value: stats.inProgressTasks,
      subtitle: "Currently active",
      icon: Clock,
      color: "bg-warning",
    },
    {
      title: "Pending",
      value: stats.pendingTasks,
      subtitle: "Awaiting action",
      icon: AlertCircle,
      color: "bg-destructive",
    },
  ];

  return (
    <div>
      <h2 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-6">Team Overview</h2>
      
      <div className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
        {statCards.map((stat, index) => (
          <Card key={index} className="p-3 sm:p-6 hover:shadow-lg transition-shadow animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-2 sm:mb-4">
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">{stat.title}</p>
                <h3 className="text-2xl sm:text-3xl font-bold">{stat.value}</h3>
                <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
              </div>
              <div className={`${stat.color} p-2 sm:p-3 rounded-lg`}>
                <stat.icon className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-3 sm:p-6">
        <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">Team Members</h3>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => (
            <div key={employee.id} className="p-3 sm:p-4 border rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm sm:text-base truncate">{employee.name}</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">{employee.email}</p>
                  {employee.phone && (
                    <p className="text-xs text-muted-foreground mt-1">{employee.phone}</p>
                  )}
                </div>
                <div
                  className={`h-2 w-2 rounded-full ${
                    employee.is_active ? "bg-success" : "bg-muted"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default DepartmentStats;
