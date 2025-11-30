import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { showError } from "@/lib/sweetalert";
import { Users, CheckCircle2, Clock } from "lucide-react";

interface ChecklistItem {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  completed_by_employee: { name: string } | null;
}

interface Checklist {
  id: string;
  title: string;
  description: string | null;
  department_id: string | null;
  status: string;
  items: ChecklistItem[];
  assigned_employees: Array<{
    id: string;
    employee_id: string;
    employee: { name: string; id: string };
  }>;
}

interface ChecklistViewProps {
  departmentHeadId: string;
  departmentId: string | null;
}

const ChecklistView = ({ departmentHeadId, departmentId }: ChecklistViewProps) => {
  const { id } = useParams<{ id: string }>();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);

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
            completed_by_employee:employees!checklist_items_completed_by_fkey(name)
          ),
          assigned_employees:checklist_assignments(
            id,
            employee_id,
            employee:employees!checklist_assignments_employee_id_fkey(name, id)
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
              <p className="text-sm text-muted-foreground">Progress</p>
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
        </CardContent>
      </Card>

      {/* Assigned Employees */}
      {checklist.assigned_employees && checklist.assigned_employees.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Assigned Employees</CardTitle>
            <CardDescription>
              Employees assigned to this checklist
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {checklist.assigned_employees.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full"
                >
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm">{assignment.employee.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checklist Items */}
      <Card>
        <CardHeader>
          <CardTitle>Checklist Items</CardTitle>
          <CardDescription>View all items in this checklist</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {checklist.items && checklist.items.length > 0 ? (
              checklist.items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-4 border rounded-lg ${
                    item.is_completed ? "bg-green-50 border-green-200" : "bg-card"
                  }`}
                >
                  <div className="mt-1">
                    {item.is_completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${item.is_completed ? "line-through text-muted-foreground" : ""}`}>
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    )}
                    {item.is_completed && item.completed_by_employee && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Completed by {item.completed_by_employee.name}
                        {item.completed_at && (
                          <> on {new Date(item.completed_at).toLocaleDateString()}</>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No items in this checklist</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChecklistView;

