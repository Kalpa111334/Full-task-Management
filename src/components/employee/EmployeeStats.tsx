import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Clock, AlertCircle, TrendingUp } from "lucide-react";

interface EmployeeStatsProps {
  employeeId: string;
}

const EmployeeStats = ({ employeeId }: EmployeeStatsProps) => {
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
  });

  useEffect(() => {
    fetchStats();
  }, [employeeId]);

  const fetchStats = async () => {
    try {
      const { count: totalTasks } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", employeeId);

      const { count: completedTasks } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", employeeId)
        .eq("status", "completed");

      const { count: pendingTasks } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", employeeId)
        .eq("status", "pending");

      const { count: inProgressTasks } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", employeeId)
        .eq("status", "in_progress");

      setStats({
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
      title: "Total Tasks",
      value: stats.totalTasks,
      subtitle: "All time",
      icon: TrendingUp,
      color: "bg-primary",
    },
    {
      title: "Completed",
      value: stats.completedTasks,
      subtitle: `${stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}% success rate`,
      icon: CheckCircle2,
      color: "bg-success",
    },
    {
      title: "In Progress",
      value: stats.inProgressTasks,
      subtitle: "Currently working",
      icon: Clock,
      color: "bg-warning",
    },
    {
      title: "Pending",
      value: stats.pendingTasks,
      subtitle: "Awaiting start",
      icon: AlertCircle,
      color: "bg-destructive",
    },
  ];

  return (
    <div>
      <h2 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-6">Performance Overview</h2>
      
      <div className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="p-3 sm:p-6 hover:shadow-lg transition-shadow animate-fade-in">
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
        <h3 className="font-semibold text-sm sm:text-lg mb-3 sm:mb-4">Performance Insights</h3>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          <div className="p-3 sm:p-4 bg-muted rounded-lg">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Completion Rate</p>
            <p className="text-lg sm:text-2xl font-bold">
              {stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Tasks completed</p>
          </div>
          <div className="p-3 sm:p-4 bg-muted rounded-lg">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Active Load</p>
            <p className="text-lg sm:text-2xl font-bold">{stats.inProgressTasks + stats.pendingTasks}</p>
            <p className="text-xs text-muted-foreground">Tasks to complete</p>
          </div>
          <div className="p-3 sm:p-4 bg-muted rounded-lg">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Workload</p>
            <p className="text-lg sm:text-2xl font-bold">{stats.totalTasks}</p>
            <p className="text-xs text-muted-foreground">All assigned tasks</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default EmployeeStats;
