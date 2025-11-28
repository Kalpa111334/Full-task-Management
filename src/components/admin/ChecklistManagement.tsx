import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { showSuccess, showError } from "@/lib/sweetalert";
import { Plus, Trash2, CheckCircle2, XCircle, ClipboardList } from "lucide-react";
import { notifyDeptHeadChecklistAssigned } from "@/lib/whatsappService";

interface ChecklistItem {
  id?: string;
  title: string;
  description: string;
  order_index: number;
}

interface Checklist {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  assigned_to_dept_head: string | null;
  department_id: string | null;
  status: string;
  created_at: string;
  dept_head: { name: string } | null;
  department: { name: string } | null;
  items_count: number;
  completed_items_count: number;
}

interface DepartmentHead {
  id: string;
  name: string;
  department_id: string | null;
  department: { name: string } | null;
}

interface ChecklistManagementProps {
  adminId: string;
}

const ChecklistManagement = ({ adminId }: ChecklistManagementProps) => {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [departmentHeads, setDepartmentHeads] = useState<DepartmentHead[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    departmentHeadId: "",
  });
  
  const [items, setItems] = useState<ChecklistItem[]>([
    { title: "", description: "", order_index: 0 },
  ]);

  useEffect(() => {
    fetchChecklists();
    fetchDepartmentHeads();
  }, [adminId]);

  const fetchChecklists = async () => {
    try {
      const { data, error } = await supabase
        .from("checklists")
        .select(`
          *,
          dept_head:employees!checklists_assigned_to_dept_head_fkey(name),
          department:departments(name),
          items:checklist_items(id, is_completed)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const checklistsWithCounts = (data || []).map((checklist: any) => {
        const allItems = checklist.items || [];
        const completedItems = allItems.filter((item: any) => item.is_completed);
        return {
          ...checklist,
          items_count: allItems.length,
          completed_items_count: completedItems.length,
        };
      });

      setChecklists(checklistsWithCounts);
    } catch (error) {
      console.error("Error fetching checklists:", error);
      showError("Failed to fetch checklists");
    }
  };

  const fetchDepartmentHeads = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select(`
          id,
          name,
          department_id,
          department:departments(name)
        `)
        .eq("role", "department_head")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setDepartmentHeads(data || []);
    } catch (error) {
      console.error("Error fetching department heads:", error);
      showError("Failed to fetch department heads");
    }
  };

  const addItem = () => {
    setItems([...items, { title: "", description: "", order_index: items.length }]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index).map((item, i) => ({
      ...item,
      order_index: i,
    }));
    setItems(newItems);
  };

  const updateItem = (index: number, field: keyof ChecklistItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      showError("Please enter a checklist title");
      return;
    }

    if (items.length === 0 || items.some(item => !item.title.trim())) {
      showError("Please add at least one checklist item with a title");
      return;
    }

    if (!formData.departmentHeadId) {
      showError("Please select a department head");
      return;
    }

    setLoading(true);
    try {
      // Get department head info
      const deptHead = departmentHeads.find(dh => dh.id === formData.departmentHeadId);
      if (!deptHead) {
        showError("Department head not found");
        return;
      }

      // Create checklist
      const { data: checklist, error: checklistError } = await supabase
        .from("checklists")
        .insert({
          title: formData.title,
          description: formData.description || null,
          created_by: adminId,
          assigned_to_dept_head: formData.departmentHeadId,
          department_id: deptHead.department_id,
          status: "pending",
        })
        .select()
        .single();

      if (checklistError) throw checklistError;

      // Create checklist items
      const itemsToInsert = items.map((item, index) => ({
        checklist_id: checklist.id,
        title: item.title,
        description: item.description || null,
        order_index: index,
        is_completed: false,
      }));

      const { error: itemsError } = await supabase
        .from("checklist_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Send WhatsApp notification to department head
      const checklistUrl = `${window.location.origin}/checklist/${checklist.id}`;
      await notifyDeptHeadChecklistAssigned(
        formData.title,
        formData.departmentHeadId,
        checklist.id,
        checklistUrl
      );

      showSuccess("Checklist created and assigned successfully!");
      
      // Reset form
      setFormData({ title: "", description: "", departmentHeadId: "" });
      setItems([{ title: "", description: "", order_index: 0 }]);
      setShowCreateForm(false);
      fetchChecklists();
    } catch (error: any) {
      console.error("Error creating checklist:", error);
      showError(error?.message || "Failed to create checklist");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
      in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-800" },
      completed: { label: "Completed", className: "bg-green-100 text-green-800" },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Digital Checklists</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Create and manage digital checklists for department heads
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-gradient-primary"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Checklist
        </Button>
      </div>

      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Checklist</CardTitle>
            <CardDescription>Create a checklist and assign it to a department head</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Checklist Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter checklist title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter checklist description (optional)"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="departmentHead">Assign to Department Head *</Label>
              <Select
                value={formData.departmentHeadId}
                onValueChange={(value) => setFormData({ ...formData, departmentHeadId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department head" />
                </SelectTrigger>
                <SelectContent>
                  {departmentHeads.map((dh) => (
                    <SelectItem key={dh.id} value={dh.id}>
                      {dh.name} {dh.department ? `- ${dh.department.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Checklist Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {items.map((item, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Item title *"
                        value={item.title}
                        onChange={(e) => updateItem(index, "title", e.target.value)}
                      />
                      <Textarea
                        placeholder="Item description (optional)"
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        rows={2}
                      />
                    </div>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={loading} className="bg-gradient-primary">
                {loading ? "Creating..." : "Create & Assign"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setFormData({ title: "", description: "", departmentHeadId: "" });
                  setItems([{ title: "", description: "", order_index: 0 }]);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Checklists</CardTitle>
          <CardDescription>View and manage all checklists</CardDescription>
        </CardHeader>
        <CardContent>
          {checklists.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No checklists created yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Department Head</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checklists.map((checklist) => (
                    <TableRow key={checklist.id}>
                      <TableCell className="font-medium">{checklist.title}</TableCell>
                      <TableCell>{checklist.dept_head?.name || "N/A"}</TableCell>
                      <TableCell>{checklist.department?.name || "N/A"}</TableCell>
                      <TableCell>
                        {checklist.items_count > 0
                          ? `${checklist.completed_items_count}/${checklist.items_count}`
                          : "0/0"}
                      </TableCell>
                      <TableCell>{getStatusBadge(checklist.status)}</TableCell>
                      <TableCell>
                        {new Date(checklist.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ChecklistManagement;

