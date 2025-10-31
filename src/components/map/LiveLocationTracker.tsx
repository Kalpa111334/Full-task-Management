import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyDriverArriving, notifyProximityAlert, notifyGeofenceBreach } from "@/lib/notificationService";

interface LiveLocationTrackerProps {
  adminId?: string;
  supervisorId?: string;
  taskId?: string;
  geofenceCenter?: { lat: number; lng: number };
  geofenceRadius?: number; // meters
  targetProximity?: number; // meters
}

const LiveLocationTracker: React.FC<LiveLocationTrackerProps> = ({
  adminId,
  supervisorId,
  taskId,
  geofenceCenter,
  geofenceRadius = 100,
  targetProximity = 50
}) => {
  const watchIdRef = useRef<number | null>(null);
  const lastNotificationTime = useRef<number>(0);
  const lastProximityAlert = useRef<number>(0);
  const lastGeofenceStatus = useRef<boolean | null>(null);

  useEffect(() => {
    if (!adminId && !supervisorId) {
      console.log('LiveLocationTracker: No admin or supervisor ID provided');
      return;
    }

    console.log('LiveLocationTracker: Starting live location tracking...');

    // Register service worker message handler for background location updates
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    // Start real-time location tracking
    startLiveTracking();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [adminId, supervisorId, geofenceCenter, geofenceRadius, targetProximity]);

  const handleServiceWorkerMessage = (event: MessageEvent) => {
    if (event.data?.type === 'LOCATION_UPDATE') {
      handleLocationUpdate(event.data.location);
    }
  };

  const startLiveTracking = () => {
    if (!('geolocation' in navigator)) {
      console.log('Geolocation not supported');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        await handleLocationUpdate({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        });
      },
      (error) => {
        console.error('Live tracking error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000, // 10 seconds max age for real-time tracking
        timeout: 15000
      }
    );

    // Send message to service worker to start background tracking
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'START_LOCATION_TRACKING'
      });
    }
  };

  const handleLocationUpdate = async (location: any) => {
    try {
      const now = Date.now();
      
      // Check geofence if configured
      if (geofenceCenter) {
        const isInsideGeofence = checkGeofence(location, geofenceCenter, geofenceRadius);
        
        if (lastGeofenceStatus.current !== null && lastGeofenceStatus.current !== isInsideGeofence) {
          // Geofence status changed
          if (!isInsideGeofence) {
            // Employee left the geofence area
            await notifyGeofenceBreach(
              'Employee',
              `Location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
              adminId || supervisorId || ''
            );
          } else {
            // Employee entered the geofence area
            console.log('✅ Employee entered geofence area');
          }
        }
        lastGeofenceStatus.current = isInsideGeofence;
      }

      // Check proximity to target
      if (geofenceCenter && targetProximity) {
        const distance = calculateDistance(location, geofenceCenter);
        
        if (distance <= targetProximity && now - lastProximityAlert.current > 60000) { // 1 minute throttle
          await notifyProximityAlert(
            'Employee',
            Math.round(distance),
            adminId || supervisorId || ''
          );
          lastProximityAlert.current = now;
        }
      }

      // Send live tracking notification if employee is moving significantly
      const shouldNotify = now - lastNotificationTime.current > 30000; // 30 seconds
      if (shouldNotify && adminId) {
        // Send instant notification via service worker
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_INSTANT_NOTIFICATION',
            title: '📍 Live Location Update',
            body: `Employee at: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
            data: {
              action: 'live_location',
              location,
              taskId
            }
          });
        }
        lastNotificationTime.current = now;
      }

    } catch (error) {
      console.error('Error handling location update:', error);
    }
  };

  const checkGeofence = (location: any, center: any, radius: number): boolean => {
    const distance = calculateDistance(location, center);
    return distance <= radius;
  };

  const calculateDistance = (pos1: any, pos2: any): number => {
    const R = 6371000; // Earth's radius in meters
    const lat1 = pos1.latitude * Math.PI / 180;
    const lat2 = pos2.lat * Math.PI / 180;
    const deltaLat = (pos2.lat - pos1.latitude) * Math.PI / 180;
    const deltaLon = (pos2.lng - pos1.longitude) * Math.PI / 180;
    
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  };

  return (
    <div className="fixed bottom-4 right-4 bg-green-500 text-white px-3 py-2 rounded-lg shadow-lg z-50">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        <span className="text-sm font-medium">Live Tracking Active</span>
      </div>
      {geofenceCenter && (
        <div className="text-xs mt-1">
          Geofence: {geofenceRadius}m | Target: {targetProximity}m
        </div>
      )}
    </div>
  );
};

export default LiveLocationTracker;