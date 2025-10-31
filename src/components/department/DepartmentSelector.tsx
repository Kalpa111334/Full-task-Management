import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Building2, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showError } from "@/lib/sweetalert";
import DeviceControlTasks from "./DeviceControlTasks";

interface Department {
  id: string;
  name: string;
  description: string | null;
}

interface DepartmentSelectorProps {
  departmentHeadId: string;
  departmentHeadDeptId: string | null;
}

const DepartmentSelector = ({ departmentHeadId, departmentHeadDeptId }: DepartmentSelectorProps) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("name");

    if (error) {
      showError("Failed to load departments");
      return;
    }

    setDepartments(data || []);
  };

  if (selectedDept) {
    return (
      <div>
        <Button
          variant="outline"
          onClick={() => setSelectedDept(null)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Departments
        </Button>
        <DeviceControlTasks
          departmentId={selectedDept.id}
          departmentName={selectedDept.name}
          departmentHeadId={departmentHeadId}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Select Department</h2>
        <p className="text-muted-foreground">
          Choose a department to manage device control tasks
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {departments.map((dept) => (
          <Card
            key={dept.id}
            className="p-6 hover:shadow-lg transition-all cursor-pointer group"
            onClick={() => setSelectedDept(dept)}
          >
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="bg-gradient-primary p-4 rounded-full group-hover:scale-110 transition-transform">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">{dept.name}</h3>
                {dept.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {dept.description}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}

        {departments.length === 0 && (
          <Card className="col-span-full p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No departments available</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DepartmentSelector;
