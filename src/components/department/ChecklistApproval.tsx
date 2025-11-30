import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { showSuccess, showError } from "@/lib/sweetalert";
import { CheckCircle2, XCircle, Clock, User } from "lucide-react";
import { notifyChecklistItemApproved, notifyChecklistItemRejected } from "@/lib/whatsappService";

interface ChecklistItem {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  completed_by_employee: { name: string; id: string } | null;
}

interface Checklist {
  id: string;
  title: string;
  description: string | null;
  department_id: string | null;
  status: string;
  items: ChecklistItem[];
}

interface ChecklistApprovalProps {
  departmentHeadId: string;
}

const ChecklistApproval = ({ departmentHeadId }: ChecklistApprovalProps) => {
  const { id } = useParams<{ id: string }>();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (id) {
      fetchChecklist();
    }
  }, [id]);

  const fetchChecklist = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("checklists")
        .select(`
          *,
          items:checklist_items(
            id,
            title,
            description,
            order_index,
            is_completed,
            completed_by,
            completed_at,
            approval_status,
            approved_by,
            approved_at,
            rejection_reason,
            completed_by_employee:employees!checklist_items_completed_by_fkey(name, id)
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      // Sort items by order_index
      if (data?.items) {
        data.items.sort((a: ChecklistItem, b: ChecklistItem) => a.order_index - b.order_index);
      }

      setChecklist(data);
    } catch (error: any) {
      console.error("Error fetching checklist:", error);
      showError(error?.message || "Failed to fetch checklist");
    } finally {
      setLoading(false);
    }
  };

  const updateChecklistStatusIfNeeded = async () => {
    if (!id) return;
    
    try {
      // Fetch all items with their approval status
      const { data: allItems, error: itemsError } = await supabase
        .from("checklist_items")
        .select("id, is_completed, approval_status")
        .eq("checklist_id", id);
      
      if (itemsError || !allItems || allItems.length === 0) return;
      
      const completedItems = allItems.filter(item => item.is_completed);
      const totalItems = allItems.length;
      
      // Determine new status based on completion and approval
      let newStatus = "pending";
      if (completedItems.length > 0) {
        const allCompletedApproved = completedItems.every(item => item.approval_status === "approved");
        // If all items are completed AND all completed items are approved, status is "completed"
        if (allCompletedApproved && completedItems.length === totalItems) {
          newStatus = "completed";
        } else {
          // If some items are completed but not all approved, status is "in_progress"
          newStatus = "in_progress";
        }
      }
      
      // Always update status to reflect current state
      const { error: updateError } = await supabase
        .from("checklists")
        .update({ status: newStatus })
        .eq("id", id);
      
      if (!updateError) {
        // Refresh checklist data to show updated status
        await fetchChecklist();
      } else {
        console.error("Error updating checklist status:", updateError);
      }
    } catch (error) {
      console.error("Error updating checklist status:", error);
    }
  };

  const checkAndUpdateChecklistStatus = async () => {
    if (!checklist || !id) return;
    
    try {
      // Fetch all items with their approval status
      const { data: allItems, error: itemsError } = await supabase
        .from("checklist_items")
        .select("id, is_completed, approval_status")
        .eq("checklist_id", id);
      
      if (itemsError) {
        console.error("Error fetching items:", itemsError);
        return;
      }
      
      if (!allItems || allItems.length === 0) return;
      
      const completedItems = allItems.filter(item => item.is_completed);
      const allCompletedApproved = completedItems.length > 0 && 
        completedItems.every(item => item.approval_status === "approved");
      
      // If all completed items are approved, update checklist status to "completed"
      if (allCompletedApproved && checklist.status !== "completed") {
        const { error: updateError } = await supabase
          .from("checklists")
          .update({ status: "completed" })
          .eq("id", id);
        
        if (updateError) {
          console.error("Error updating checklist status:", updateError);
        } else {
          // Refresh checklist data
          await fetchChecklist();
        }
      }
    } catch (error) {
      console.error("Error checking checklist status:", error);
    }
  };

  const handleApprove = async (itemId: string) => {
    if (!checklist) return;
    
    setProcessing(itemId);
    try {
      const { error } = await supabase
        .from("checklist_items")
        .update({
          approval_status: "approved",
          approved_by: departmentHeadId,
          approved_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq("id", itemId);

      if (error) throw error;

      // Get item details for notification
      const item = checklist.items.find(i => i.id === itemId);
      if (item && item.completed_by) {
        const checklistUrl = `${window.location.origin}/checklist/${checklist.id}`;
        await notifyChecklistItemApproved(
          checklist.title,
          item.title,
          item.completed_by,
          checklist.id,
          checklistUrl
        );
      }

      showSuccess("Item approved successfully!");
      
      // Refresh checklist first
      await fetchChecklist();
      
      // Check and update checklist status immediately
      await updateChecklistStatusIfNeeded();
    } catch (error: any) {
      console.error("Error approving item:", error);
      showError(error?.message || "Failed to approve item");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (itemId: string) => {
    if (!checklist) return;
    
    const reason = rejectionReason[itemId]?.trim();
    if (!reason) {
      showError("Please provide a rejection reason");
      return;
    }

    setProcessing(itemId);
    try {
      const { error } = await supabase
        .from("checklist_items")
        .update({
          approval_status: "rejected",
          approved_by: departmentHeadId,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", itemId);

      if (error) throw error;

      // Get item details for notification
      const item = checklist.items.find(i => i.id === itemId);
      if (item && item.completed_by) {
        const checklistUrl = `${window.location.origin}/checklist/${checklist.id}`;
        await notifyChecklistItemRejected(
          checklist.title,
          item.title,
          item.completed_by,
          reason,
          checklist.id,
          checklistUrl
        );
      }

      showSuccess("Item rejected");
      setRejectionReason(prev => {
        const newReason = { ...prev };
        delete newReason[itemId];
        return newReason;
      });
      await fetchChecklist();
    } catch (error: any) {
      console.error("Error rejecting item:", error);
      showError(error?.message || "Failed to reject item");
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (item: ChecklistItem) => {
    if (item.approval_status === "approved") {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Approved
        </span>
      );
    }
    if (item.approval_status === "rejected") {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Rejected
        </span>
      );
    }
    if (item.is_completed) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Pending Approval
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Not Completed
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Clock className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading checklist...</p>
        </div>
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Checklist not found</p>
      </div>
    );
  }

  const completedItems = checklist.items.filter(item => item.is_completed);
  const pendingApprovalItems = completedItems.filter(item => item.approval_status === "pending");

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">{checklist.title}</h2>
        {checklist.description && (
          <p className="text-muted-foreground">{checklist.description}</p>
        )}
      </div>

      {pendingApprovalItems.length > 0 && (
        <Card className="mb-6 bg-yellow-50 border-yellow-200">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-yellow-800">
              {pendingApprovalItems.length} item(s) pending your approval
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Checklist Items - Approval</CardTitle>
          <CardDescription>
            Review and approve or reject completed checklist items
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {checklist.items && checklist.items.length > 0 ? (
              checklist.items.map((item) => {
                const isProcessing = processing === item.id;
                const canApprove = item.is_completed && item.approval_status === "pending";
                const showRejectionInput = item.approval_status === "pending" && item.is_completed && rejectionReason[item.id] !== undefined;

                return (
                  <Card
                    key={item.id}
                    className={`${
                      item.approval_status === "approved"
                        ? "bg-green-50 border-green-200"
                        : item.approval_status === "rejected"
                        ? "bg-red-50 border-red-200"
                        : item.is_completed
                        ? "bg-yellow-50 border-yellow-200"
                        : ""
                    }`}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium">{item.title}</h3>
                            {getStatusBadge(item)}
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {item.description}
                            </p>
                          )}
                          {item.is_completed && item.completed_by_employee && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <User className="h-4 w-4" />
                              <span>
                                Completed by {item.completed_by_employee.name}
                                {item.completed_at && (
                                  <> on {new Date(item.completed_at).toLocaleDateString()}</>
                                )}
                              </span>
                            </div>
                          )}
                          {item.approval_status === "rejected" && item.rejection_reason && (
                            <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-800">
                              <strong>Rejection Reason:</strong> {item.rejection_reason}
                            </div>
                          )}
                        </div>
                      </div>

                      {canApprove && (
                        <div className="space-y-3 mt-4 pt-4 border-t">
                          {!showRejectionInput ? (
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleApprove(item.id)}
                                disabled={isProcessing}
                                className="bg-green-600 hover:bg-green-700"
                                size="sm"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                {isProcessing ? "Processing..." : "Approve"}
                              </Button>
                              <Button
                                onClick={() => setRejectionReason(prev => ({ ...prev, [item.id]: "" }))}
                                disabled={isProcessing}
                                variant="destructive"
                                size="sm"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Label htmlFor={`rejection-${item.id}`}>
                                Rejection Reason *
                              </Label>
                              <Textarea
                                id={`rejection-${item.id}`}
                                value={rejectionReason[item.id] || ""}
                                onChange={(e) =>
                                  setRejectionReason(prev => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                placeholder="Enter reason for rejection"
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleReject(item.id)}
                                  disabled={isProcessing || !rejectionReason[item.id]?.trim()}
                                  variant="destructive"
                                  size="sm"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  {isProcessing ? "Processing..." : "Confirm Rejection"}
                                </Button>
                                <Button
                                  onClick={() => {
                                    setRejectionReason(prev => {
                                      const newReason = { ...prev };
                                      delete newReason[item.id];
                                      return newReason;
                                    });
                                  }}
                                  variant="outline"
                                  size="sm"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No items in this checklist
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChecklistApproval;

