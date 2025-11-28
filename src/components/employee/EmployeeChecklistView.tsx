import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { showSuccess, showError } from "@/lib/sweetalert";
import { CheckCircle2, Clock, Circle } from "lucide-react";
import { notifyChecklistItemCompleted } from "@/lib/whatsappService";

interface ChecklistItem {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
}

interface Checklist {
  id: string;
  title: string;
  description: string | null;
  assigned_to_dept_head: string | null;
  department_id: string | null;
  status: string;
  items: ChecklistItem[];
  dept_head: { name: string; id: string } | null;
  created_by_employee: { name: string; id: string } | null;
}

interface EmployeeChecklistViewProps {
  employeeId: string;
}

const EmployeeChecklistView = ({ employeeId }: EmployeeChecklistViewProps) => {
  const { id } = useParams<{ id: string }>();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchChecklist();
    }
  }, [id, employeeId]);

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
            completed_at
          ),
          dept_head:employees!checklists_assigned_to_dept_head_fkey(name, id),
          created_by_employee:employees!checklists_created_by_fkey(name, id)
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

  const handleToggleItem = async (itemId: string, currentStatus: boolean) => {
    if (completing) return; // Prevent multiple simultaneous updates
    
    setCompleting(itemId);
    try {
      const item = checklist?.items.find(i => i.id === itemId);
      if (!item) return;

      const newStatus = !currentStatus;

      const updateData: any = {
        is_completed: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus) {
        updateData.completed_by = employeeId;
        updateData.completed_at = new Date().toISOString();
      } else {
        updateData.completed_by = null;
        updateData.completed_at = null;
      }

      const { error } = await supabase
        .from("checklist_items")
        .update(updateData)
        .eq("id", itemId);

      if (error) throw error;

      // Refresh checklist data
      await fetchChecklist();

      // Send WhatsApp notification if item was completed
      if (newStatus && checklist) {
        const checklistUrl = `${window.location.origin}/checklist/${checklist.id}`;
        await notifyChecklistItemCompleted(
          checklist.title,
          item.title,
          employeeId,
          checklist.assigned_to_dept_head,
          checklist.created_by_employee?.id || null,
          checklist.id,
          checklistUrl
        );
      }

      showSuccess(newStatus ? "Item marked as completed!" : "Item unchecked");
    } catch (error: any) {
      console.error("Error updating checklist item:", error);
      showError(error?.message || "Failed to update item");
    } finally {
      setCompleting(null);
    }
  };

  const getProgress = () => {
    if (!checklist?.items) return { completed: 0, total: 0, percentage: 0 };
    const total = checklist.items.length;
    const completed = checklist.items.filter(item => item.is_completed).length;
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
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

  const progress = getProgress();
  const allCompleted = progress.completed === progress.total && progress.total > 0;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">{checklist.title}</h2>
        {checklist.description && (
          <p className="text-muted-foreground">{checklist.description}</p>
        )}
      </div>

      {/* Progress Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Your Progress</p>
              <p className="text-2xl font-bold">
                {progress.completed} / {progress.total}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Completion</p>
              <p className="text-2xl font-bold">{progress.percentage}%</p>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-gradient-primary h-2 rounded-full transition-all"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          {allCompleted && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                All items completed! Great work!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checklist Items */}
      <Card>
        <CardHeader>
          <CardTitle>Checklist Items</CardTitle>
          <CardDescription>
            Click the checkbox to mark items as completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {checklist.items && checklist.items.length > 0 ? (
              checklist.items.map((item) => {
                const isCompleting = completing === item.id;
                const isCompleted = item.is_completed;
                
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-4 border rounded-lg transition-all ${
                      isCompleted
                        ? "bg-green-50 border-green-200"
                        : "bg-card hover:bg-muted/50"
                    } ${isCompleting ? "opacity-50" : ""}`}
                  >
                    <div className="mt-1">
                      <Checkbox
                        checked={isCompleted}
                        onCheckedChange={() => handleToggleItem(item.id, isCompleted)}
                        disabled={isCompleting}
                        className="h-5 w-5"
                      />
                    </div>
                    <div className="flex-1">
                      <p
                        className={`font-medium ${
                          isCompleted ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      )}
                      {isCompleted && item.completed_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Completed on {new Date(item.completed_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {isCompleting && (
                      <Clock className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
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

export default EmployeeChecklistView;

