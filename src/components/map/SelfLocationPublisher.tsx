import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const SelfLocationPublisher = () => {
  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const activeUntilRef = useRef<number | null>(null);
  const lastPositionRef = useRef<GeolocationPosition | null>(null);
  const isMovingRef = useRef<boolean>(false);
  const stationaryCountRef = useRef<number>(0);

  useEffect(() => {
    // Check for persistent tracking ID first
    let trackingEmployeeId = localStorage.getItem("location_tracking_employee_id");
    let trackingEmployeeName = localStorage.getItem("location_tracking_employee_name");
    
    // If not found, check current session and set up persistent tracking
    if (!trackingEmployeeId) {
      const employeeData = localStorage.getItem("employee");
      if (!employeeData) {
        console.log("No employee data found in localStorage");
        return;
      }

      const currentUser = JSON.parse(employeeData);
      if (!currentUser?.id) {
        console.log("No employee ID found in localStorage data");
        return;
      }

      // Enable 8-hour tracking window on first login (like Uber/Pick Me)
      const activeUntil = Date.now() + (8 * 60 * 60 * 1000);
      localStorage.setItem("location_active_until", activeUntil.toString());
      localStorage.setItem("location_tracking_employee_id", currentUser.id);
      localStorage.setItem("location_tracking_employee_name", currentUser.name);
      
      trackingEmployeeId = currentUser.id;
      trackingEmployeeName = currentUser.name;
    }

    console.log("SelfLocationPublisher: Starting location tracking for user:", trackingEmployeeName, trackingEmployeeId);

    if (!('geolocation' in navigator)) {
      console.log("Geolocation not supported by browser");
      return;
    }

    const getBatteryLevel = async (): Promise<number | null> => {
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          return Math.round(battery.level * 100);
        } catch {
          return null;
        }
      }
      return null;
    };

    const publish = async (position: GeolocationPosition) => {
      const now = Date.now();
      if (activeUntilRef.current && now > activeUntilRef.current) {
        console.log("8-hour location tracking window expired");
        return;
      }
      
      // Adaptive rate limiting based on movement (battery optimization)
      // Moving: 30 seconds, Stationary: 60 seconds
      const minInterval = isMovingRef.current ? 30000 : 60000;
      if (now - lastSentAtRef.current < minInterval) {
        return;
      }
      
      // Check if position has changed significantly (at least 10 meters for battery optimization)
      let shouldPublish = true;
      let hasMoved = false;
      
      if (lastPositionRef.current) {
        const prev = lastPositionRef.current;
        const curr = position;
        const dlng = Math.abs(prev.coords.longitude - curr.coords.longitude);
        const dlat = Math.abs(prev.coords.latitude - curr.coords.latitude);
        
        // 10 meters threshold (0.0001 degrees ≈ 10 meters)
        hasMoved = dlng > 0.0001 || dlat > 0.0001;
        shouldPublish = hasMoved;
        
        // Update movement state for adaptive tracking
        if (hasMoved) {
          isMovingRef.current = true;
          stationaryCountRef.current = 0;
        } else {
          stationaryCountRef.current++;
          // If stationary for 3+ readings, mark as not moving
          if (stationaryCountRef.current >= 3) {
            isMovingRef.current = false;
          }
        }
      } else {
        // First position, always publish
        hasMoved = true;
      }

      if (!shouldPublish) return;

      lastSentAtRef.current = now;
      lastPositionRef.current = position;

      const batteryLevel = await getBatteryLevel();
      const timestamp = new Date().toISOString();

      try {
        console.log(`Publishing location for ${trackingEmployeeName}:`, {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          battery: batteryLevel,
          timestamp
        });

        const { error: updateError } = await supabase
          .from("employees")
          .update({
            location_lat: position.coords.latitude,
            location_lng: position.coords.longitude,
            battery_level: batteryLevel,
            last_location_update: timestamp,
          })
          .eq("id", trackingEmployeeId!);

        if (updateError) {
          console.error('Failed to update employee location:', updateError);
        } else {
          console.log('✅ Employee location updated successfully');
        }

        const { error: historyError } = await supabase
          .from("employee_location_history")
          .insert({
            employee_id: trackingEmployeeId!,
            location_lat: position.coords.latitude,
            location_lng: position.coords.longitude,
            battery_level: batteryLevel,
            timestamp,
          });

        if (historyError) {
          console.error('Failed to insert location history:', historyError);
        } else {
          console.log('✅ Location history inserted successfully');
        }
      } catch (e) {
        console.error('Location publish failed', e);
      }
    };

    // Initialize 8h active window from localStorage if present
    const activeUntil = localStorage.getItem("location_active_until");
    if (activeUntil) {
      activeUntilRef.current = parseInt(activeUntil, 10);
    }

    // Start tracking with battery-optimized settings
    const startTracking = async () => {
      const batteryLevel = await getBatteryLevel();
      const useLowAccuracy = batteryLevel !== null && batteryLevel < 20;
      
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          await publish(pos);
        },
        (error) => {
          console.error("Geolocation error:", error);
        },
        {
          // Adaptive accuracy: high when battery > 20%, balanced when low
          enableHighAccuracy: !useLowAccuracy,
          maximumAge: 30000, // Cache position for 30 seconds (battery optimization)
          timeout: 20000,
        }
      );
    };

    startTracking();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  return null;
};

export default SelfLocationPublisher;


