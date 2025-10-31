import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess, showError } from "@/lib/sweetalert";
import { FileDown, Share2, Calendar, Settings } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface TaskReport {
  id: string;
  title: string;
  started_at: string | null;
  completed_at: string | null;
  approved_at: string | null;
  created_at: string;
  deadline: string | null;
  priority: string;
  status: string;
  employee_name: string;
  department_name: string;
  assigned_by_name: string;
}

interface TaskReportProps {
  departmentId: string;
}

const TaskReport = ({ departmentId }: TaskReportProps) => {
  const [tasks, setTasks] = useState<TaskReport[]>([]);
  const [department, setDepartment] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportType, setReportType] = useState<"regular" | "device_control">("regular");

  useEffect(() => {
    console.log("TaskReport useEffect - departmentId:", departmentId, "reportType:", reportType);
    fetchReportData();
  }, [departmentId, reportType]);

  // Auto-switch to regular tasks if device control is selected but departmentId is not available
  useEffect(() => {
    if (reportType === "device_control" && !departmentId) {
      setReportType("regular");
    }
  }, [departmentId, reportType]);

  const fetchReportData = async () => {
    try {
      // Fetch department info
      let deptData = null;
      if (departmentId) {
        const { data, error: deptError } = await supabase
          .from("departments")
          .select("*")
          .eq("id", departmentId)
          .single();
        
        if (deptError) throw deptError;
        deptData = data;
      }

      setDepartment(deptData);

      // Fetch tasks based on report type
      let tasksQuery = supabase
        .from("tasks")
        .select(`
          id,
          title,
          started_at,
          completed_at,
          approved_at,
          created_at,
          deadline,
          priority,
          status,
          task_type,
          employee:employees!tasks_assigned_to_fkey(name),
          assigner:employees!tasks_assigned_by_fkey(name),
          department:departments(name)
        `);
      
      if (reportType === "device_control") {
        // Device Control Tasks - department-level tasks with location_based type
        if (!departmentId) {
          console.error("Department ID is missing:", departmentId);
          showError("Department information is not available. Please refresh the page and try again.");
          return;
        }
        tasksQuery = tasksQuery
          .eq("department_id", departmentId)
          .eq("task_type", "location_based");
      } else {
        // Regular Tasks - tasks without department_id (employee-level tasks)
        tasksQuery = tasksQuery.is("department_id", null);
      }
      
      const { data, error } = await tasksQuery
        .order("created_at", { ascending: false });

      if (error) {
        console.error("TaskReport fetch error:", error);
        showError("Failed to fetch report data");
        return;
      }

      console.log("TaskReport data:", data, "Report type:", reportType, "Department ID:", departmentId);

      const formattedTasks = data?.map((task: any) => ({
        id: task.id,
        title: task.title,
        started_at: task.started_at,
        completed_at: task.completed_at,
        approved_at: task.approved_at,
        created_at: task.created_at,
        deadline: task.deadline,
        priority: task.priority,
        status: task.status,
        employee_name: task.employee?.name || "Unassigned",
        department_name: task.department?.name || "Unknown",
        assigned_by_name: task.assigner?.name || "Unknown",
      })) || [];

      setTasks(formattedTasks);
    } catch (error) {
      showError("Failed to fetch report data");
    }
  };

  const calculateTimeSpent = (startedAt: string | null, completedAt: string | null) => {
    if (!startedAt || !completedAt) return "N/A";
    const minutes = differenceInMinutes(new Date(completedAt), new Date(startedAt));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const generatePDF = () => {
    setIsGenerating(true);

    try {
      const doc = new jsPDF();

      // Header based on report type
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      const reportTitle = reportType === "device_control" ? "Device Control Task Report" : "Task Progress Report";
      doc.text(reportTitle, 14, 20);

      // Department Info
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Department: ${department?.name || "N/A"}`, 14, 30);
      doc.text(`Report Date: ${format(new Date(), "PPP")}`, 14, 38);
      doc.text(`Report Type: ${reportType === "device_control" ? "Device Control Tasks" : "Regular Tasks"}`, 14, 46);

      // Summary Statistics
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === "completed").length;
      const pendingTasks = tasks.filter(t => t.status === "pending").length;
      const inProgressTasks = tasks.filter(t => t.status === "in_progress").length;
      
      const totalTimeSpent = tasks.reduce((acc, task) => {
        if (task.started_at && task.completed_at) {
          return acc + differenceInMinutes(new Date(task.completed_at), new Date(task.started_at));
        }
        return acc;
      }, 0);

      const avgTime = completedTasks > 0 ? Math.round(totalTimeSpent / completedTasks) : 0;
      const avgHours = Math.floor(avgTime / 60);
      const avgMins = avgTime % 60;

      doc.setFontSize(10);
      doc.text(`Total Tasks: ${totalTasks}`, 14, 56);
      doc.text(`Completed: ${completedTasks}`, 14, 62);
      doc.text(`Pending: ${pendingTasks}`, 14, 68);
      doc.text(`In Progress: ${inProgressTasks}`, 14, 74);
      doc.text(`Average Time per Completed Task: ${avgHours}h ${avgMins}m`, 14, 80);

      // Tasks Table
      let tableData: string[][];
      let headers: string[];

      if (reportType === "device_control") {
        // Device Control Tasks table
        tableData = tasks.map(task => [
          task.title,
          task.employee_name,
          task.assigned_by_name,
          format(new Date(task.created_at), "PP"),
          task.deadline ? format(new Date(task.deadline), "PP") : "N/A",
          task.priority.toUpperCase(),
          task.status.replace("_", " ").toUpperCase(),
          calculateTimeSpent(task.started_at, task.completed_at),
        ]);

        headers = ["Task", "Employee", "Assigned By", "Date Assigned", "Deadline", "Priority", "Status", "Time Spent"];
      } else {
        // Regular Tasks table
        tableData = tasks.map(task => [
          task.title,
          task.employee_name,
          task.assigned_by_name,
          format(new Date(task.created_at), "PP"),
          calculateTimeSpent(task.started_at, task.completed_at),
          task.approved_at ? format(new Date(task.approved_at), "PP") : "N/A",
        ]);

        headers = ["Task", "Employee", "Assigned By", "Date Assigned", "Time Spent", "Approved On"];
      }

      autoTable(doc, {
        startY: 88,
        head: [headers],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
        columnStyles: reportType === "device_control" ? {
          0: { cellWidth: 30 },
          1: { cellWidth: 20 },
          2: { cellWidth: 20 },
          3: { cellWidth: 20 },
          4: { cellWidth: 20 },
          5: { cellWidth: 15 },
          6: { cellWidth: 15 },
          7: { cellWidth: 15 },
        } : {
          0: { cellWidth: 35 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 20 },
          5: { cellWidth: 25 },
        },
      });

      // Save PDF
      const reportTypeName = reportType === "device_control" ? "DeviceControl" : "Regular";
      const fileName = `${reportTypeName}_Task_Report_${department?.name || "Department"}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
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
    const reportTypeName = reportType === "device_control" ? "Device Control Task Report" : "Task Progress Report";
    const completedTasks = tasks.filter(t => t.status === "completed").length;
    const pendingTasks = tasks.filter(t => t.status === "pending").length;
    const inProgressTasks = tasks.filter(t => t.status === "in_progress").length;

    let summary = `
*${reportTypeName} - ${department?.name || "Department"}*
Date: ${format(new Date(), "PPP")}

Total Tasks: ${tasks.length}
Completed: ${completedTasks}
Pending: ${pendingTasks}
In Progress: ${inProgressTasks}

`;

    if (reportType === "device_control") {
      summary += `Recent Device Control Tasks:
${tasks.slice(0, 5).map((task, i) => 
  `${i + 1}. ${task.title}
   Employee: ${task.employee_name}
   Priority: ${task.priority.toUpperCase()}
   Status: ${task.status.replace("_", " ").toUpperCase()}
   Deadline: ${task.deadline ? format(new Date(task.deadline), "PP") : "N/A"}`
).join("\n\n")}`;
    } else {
      summary += `Recent Completed Tasks:
${tasks.slice(0, 5).map((task, i) => 
  `${i + 1}. ${task.title}
   Employee: ${task.employee_name}
   Time Spent: ${calculateTimeSpent(task.started_at, task.completed_at)}`
).join("\n\n")}`;
    }

    summary += `
${tasks.length > 5 ? `\n...and ${tasks.length - 5} more tasks` : ""}
    `.trim();

    const encodedMessage = encodeURIComponent(summary);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Task Reports</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Generate and share department task progress</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={generatePDF} 
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

      {/* Report Type Selector */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <Label className="text-sm font-medium">Report Type</Label>
            <Select value={reportType} onValueChange={(value: "regular" | "device_control") => setReportType(value)}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular Tasks</SelectItem>
                <SelectItem value="device_control" disabled={!departmentId}>
                  Device Control Tasks {!departmentId && "(Department Not Assigned)"}
                </SelectItem>
              </SelectContent>
            </Select>
            {!departmentId && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800 mb-2">
                  Device Control Tasks require department assignment.
                </p>
                <p className="text-xs text-yellow-700">
                  Click "Assign Department" in the header to automatically assign yourself to the Purchasing Department.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:gap-4 mb-6 grid-cols-1 sm:grid-cols-3">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-primary/10 p-2 sm:p-3 rounded-lg">
              <Calendar className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground">Total Tasks</p>
              <p className="text-xl sm:text-2xl font-bold">{tasks.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-success/10 p-2 sm:p-3 rounded-lg">
              <Calendar className="h-4 w-4 sm:h-6 sm:w-6 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground">Completed</p>
              <p className="text-xl sm:text-2xl font-bold">
                {tasks.filter(t => t.status === "completed").length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-warning/10 p-2 sm:p-3 rounded-lg">
              <Calendar className="h-4 w-4 sm:h-6 sm:w-6 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {reportType === "device_control" ? "In Progress" : "Avg Time/Task"}
              </p>
              <p className="text-xl sm:text-2xl font-bold">
                {reportType === "device_control" ? (
                  tasks.filter(t => t.status === "in_progress").length
                ) : (
                  tasks.length > 0 ? (() => {
                    const total = tasks.reduce((acc, task) => {
                      if (task.started_at && task.completed_at) {
                        return acc + differenceInMinutes(new Date(task.completed_at), new Date(task.started_at));
                      }
                      return acc;
                    }, 0);
                    const avg = Math.round(total / tasks.length);
                    const hours = Math.floor(avg / 60);
                    const mins = avg % 60;
                    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                  })() : "N/A"
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-3 sm:p-4">
        <h3 className="font-semibold text-sm sm:text-base mb-3 sm:mb-4">
          {reportType === "device_control" ? "Device Control Tasks" : "Recent Tasks"}
        </h3>
        <div className="space-y-2">
          {tasks.slice(0, 10).map(task => (
            <div key={task.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm sm:text-base truncate">{task.title}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {task.employee_name} • Assigned by {task.assigned_by_name}
                  {reportType === "device_control" && task.deadline && (
                    <span> • Due: {format(new Date(task.deadline), "PP")}</span>
                  )}
                  {reportType === "regular" && (
                    <span> • {format(new Date(task.created_at), "MMM d, yyyy")}</span>
                  )}
                </p>
              </div>
              <div className="text-left sm:text-right flex-shrink-0">
                {reportType === "device_control" ? (
                  <>
                    <p className="text-xs sm:text-sm font-medium">{task.priority.toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.status === "completed" 
                        ? `Completed ${task.completed_at ? format(new Date(task.completed_at), "MMM d") : ""}`
                        : task.status === "in_progress" 
                        ? `Started ${task.started_at ? format(new Date(task.started_at), "MMM d") : ""}`
                        : "Assigned"
                      }
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs sm:text-sm font-medium">
                      {task.status === "completed" ? calculateTimeSpent(task.started_at, task.completed_at) : "Assigned"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {task.status === "completed" && task.approved_at 
                        ? format(new Date(task.approved_at), "PP")
                        : format(new Date(task.created_at), "PP")
                      }
                    </p>
                  </>
                )}
              </div>
            </div>
          ))}

          {tasks.length === 0 && (
            <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
              {reportType === "device_control" ? "No device control tasks yet" : "No completed tasks yet"}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default TaskReport;
