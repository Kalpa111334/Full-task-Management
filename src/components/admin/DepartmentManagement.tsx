import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { showSuccess, showError, showConfirm } from "@/lib/sweetalert";
import { Plus, Edit, Trash2, Building2, Users } from "lucide-react";

interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

const DepartmentManagement = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employeeCounts, setEmployeeCounts] = useState<Record<string, number>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      showError("Failed to fetch departments");
      return;
    }

    setDepartments(data || []);

    // Fetch employee counts for each department
    const counts: Record<string, number> = {};
    for (const dept of data || []) {
      const { count } = await supabase
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("department_id", dept.id);
      counts[dept.id] = count || 0;
    }
    setEmployeeCounts(counts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingDepartment) {
      const { error } = await supabase
        .from("departments")
        .update({
          name: formData.name,
          description: formData.description || null,
        })
        .eq("id", editingDepartment.id);

      if (error) {
        showError("Failed to update department");
        return;
      }

      showSuccess("Department updated successfully");
    } else {
      const { error } = await supabase.from("departments").insert([
        {
          name: formData.name,
          description: formData.description || null,
        },
      ]);

      if (error) {
        showError("Failed to add department");
        return;
      }

      showSuccess("Department added successfully");
    }

    setIsDialogOpen(false);
    resetForm();
    fetchDepartments();
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm(
      "Delete Department",
      "Are you sure you want to delete this department? Employees will be unassigned."
    );
    if (!confirmed) return;

    const { error } = await supabase.from("departments").delete().eq("id", id);

    if (error) {
      showError("Failed to delete department");
      return;
    }

    showSuccess("Department deleted successfully");
    fetchDepartments();
  };

  const openEditDialog = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingDepartment(null);
    setFormData({
      name: "",
      description: "",
    });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-lg sm:text-2xl font-bold">Department Management</h2>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary w-full sm:w-auto" size="sm">
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              Add Department
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingDepartment ? "Edit Department" : "Add New Department"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Department Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Sales, Engineering, Marketing"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the department"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="bg-gradient-primary flex-1">
                  {editingDepartment ? "Update Department" : "Add Department"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((department) => (
          <Card key={department.id} className="p-3 sm:p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <div className="bg-gradient-primary p-2 sm:p-3 rounded-lg">
                <Building2 className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="flex gap-1 sm:gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(department)}>
                  <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(department.id)}>
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>

            <h3 className="font-semibold text-sm sm:text-lg mb-2 truncate">{department.name}</h3>
            {department.description && (
              <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">{department.description}</p>
            )}

            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>{employeeCounts[department.id] || 0} employees</span>
            </div>
          </Card>
        ))}

        {departments.length === 0 && (
          <Card className="p-12 col-span-full text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No departments yet. Add your first department to get started.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DepartmentManagement;
