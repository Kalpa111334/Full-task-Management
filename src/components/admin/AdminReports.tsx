import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { showSuccess, showError } from "@/lib/sweetalert";
import { FileDown, Share2, Users, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface DepartmentBreakdown {
  department_id: string;
  department_name: string;
  total: number;
  completed: number;
  in_progress: number;
  pending: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  priority: string;
  department_id: string | null;
  assigned_to: string | null;
  employee_name: string;
  department_name: string;
}

interface AdminReportsProps {
  adminId: string;
}

const AdminReports = ({ adminId }: AdminReportsProps) => {
  const [reportType, setReportType] = useState<"regular" | "device_control">("regular");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [adminDepartmentIds, setAdminDepartmentIds] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminInfoLoaded, setAdminInfoLoaded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departmentBreakdown, setDepartmentBreakdown] = useState<DepartmentBreakdown[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminInfo();
  }, [adminId]);

  useEffect(() => {
    if (adminInfoLoaded && (adminDepartmentIds.length > 0 || isSuperAdmin)) {
      fetchDepartments();
    }
  }, [adminDepartmentIds, isSuperAdmin, adminInfoLoaded]);

  useEffect(() => {
    if (adminInfoLoaded) {
      fetchReportData();
    }
  }, [reportType, selectedDepartment, adminDepartmentIds, isSuperAdmin, adminInfoLoaded]);

  const fetchAdminInfo = async () => {
    try {
      setAdminInfoLoaded(false);
      const { data: employee, error } = await supabase
        .from("employees")
        .select("role")
        .eq("id", adminId)
        .single();

      if (error) throw error;

      const superAdmin = employee?.role === "super_admin";
      setIsSuperAdmin(superAdmin);

      if (!superAdmin) {
        const { data: adminDepts, error: deptError } = await supabase
          .from("admin_departments")
          .select("department_id")
          .eq("admin_id", adminId);

        if (deptError) throw deptError;
        setAdminDepartmentIds((adminDepts || []).map(ad => ad.department_id));
      } else {
        setAdminDepartmentIds([]);
      }
      
      setAdminInfoLoaded(true);
    } catch (error) {
      console.error("Error fetching admin info:", error);
      showError("Failed to load admin information");
      setAdminInfoLoaded(true); // Set to true even on error to prevent infinite loading
    }
  };

  const fetchDepartments = async () => {
    try {
      let query = supabase
        .from("departments")
        .select("id, name")
        .order("name");

      if (!isSuperAdmin && adminDepartmentIds.length > 0) {
        query = query.in("id", adminDepartmentIds);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
      showError("Failed to load departments");
    }
  };

  const fetchReportData = async () => {
    if (!adminInfoLoaded) {
      return; // Don't fetch until admin info is loaded
    }

    setLoading(true);
    try {
      // If not super admin and no accessible departments, return empty
      if (!isSuperAdmin && adminDepartmentIds.length === 0 && selectedDepartment === "all") {
        setTasks([]);
        setDepartmentBreakdown([]);
        setLoading(false);
        return;
      }

      let tasksQuery = supabase
        .from("tasks")
        .select(`
          id,
          title,
          status,
          started_at,
          completed_at,
          created_at,
          priority,
          department_id,
          assigned_to,
          task_type,
          employee:employees!tasks_assigned_to_fkey (name),
          department:departments (name)
        `);

      // Filter by department first (before report type to reduce data)
      if (selectedDepartment !== "all") {
        tasksQuery = tasksQuery.eq("department_id", selectedDepartment);
      } else if (!isSuperAdmin) {
        // For non-super admins, filter by accessible departments
        if (adminDepartmentIds.length > 0) {
          tasksQuery = tasksQuery.in("department_id", adminDepartmentIds);
        } else {
          // No accessible departments - return empty
          setTasks([]);
          setDepartmentBreakdown([]);
          setLoading(false);
          return;
        }
      }
      // For super admin with "all" selected, no department filter needed

      // Filter by report type
      if (reportType === "device_control") {
        tasksQuery = tasksQuery.eq("task_type", "location_based");
      }
      // For regular tasks, we'll filter client-side to avoid .or() syntax issues

      const { data, error } = await tasksQuery.order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching report data:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        throw error;
      }

      // Filter by report type client-side for regular tasks
      let filteredData = data || [];
      if (reportType === "regular") {
        filteredData = filteredData.filter((task: any) => 
          !task.task_type || task.task_type !== "location_based"
        );
      }

      const formattedTasks = filteredData.map((task: any) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        started_at: task.started_at,
        completed_at: task.completed_at,
        created_at: task.created_at,
        priority: task.priority,
        department_id: task.department_id,
        assigned_to: task.assigned_to,
        employee_name: task.employee?.name || "Unassigned",
        department_name: task.department?.name || "No Department",
      }));

      setTasks(formattedTasks);
      calculateDepartmentBreakdown(formattedTasks);
    } catch (error: any) {
      console.error("Error fetching report data:", error);
      console.error("Error message:", error?.message);
      console.error("Error code:", error?.code);
      console.error("Error details:", error?.details);
      showError(error?.message || "Failed to fetch report data");
    } finally {
      setLoading(false);
    }
  };

  const calculateDepartmentBreakdown = (taskList: Task[]) => {
    const breakdownMap = new Map<string, DepartmentBreakdown>();

    taskList.forEach(task => {
      const deptId = task.department_id || "no_department";
      const deptName = task.department_name;

      if (!breakdownMap.has(deptId)) {
        breakdownMap.set(deptId, {
          department_id: deptId,
          department_name: deptName,
          total: 0,
          completed: 0,
          in_progress: 0,
          pending: 0,
        });
      }

      const breakdown = breakdownMap.get(deptId)!;
      breakdown.total++;
      
      if (task.status === "completed") {
        breakdown.completed++;
      } else if (task.status === "in_progress") {
        breakdown.in_progress++;
      } else {
        breakdown.pending++;
      }
    });

    const breakdownArray = Array.from(breakdownMap.values()).sort((a, b) => 
      a.department_name.localeCompare(b.department_name)
    );

    setDepartmentBreakdown(breakdownArray);
  };

  const calculateMetrics = () => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "completed").length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    
    const completedTasks = tasks.filter(t => t.status === "completed" && t.started_at && t.completed_at);
    const totalMinutes = completedTasks.reduce((acc, task) => {
      return acc + differenceInMinutes(new Date(task.completed_at!), new Date(task.started_at!));
    }, 0);
    
    const avgMinutes = completedTasks.length > 0 ? Math.round(totalMinutes / completedTasks.length) : 0;
    const avgHours = Math.floor(avgMinutes / 60);
    const avgMins = avgMinutes % 60;
    const avgTime = avgHours > 0 ? `${avgHours}h ${avgMins}m` : `${avgMins}m`;

    return { total, completed, inProgress, avgTime };
  };

  const generatePDF = async (type: "department" | "employee") => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      const metrics = calculateMetrics();

      // Header
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Department Reports", 14, 20);

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Report Type: ${reportType === "device_control" ? "Device Control Tasks" : "Regular Tasks"}`, 14, 30);
      doc.text(`Department Filter: ${selectedDepartment === "all" ? "All Accessible Departments" : departments.find(d => d.id === selectedDepartment)?.name || "All"}`, 14, 36);
      doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 42);

      // Summary Statistics
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Summary Statistics", 14, 52);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Total Tasks: ${metrics.total}`, 14, 60);
      doc.text(`Completed: ${metrics.completed} (${metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0}%)`, 14, 66);
      doc.text(`In Progress: ${metrics.inProgress}`, 14, 72);
      doc.text(`Average Time per Task: ${metrics.avgTime}`, 14, 78);

      let startY = 88;

      if (type === "department") {
        // Department Breakdown Table
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Department Breakdown", 14, startY);
        startY += 8;

        const deptTableData = departmentBreakdown.map(dept => [
          dept.department_name,
          dept.total.toString(),
          dept.completed.toString(),
          dept.in_progress.toString(),
          dept.pending.toString(),
        ]);

        autoTable(doc, {
          startY: startY,
          head: [["Department", "Total", "Completed", "In Progress", "Pending"]],
          body: deptTableData,
          theme: "striped",
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 9 },
        });
      } else {
        // Employee-wise breakdown
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Employee Task Breakdown", 14, startY);
        startY += 8;

        const employeeMap = new Map<string, { name: string; total: number; completed: number; in_progress: number; pending: number }>();

        tasks.forEach(task => {
          const empId = task.assigned_to || "unassigned";
          const empName = task.employee_name;

          if (!employeeMap.has(empId)) {
            employeeMap.set(empId, {
              name: empName,
              total: 0,
              completed: 0,
              in_progress: 0,
              pending: 0,
            });
          }

          const emp = employeeMap.get(empId)!;
          emp.total++;
          if (task.status === "completed") emp.completed++;
          else if (task.status === "in_progress") emp.in_progress++;
          else emp.pending++;
        });

        const empTableData = Array.from(employeeMap.values()).map(emp => [
          emp.name,
          emp.total.toString(),
          emp.completed.toString(),
          emp.in_progress.toString(),
          emp.pending.toString(),
        ]);

        autoTable(doc, {
          startY: startY,
          head: [["Employee", "Total", "Completed", "In Progress", "Pending"]],
          body: empTableData,
          theme: "striped",
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 9 },
        });
      }

      // Save PDF
      const reportTypeName = reportType === "device_control" ? "DeviceControl" : "Regular";
      const deptName = selectedDepartment === "all" ? "AllDepartments" : departments.find(d => d.id === selectedDepartment)?.name.replace(/\s+/g, "") || "All";
      const fileName = `${reportTypeName}_${type}_Report_${deptName}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      doc.save(fileName);

      showSuccess("Report downloaded successfully!");
    } catch (error) {
      console.error(error);
      showError("Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  const shareViaWhatsApp = () => {
    const metrics = calculateMetrics();
    const reportTypeName = reportType === "device_control" ? "Device Control Tasks" : "Regular Tasks";
    const deptFilter = selectedDepartment === "all" ? "All Accessible Departments" : departments.find(d => d.id === selectedDepartment)?.name || "All";

    let summary = `*Department Reports*
${reportTypeName}
Department Filter: ${deptFilter}
Date: ${format(new Date(), "PPP")}

*Summary Statistics*
Total Tasks: ${metrics.total}
Completed: ${metrics.completed} (${metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0}%)
In Progress: ${metrics.inProgress}
Average Time/Task: ${metrics.avgTime}

*Top Departments*
${departmentBreakdown.slice(0, 5).map((dept, i) => 
  `${i + 1}. ${dept.department_name}
   Total: ${dept.total} | Completed: ${dept.completed} | In Progress: ${dept.in_progress} | Pending: ${dept.pending}`
).join("\n\n")}
`;

    const encodedMessage = encodeURIComponent(summary);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  };

  const metrics = calculateMetrics();

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Department Reports</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Monitor department performance and export summaries</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={() => generatePDF("department")} 
            disabled={isGenerating || tasks.length === 0} 
            className="bg-gradient-primary w-full sm:w-auto"
            size="sm"
          >
            <FileDown className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
          <Button 
            onClick={shareViaWhatsApp} 
            disabled={tasks.length === 0} 
            variant="outline"
            className="w-full sm:w-auto"
            size="sm"
          >
            <Share2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Share WhatsApp</span>
            <span className="sm:hidden">Share</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card className="p-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Report Type</Label>
            <Select value={reportType} onValueChange={(value: "regular" | "device_control") => setReportType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular Tasks</SelectItem>
                <SelectItem value="device_control">Device Control Tasks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Department Filter</Label>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accessible Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Total Tasks</p>
              <p className="text-2xl font-bold">{metrics.total}</p>
              <p className="text-xs text-muted-foreground">Assigned Departments</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-success/10 p-3 rounded-lg">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-success">{metrics.completed}</p>
              <p className="text-xs text-muted-foreground">
                {metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0}%
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-warning/10 p-3 rounded-lg">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold text-warning">{metrics.inProgress}</p>
              <p className="text-xs text-muted-foreground">Active work</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Avg Time / Task</p>
              <p className="text-2xl font-bold">{metrics.avgTime}</p>
              <p className="text-xs text-muted-foreground">0 overdue</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Department Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Department Breakdown</CardTitle>
          <CardDescription>Task distribution across departments</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : departmentBreakdown.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No departments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>In Progress</TableHead>
                    <TableHead>Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departmentBreakdown.map((dept) => (
                    <TableRow key={dept.department_id}>
                      <TableCell className="font-medium">{dept.department_name}</TableCell>
                      <TableCell>{dept.total}</TableCell>
                      <TableCell>{dept.completed}</TableCell>
                      <TableCell>{dept.in_progress}</TableCell>
                      <TableCell>{dept.pending}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee-wise PDF download option */}
      <div className="mt-4 flex justify-end">
        <Button 
          onClick={() => generatePDF("employee")} 
          disabled={isGenerating || tasks.length === 0} 
          variant="outline"
          size="sm"
        >
          <FileDown className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
          <span className="hidden sm:inline">Download Employee-wise PDF</span>
          <span className="sm:hidden">Employee PDF</span>
        </Button>
      </div>
    </div>
  );
};

export default AdminReports;
