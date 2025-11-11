import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { showSuccess, showError } from "@/lib/sweetalert";
import { CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { notifyTaskVerificationApproved, notifyTaskVerificationRejected, notifyTaskApproved, notifyTaskRejected } from "@/lib/notificationService";
import { TaskReassignmentService } from "@/lib/taskReassignmentService";
import { SimpleTaskReassignmentService } from "@/lib/simpleTaskReassignment";
import { notifyAdminVerificationApproved, notifyAdminVerificationRejected } from "@/lib/whatsappService";

interface VerificationRequest {
  id: string;
  task_id: string;
  requested_by: string;
  status: string;
  admin_reason: string | null;
  created_at: string;
  task: {
    title: string;
    description: string;
    assigned_to: string;
    status: string;
    completed_at: string;
    department_id?: string;
    employee?: {
      name: string;
      email: string;
      role?: string;
    };
  };
  requester: {
    name: string;
    email: string;
    role?: string;
  };
}

interface TaskVerificationProps {
  adminId: string;
}

const TaskVerification = ({ adminId }: TaskVerificationProps) => {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [adminDepartmentIds, setAdminDepartmentIds] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (adminId) {
      fetchAdminDepartments();
    } else {
      console.warn("TaskVerification: No adminId provided");
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => {
    console.log("TaskVerification useEffect:", { 
      adminDepartmentIds: adminDepartmentIds.length, 
      adminId, 
      isSuperAdmin 
    });
    
    if (adminDepartmentIds.length > 0 || !adminId || isSuperAdmin) {
      fetchRequests();
      
      // Subscribe to real-time updates
      const channel = supabase
        .channel("task-verifications")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "task_verification_requests",
          },
          () => {
            fetchRequests();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      console.log("TaskVerification: Waiting for department data...");
    }
  }, [adminDepartmentIds, isSuperAdmin]);

  const fetchAdminDepartments = async () => {
    try {
      if (!adminId) {
        console.log("TaskVerification: No adminId, setting empty departments");
        setAdminDepartmentIds([]);
        setIsSuperAdmin(false);
        return;
      }

      console.log("TaskVerification: Fetching admin departments for", adminId);

      // Check if user is super_admin
      const { data: employeeData, error: employeeError } = await supabase
        .from("employees")
        .select("role")
        .eq("id", adminId)
        .single();

      if (employeeError) {
        console.error("TaskVerification: Error fetching employee role:", employeeError);
        setAdminDepartmentIds([]);
        setIsSuperAdmin(false);
        return;
      }

      console.log("TaskVerification: Employee role:", employeeData?.role);

      if (employeeData?.role === "super_admin") {
        // Super admin sees all verification requests
        console.log("TaskVerification: User is super admin");
        setIsSuperAdmin(true);
        setAdminDepartmentIds([]);
        return;
      }

      setIsSuperAdmin(false);
      
      // Fetch admin's assigned departments
      const { data, error } = await supabase
        .from("admin_departments")
        .select("department_id")
        .eq("admin_id", adminId);

      if (error) {
        console.error("TaskVerification: Failed to fetch admin departments:", error);
        setAdminDepartmentIds([]);
        return;
      }

      const deptIds = (data || []).map(ad => ad.department_id);
      console.log("TaskVerification: Admin department IDs:", deptIds);
      setAdminDepartmentIds(deptIds);
    } catch (err) {
      console.error("TaskVerification: Exception in fetchAdminDepartments:", err);
      setAdminDepartmentIds([]);
      setIsSuperAdmin(false);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
    
      let query = supabase
        .from("task_verification_requests")
        .select(`
          *,
          task:tasks (
            title,
            description,
            assigned_to,
            status,
            completed_at,
            department_id,
            assigned_employee:employees!tasks_assigned_to_fkey (
              name,
              email,
              role
            )
          ),
          requester:employees!task_verification_requests_requested_by_fkey (
            name,
            email,
            role
          )
        `)
        .order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching verification requests:", error);
        showError("Failed to load verification requests");
        setLoading(false);
        return;
      }

      console.log("TaskVerification: Raw data from query:", data);

      // Transform data to match interface
      const transformedData = (data || []).map((request: any) => ({
        ...request,
        task: {
          ...request.task,
          employee: request.task?.assigned_employee || null
        }
      }));

      // Filter by admin's departments if not super admin
      let filteredData = transformedData;
      if (!isSuperAdmin && adminId && adminDepartmentIds.length > 0) {
        filteredData = transformedData.filter((request: any) => 
          request.task?.department_id && adminDepartmentIds.includes(request.task.department_id)
        );
      }

      console.log("TaskVerification: Filtered data:", filteredData);
      setRequests(filteredData);
    } catch (err) {
      console.error("Exception in fetchRequests:", err);
      showError("An error occurred while loading verification requests");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string, taskId: string) => {
    // Get request details for notifications
    const request = requests.find(r => r.id === requestId);
    
    const { error: verificationError } = await supabase
      .from("task_verification_requests")
      .update({
        status: "approved",
        approved_by: adminId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (verificationError) {
      showError("Failed to approve request");
      return;
    }

    const { error: taskError } = await supabase
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", taskId);

    if (taskError) {
      showError("Failed to update task status");
      return;
    }

    showSuccess("Task verified and marked as completed");
    
    // Send notifications to employee and department head
    if (request) {
      const { data: adminData } = await supabase
        .from("employees")
        .select("name")
        .eq("id", adminId)
        .single();
      
      const adminName = adminData?.name || "Admin";
      
      // Push notifications
      if (request.task.assigned_to) {
        await notifyTaskApproved(request.task.title, adminName, request.task.assigned_to);
      }
      
      await notifyTaskVerificationApproved(request.task.title, request.task.assigned_to, request.requested_by);

      // WhatsApp notification to employee about admin verification approval
      if (request.task.assigned_to) {
        await notifyAdminVerificationApproved(
          request.task.title,
          request.task.assigned_to,
          adminName,
          taskId
        );
      }
    }
    
    fetchRequests();
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    if (!rejectReason.trim()) {
      showError("Please provide a reason for rejection");
      return;
    }

    const { error: verificationError } = await supabase
      .from("task_verification_requests")
      .update({
        status: "rejected",
        approved_by: adminId,
        approved_at: new Date().toISOString(),
        admin_reason: rejectReason,
      })
      .eq("id", selectedRequest.id);

    if (verificationError) {
      showError("Failed to reject request");
      return;
    }

    // Automatically reassign only the rejected task to employee
    const result = await SimpleTaskReassignmentService.reassignRejectedTask(
      selectedRequest.task_id,
      adminId,
      rejectReason
    );

    if (result.success) {
      showSuccess("Request rejected. Task reassigned to employee. Employee notified via WhatsApp.");
    } else {
      // Fallback: just update task status
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ status: "pending" })
        .eq("id", selectedRequest.task_id);

      if (taskError) {
        showError("Failed to update task status");
        return;
      }

      showSuccess("Request rejected and task sent back to employee");
      
      // Send notifications
      const { data: adminData } = await supabase
        .from("employees")
        .select("name")
        .eq("id", adminId)
        .single();
      
      const adminName = adminData?.name || "Admin";
      
      // Push notifications
      await notifyTaskVerificationRejected(
        selectedRequest.task.title,
        selectedRequest.requested_by,
        adminName
      );
      
      if (selectedRequest.task.assigned_to) {
        await notifyTaskRejected(
          selectedRequest.task.title,
          adminName,
          selectedRequest.task.assigned_to,
          rejectReason
        );
      }

      // WhatsApp notifications for admin verification rejection
      if (selectedRequest.task.assigned_to) {
        await notifyAdminVerificationRejected(
          selectedRequest.task.title,
          selectedRequest.task.assigned_to,
          selectedRequest.requested_by,
          adminName,
          rejectReason,
          selectedRequest.task_id
        );
      }
    }
    
    setShowRejectDialog(false);
    setSelectedRequest(null);
    setRejectReason("");
    fetchRequests();
  };

  const openRejectDialog = (request: VerificationRequest) => {
    setSelectedRequest(request);
    setShowRejectDialog(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingRequests = requests.filter(r => r.status === "pending");
  const processedRequests = requests.filter(r => r.status !== "pending");

  console.log("TaskVerification render:", { 
    loading, 
    requestsCount: requests.length, 
    pendingCount: pendingRequests.length,
    adminId,
    isSuperAdmin
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading verification requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <AlertCircle className="h-6 w-6" />
          Task Verification
        </h2>
        <p className="text-muted-foreground mt-1">
          Review and approve task completions from department heads
        </p>
      </div>

      {pendingRequests.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            Pending Approvals ({pendingRequests.length})
          </h3>
          {pendingRequests.map((request) => {
            if (!request || !request.task || !request.requester) {
              console.error("Invalid request data:", request);
              return null;
            }
            return (
            <Card key={request.id} className="p-6 border-l-4 border-l-yellow-500">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-lg font-semibold">{request.task.title || "Untitled Task"}</h4>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {request.task.description || "No description"}
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">
                          {request.task.employee?.role === "department_head" ? "Dept Head:" : "Employee:"}
                        </span>{" "}
                        {request.task.employee?.name || request.requester?.name || "Unknown"}
                      </div>
                      <div>
                        <span className="font-medium">Verified by:</span>{" "}
                        {request.requester.name || "Unknown"}
                      </div>
                      <div>
                        <span className="font-medium">Completed:</span>{" "}
                        {request.task.completed_at ? new Date(request.task.completed_at).toLocaleString() : "N/A"}
                      </div>
                      <div>
                        <span className="font-medium">Requested:</span>{" "}
                        {new Date(request.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() => handleApprove(request.id, request.task_id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => openRejectDialog(request)}
                    variant="destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      {processedRequests.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Processed Requests</h3>
          {processedRequests.map((request) => {
            if (!request || !request.task || !request.requester) {
              console.error("Invalid processed request data:", request);
              return null;
            }
            return (
            <Card key={request.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold">{request.task.title || "Untitled Task"}</h4>
                    {getStatusBadge(request.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div>
                      {request.task.employee?.role === "department_head" ? "Dept Head: " : "Employee: "}
                      {request.task.employee?.name || request.requester?.name || "Unknown"}
                    </div>
                    <div>Verified by: {request.requester.name || "Unknown"}</div>
                  </div>
                  {request.admin_reason && (
                    <div className="mt-3 p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium">Admin Reason:</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {request.admin_reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      {requests.length === 0 && (
        <Card className="p-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No verification requests found</p>
        </Card>
      )}

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Task Verification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason for Rejection *</Label>
              <Textarea
                id="reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this task verification is being rejected..."
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleReject}
                variant="destructive"
                className="flex-1"
              >
                Reject with Reason
              </Button>
              <Button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectReason("");
                  setSelectedRequest(null);
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskVerification;
