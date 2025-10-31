export interface VehicleLocationUpdate {
  lat: number;
  lng: number;
  timestamp: string;
}

export type VehicleUnsubscribe = () => void;
export function isVehicleMockProvider(): boolean {
  const endpoint = import.meta.env.VITE_VEHICLE_WS_URL as string | undefined;
  const openGtsUrl = import.meta.env.VITE_OPENGTS_URL as string | undefined;
  const openGtsUser = import.meta.env.VITE_OPENGTS_USER as string | undefined;
  const openGtsPass = import.meta.env.VITE_OPENGTS_PASS as string | undefined;
  return !endpoint && !(openGtsUrl && openGtsUser && openGtsPass);
}

// Connects to a realtime vehicle location stream without persisting to any database.
// It expects a WebSocket endpoint provided via VITE_VEHICLE_WS_URL that accepts
// a query like ?vehicle=ABC-1234 and emits JSON messages: { lat, lng, timestamp }
// If no endpoint is configured, a high-frequency mock is used (for local testing only).
export function connectVehicleStream(
  vehicleNumber: string,
  onUpdate: (update: VehicleLocationUpdate) => void
): VehicleUnsubscribe {
  const endpoint = import.meta.env.VITE_VEHICLE_WS_URL as string | undefined;
  const openGtsUrl = import.meta.env.VITE_OPENGTS_URL as string | undefined;
  const openGtsUser = import.meta.env.VITE_OPENGTS_USER as string | undefined;
  const openGtsPass = import.meta.env.VITE_OPENGTS_PASS as string | undefined;

  // Option 1: Custom provider accepting ?vehicle=
  if (endpoint) {
    const wsUrl = `${endpoint}${endpoint.includes('?') ? '&' : '?'}vehicle=${encodeURIComponent(vehicleNumber)}`;
    const socket = new WebSocket(wsUrl);

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.lat === 'number' && typeof data.lng === 'number') {
          const update: VehicleLocationUpdate = {
            lat: data.lat,
            lng: data.lng,
            timestamp: data.timestamp || new Date().toISOString(),
          };
          onUpdate(update);
        }
      } catch (_) {
        // ignore malformed frames
      }
    };

    socket.addEventListener('message', handleMessage);

    return () => {
      socket.removeEventListener('message', handleMessage);
      try { socket.close(); } catch (_) {}
    };
  }

  // Option 2: OpenGTS (Open GPS Tracking System)
  // Poll OpenGTS REST API for device positions
  if (openGtsUrl && openGtsUser && openGtsPass) {
    let intervalId: number | null = null;
    let isActive = true;

    const fetchPosition = async () => {
      if (!isActive) return;

      try {
        // OpenGTS REST API endpoint format
        const auth = btoa(`${openGtsUser}:${openGtsPass}`);
        const apiUrl = `${openGtsUrl}/track/Geozone?a=getDevices&device=${encodeURIComponent(vehicleNumber)}`;
        
        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('OpenGTS API error:', response.status);
          return;
        }

        const data = await response.json();
        
        // OpenGTS response format varies, adapt as needed
        if (data && data.EventData && Array.isArray(data.EventData)) {
          const latest = data.EventData[0];
          if (latest && typeof latest.latitude === 'number' && typeof latest.longitude === 'number') {
            const update: VehicleLocationUpdate = {
              lat: latest.latitude,
              lng: latest.longitude,
              timestamp: latest.timestamp ? new Date(latest.timestamp * 1000).toISOString() : new Date().toISOString(),
            };
            onUpdate(update);
          }
        }
      } catch (error) {
        console.error('Error fetching OpenGTS position:', error);
      }
    };

    // Initial fetch
    fetchPosition();
    
    // Poll every 5 seconds
    intervalId = window.setInterval(fetchPosition, 5000);

    return () => {
      isActive = false;
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }

  // Mock stream: single initial position (no continuous updates)
  // Seed somewhere in Sri Lanka (Colombo)
  const lat = 6.9271 + (Math.random() - 0.5) * 0.02;
  const lng = 79.8612 + (Math.random() - 0.5) * 0.02;

  // Send initial position immediately
  onUpdate({ lat, lng, timestamp: new Date().toISOString() });

  // Return cleanup function (no-op since no interval)
  return () => {
    // No cleanup needed
  };
}


