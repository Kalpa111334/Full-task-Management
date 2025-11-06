import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, Building2, ClipboardList, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface AdminStatsProps {
  adminId?: string;
}

const AdminStats = ({ adminId }: AdminStatsProps = {}) => {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    totalDepartments: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
  });
  const [adminDepartmentIds, setAdminDepartmentIds] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    fetchAdminDepartments();
  }, [adminId]);

  useEffect(() => {
    if (adminDepartmentIds.length > 0 || !adminId || isSuperAdmin) {
      fetchStats();
    }
  }, [adminDepartmentIds, isSuperAdmin]);

  const fetchAdminDepartments = async () => {
    if (!adminId) {
      setAdminDepartmentIds([]);
      setIsSuperAdmin(false);
      return;
    }

    // Check if user is super_admin
    const { data: employeeData } = await supabase
      .from("employees")
      .select("role")
      .eq("id", adminId)
      .single();

    if (employeeData?.role === "super_admin") {
      // Super admin sees all stats
      setIsSuperAdmin(true);
      setAdminDepartmentIds([]);
      return;
    }

    // Regular admin
    setIsSuperAdmin(false);

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

  const fetchStats = async () => {
    try {
      const hasFilter = adminId && adminDepartmentIds.length > 0;

      // Fetch employee stats (filtered by department)
      let employeeQuery = supabase.from("employees").select("*", { count: "exact", head: true });
      if (hasFilter) {
        employeeQuery = employeeQuery.in("department_id", adminDepartmentIds);
      }
      const { count: totalEmployees } = await employeeQuery;

      let activeEmployeeQuery = supabase.from("employees").select("*", { count: "exact", head: true }).eq("is_active", true);
      if (hasFilter) {
        activeEmployeeQuery = activeEmployeeQuery.in("department_id", adminDepartmentIds);
      }
      const { count: activeEmployees } = await activeEmployeeQuery;

      // Fetch department stats
      let departmentQuery = supabase.from("departments").select("*", { count: "exact", head: true });
      if (hasFilter) {
        departmentQuery = departmentQuery.in("id", adminDepartmentIds);
      }
      const { count: totalDepartments } = await departmentQuery;

      // Fetch task stats (filtered by department)
      let taskQuery = supabase.from("tasks").select("*", { count: "exact", head: true });
      if (hasFilter) {
        taskQuery = taskQuery.in("department_id", adminDepartmentIds);
      }
      const { count: totalTasks } = await taskQuery;

      let completedQuery = supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "completed");
      if (hasFilter) {
        completedQuery = completedQuery.in("department_id", adminDepartmentIds);
      }
      const { count: completedTasks } = await completedQuery;

      let pendingQuery = supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "pending");
      if (hasFilter) {
        pendingQuery = pendingQuery.in("department_id", adminDepartmentIds);
      }
      const { count: pendingTasks } = await pendingQuery;

      let inProgressQuery = supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "in_progress");
      if (hasFilter) {
        inProgressQuery = inProgressQuery.in("department_id", adminDepartmentIds);
      }
      const { count: inProgressTasks } = await inProgressQuery;

      setStats({
        totalEmployees: totalEmployees || 0,
        activeEmployees: activeEmployees || 0,
        totalDepartments: totalDepartments || 0,
        totalTasks: totalTasks || 0,
        completedTasks: completedTasks || 0,
        pendingTasks: pendingTasks || 0,
        inProgressTasks: inProgressTasks || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const statCards = [
    {
      title: "Total Employees",
      value: stats.totalEmployees,
      subtitle: `${stats.activeEmployees} active`,
      icon: Users,
      color: "bg-primary",
    },
    {
      title: "Departments",
      value: stats.totalDepartments,
      subtitle: "Across organization",
      icon: Building2,
      color: "bg-secondary",
    },
    {
      title: "Total Tasks",
      value: stats.totalTasks,
      subtitle: "All time",
      icon: ClipboardList,
      color: "bg-accent",
    },
    {
      title: "Completed Tasks",
      value: stats.completedTasks,
      subtitle: `${stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}% completion rate`,
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
      title: "Pending Tasks",
      value: stats.pendingTasks,
      subtitle: "Awaiting assignment",
      icon: AlertCircle,
      color: "bg-destructive",
    },
  ];

  return (
    <div>
      <h2 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-6">System Overview</h2>
      <div className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat, index) => (
          <Card key={index} className="p-3 sm:p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-2 sm:mb-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">{stat.title}</p>
                <h3 className="text-lg sm:text-3xl font-bold">{stat.value}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{stat.subtitle}</p>
              </div>
              <div className={`${stat.color} p-2 sm:p-3 rounded-lg flex-shrink-0`}>
                <stat.icon className="h-3 w-3 sm:h-6 sm:w-6 text-white" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-3 sm:p-6 mt-4 sm:mt-6">
        <h3 className="font-semibold text-sm sm:text-lg mb-3 sm:mb-4">Quick Actions</h3>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          <div className="p-3 sm:p-4 bg-muted rounded-lg">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Employee Efficiency</p>
            <p className="text-lg sm:text-2xl font-bold">
              {stats.totalEmployees > 0
                ? Math.round((stats.completedTasks / stats.totalEmployees) * 10) / 10
                : 0}
            </p>
            <p className="text-xs text-muted-foreground">Tasks per employee</p>
          </div>
          <div className="p-3 sm:p-4 bg-muted rounded-lg">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Department Load</p>
            <p className="text-lg sm:text-2xl font-bold">
              {stats.totalDepartments > 0
                ? Math.round((stats.totalTasks / stats.totalDepartments) * 10) / 10
                : 0}
            </p>
            <p className="text-xs text-muted-foreground">Tasks per department</p>
          </div>
          <div className="p-3 sm:p-4 bg-muted rounded-lg">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Success Rate</p>
            <p className="text-lg sm:text-2xl font-bold">
              {stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Task completion</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminStats;
