import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EmployeeLocation {
  id: string;
  name: string;
  role?: string;
  location_lat: number | null;
  location_lng: number | null;
  battery_level: number | null;
  last_location_update: string | null;
}

interface EmployeeTrackerProps {
  departmentId: string;
  onLocationUpdate: (employees: EmployeeLocation[]) => void;
}

const EmployeeTracker = ({ departmentId, onLocationUpdate }: EmployeeTrackerProps) => {
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    fetchEmployeeLocations();

    // Set up real-time subscription for all employees
    const channel = supabase
      .channel("employee-locations")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "employees" },
        () => {
          fetchEmployeeLocations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId]);

  const fetchEmployeeLocations = async () => {
    let query = supabase
      .from("employees")
      .select("id, name, role, location_lat, location_lng, battery_level, last_location_update, department_id");
    
    // Show all active employees regardless of department and location data
    const { data, error } = await query
      .eq("is_active", true);

    if (error) {
      console.error("Failed to fetch employee locations:", error);
      return;
    }

    console.log("Fetched all employees:", data);
    
    // Filter employees with location data for map display
    const employeesWithLocation = data?.filter(emp => 
      emp.location_lat !== null && 
      emp.location_lng !== null
    ) || [];
    
    console.log("Employees with location data:", employeesWithLocation);
    onLocationUpdate(employeesWithLocation);
  };

  // Self-location publishing is handled by SelfLocationPublisher mounted at page level

  return null;
};

export default EmployeeTracker;
