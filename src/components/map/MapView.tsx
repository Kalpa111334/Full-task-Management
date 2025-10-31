import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Battery, Clock, Route, Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import EmployeeTracker from "./EmployeeTracker";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { connectVehicleStream, VehicleLocationUpdate, isVehicleMockProvider } from "@/integrations/vehicle/liveVehicle";

interface EmployeeLocation {
  id: string;
  name: string;
  location_lat: number | null;
  location_lng: number | null;
  battery_level: number | null;
  last_location_update: string | null;
}

interface LocationHistoryPoint {
  location_lat: number;
  location_lng: number;
  timestamp: string;
}

interface Task {
  id: string;
  title: string;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  assigned_to: string | null;
  status: string;
  task_type: string | null;
}

interface MapViewProps {
  departmentId: string;
}

const MapView = ({ departmentId }: MapViewProps) => {
  const [employees, setEmployees] = useState<EmployeeLocation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTrails, setShowTrails] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [employeeHistory, setEmployeeHistory] = useState<Map<string, LocationHistoryPoint[]>>(new Map());
  const [navigationDistance, setNavigationDistance] = useState<string | null>(null);
  const [destinationLabels, setDestinationLabels] = useState<Map<string, string>>(new Map());
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const employeeMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const taskMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const currentUserIdRef = useRef<string | null>(null);
  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const vehicleTrailRef = useRef<VehicleLocationUpdate[]>([]);
  const vehicleUnsubscribeRef = useRef<(() => void) | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [isVehicleLive, setIsVehicleLive] = useState(false);

  useEffect(() => {
    const employeeData = localStorage.getItem("employee");
    if (employeeData) {
      try {
        const parsed = JSON.parse(employeeData);
        currentUserIdRef.current = parsed?.id ?? null;
      } catch (_) {
        currentUserIdRef.current = null;
      }
    }
  }, []);

  // Initialize 3D map with OpenFreeMap - Mobile Optimized
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    console.log("Initializing map...");

    // Detect mobile device
    const isMobile = window.innerWidth < 768;
    
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [79.8612, 6.9271], // Default center (Sri Lanka)
      zoom: isMobile ? 11 : 13, // Lower zoom on mobile for better overview
      pitch: isMobile ? 45 : 60, // Less pitch on mobile for better usability
      bearing: 0,
      // Mobile-optimized settings
      dragPan: true,
      dragRotate: !isMobile, // Disable drag rotate on mobile
      scrollZoom: true,
      boxZoom: !isMobile, // Disable box zoom on mobile
      doubleClickZoom: true,
      keyboard: !isMobile, // Disable keyboard on mobile
      touchZoomRotate: true,
      touchPitch: !isMobile // Disable touch pitch on mobile
    });

    // Wait for map to load before adding controls, 3D buildings, and enhanced layers
    map.current.on('load', () => {
      console.log("Map loaded successfully");
      
      if (!map.current) return;

      // Add 3D Buildings Layer with extrusion
      const layers = map.current.getStyle().layers;
      let labelLayerId: string | undefined;
      for (const layer of layers) {
        if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
          labelLayerId = layer.id;
          break;
        }
      }

      // Add 3D building layer
      if (!map.current.getLayer('3d-buildings')) {
        map.current.addLayer(
          {
            id: '3d-buildings',
            source: 'openmaptiles',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                ['get', 'render_height'], 
                0, '#d6d6d6',
                50, '#b8b8b8',
                100, '#9a9a9a'
              ],
              'fill-extrusion-height': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14, 0,
                14.5, ['get', 'render_height']
              ],
              'fill-extrusion-base': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14, 0,
                14.5, ['get', 'render_min_height']
              ],
              'fill-extrusion-opacity': 0.8,
              'fill-extrusion-vertical-gradient': true
            }
          },
          labelLayerId
        );
      }

      // Enhanced road styling with different colors
      const roadLayers = [
        'transportation_name_motorway',
        'transportation_name_trunk', 
        'transportation_name_primary',
        'transportation_name_secondary',
        'transportation_name_minor'
      ];

      roadLayers.forEach(layerId => {
        if (map.current!.getLayer(layerId)) {
          map.current!.setPaintProperty(layerId, 'text-color', '#1f2937');
          map.current!.setPaintProperty(layerId, 'text-halo-color', '#ffffff');
          map.current!.setPaintProperty(layerId, 'text-halo-width', 2);
        }
      });

      // Enhance water bodies
      if (map.current.getLayer('water')) {
        map.current.setPaintProperty('water', 'fill-color', '#0ea5e9');
      }

      // Enhance parks and green spaces
      const parkLayers = ['park', 'landuse_park', 'landcover_grass'];
      parkLayers.forEach(layerId => {
        if (map.current!.getLayer(layerId)) {
          map.current!.setPaintProperty(layerId, 'fill-color', '#86efac');
          map.current!.setPaintProperty(layerId, 'fill-opacity', 0.3);
        }
      });

      console.log("Enhanced map layers loaded: 3D buildings, styled roads, water, and parks");
    });

    // Add controls with mobile-friendly positioning
    map.current.addControl(new maplibregl.NavigationControl({ 
      visualizePitch: !isMobile,
      showCompass: !isMobile,
      showZoom: true
    }), "top-right");
    
    if (!isMobile) {
      map.current.addControl(new maplibregl.FullscreenControl(), "top-right");
    }

    // Handle window resize for responsive behavior
    const handleResize = () => {
      if (map.current) {
        map.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.current?.remove();
    };
  }, []);

  const fitMapToEmployees = () => {
    if (!map.current) return;
    const present = employees.filter(e => e.location_lat && e.location_lng);
    if (present.length === 0) return;

    const isMobile = window.innerWidth < 768;

    if (present.length === 1) {
      const e = present[0];
      map.current.flyTo({ 
        center: [e.location_lng as number, e.location_lat as number], 
        zoom: isMobile ? 14 : 16, 
        essential: true 
      });
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    present.forEach(emp => bounds.extend([emp.location_lng as number, emp.location_lat as number]));
    
    // Mobile-optimized padding and zoom
    const padding = isMobile ? 40 : 80;
    const maxZoom = isMobile ? 14 : 16;
    const minZoom = isMobile ? 10 : 12;
    
    map.current.fitBounds(bounds, { padding, maxZoom });

    const handleMoveEnd = () => {
      if (!map.current) return;
      if (map.current.getZoom() < minZoom) {
        map.current.setZoom(minZoom);
      }
      map.current.off('moveend', handleMoveEnd);
    };
    map.current.on('moveend', handleMoveEnd);
  };

  // Fetch location history for the selected employee only
  useEffect(() => {
    const fetchSelectedHistory = async () => {
      if (!selectedEmployee) {
        setEmployeeHistory(new Map());
        return;
      }

      const { data, error } = await supabase
        .from("employee_location_history")
        .select("employee_id, location_lat, location_lng, timestamp")
        .eq("employee_id", selectedEmployee)
        .order("timestamp", { ascending: false })
        .limit(500);

      if (!error && data) {
        const historyMap = new Map<string, LocationHistoryPoint[]>();
        historyMap.set(selectedEmployee, []);
        data.forEach(point => {
          historyMap.get(selectedEmployee)?.push({
            location_lat: point.location_lat,
            location_lng: point.location_lng,
            timestamp: point.timestamp,
          });
        });
        historyMap.forEach((points) => {
          points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        });
        setEmployeeHistory(historyMap);
      }
    };

    fetchSelectedHistory();

    const channel = supabase
      .channel("location-history-selected")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "employee_location_history" }, (payload) => {
        if (payload.new && payload.new.employee_id === selectedEmployee) {
          fetchSelectedHistory();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId, selectedEmployee]);

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel("map-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId]);

  const fetchTasks = async () => {
    let query = supabase
      .from("tasks")
      .select("*");
    
    if (departmentId) {
      query = query.eq("department_id", departmentId);
    } else {
      query = query.is("department_id", null);
    }
    
    const { data, error } = await query
      .eq("task_type", "location_based")
      .in("status", ["pending", "in_progress"]);

    if (!error && data) {
      setTasks(data);
      // Fetch destination labels for tasks without addresses
      fetchDestinationLabels(data);
    }
  };

  // Reverse geocode to get location name
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'EmployeeTrackingApp'
          }
        }
      );
      const data = await response.json();
      
      // Build a concise address
      const address = data.address;
      if (address) {
        const parts = [
          address.road || address.suburb || address.neighbourhood,
          address.city || address.town || address.village
        ].filter(Boolean);
        return parts.join(', ') || data.display_name?.split(',')[0] || 'Unknown Location';
      }
      return data.display_name?.split(',')[0] || 'Unknown Location';
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return 'Location';
    }
  };

  // Fetch destination labels for employee tasks
  const fetchDestinationLabels = async (tasksList: Task[]) => {
    const labels = new Map<string, string>();
    
    for (const task of tasksList) {
      if (task.assigned_to && task.location_lat && task.location_lng) {
        if (task.location_address) {
          // Use existing address
          labels.set(task.assigned_to, task.location_address);
        } else {
          // Fetch via reverse geocoding
          const locationName = await reverseGeocode(task.location_lat, task.location_lng);
          labels.set(task.assigned_to, locationName);
        }
      }
    }
    
    setDestinationLabels(labels);
  };

  const fetchLocationHistory = async () => {
    if (employees.length === 0) return;

    const employeeIds = employees.map(emp => emp.id);
    
    // Fetch last 50 points per employee (last ~8 minutes of history)
    const { data, error } = await supabase
      .from("employee_location_history")
      .select("employee_id, location_lat, location_lng, timestamp")
      .in("employee_id", employeeIds)
      .order("timestamp", { ascending: false })
      .limit(50 * employeeIds.length);

    if (!error && data) {
      const historyMap = new Map<string, LocationHistoryPoint[]>();
      
      // Group by employee
      data.forEach(point => {
        if (!historyMap.has(point.employee_id)) {
          historyMap.set(point.employee_id, []);
        }
        historyMap.get(point.employee_id)?.push({
          location_lat: point.location_lat,
          location_lng: point.location_lng,
          timestamp: point.timestamp,
        });
      });

      // Sort each employee's history by timestamp (oldest first for line drawing)
      historyMap.forEach((points) => {
        points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      });

      setEmployeeHistory(historyMap);
    }
  };

  const handleLocationUpdate = (updatedEmployees: EmployeeLocation[]) => {
    setEmployees(updatedEmployees);
  };

  // Update employee markers on map
  useEffect(() => {
    if (!map.current) {
      console.log("Map not ready yet");
      return;
    }

    // Wait for map to be loaded before adding markers
    if (!map.current.isStyleLoaded()) {
      console.log("Map style not loaded yet, waiting...");
      const handleStyleLoad = () => {
        console.log("Map style loaded, now adding markers");
        addMarkersToMap();
        map.current?.off('styledata', handleStyleLoad);
      };
      map.current.on('styledata', handleStyleLoad);
      return;
    }

    addMarkersToMap();
  }, [employees, selectedEmployee, destinationLabels]);

  const addMarkersToMap = () => {
    if (!map.current) {
      console.log("Map not available for adding markers");
      return;
    }

    console.log("=== ADDING MARKERS TO MAP ===");
    console.log("Employees to add markers for:", employees);
    console.log("Current user ID:", currentUserIdRef.current);

    // Clear old markers
    console.log("Clearing existing markers...");
    employeeMarkersRef.current.forEach(marker => marker.remove());
    employeeMarkersRef.current.clear();

    let markersCreated = 0;

    // Add employee markers with destination labels
    employees.forEach((emp, index) => {
      console.log(`\nProcessing employee ${index + 1}:`, {
        name: emp.name,
        id: emp.id,
        location_lat: emp.location_lat,
        location_lng: emp.location_lng,
        hasLocation: !!(emp.location_lat && emp.location_lng)
      });

      if (emp.location_lat && emp.location_lng) {
        console.log(`✅ Creating marker for ${emp.name} at [${emp.location_lng}, ${emp.location_lat}]`);
        
        const isCurrentUser = currentUserIdRef.current === emp.id;
        const backgroundColor = isCurrentUser ? '#10b981' : '#3b82f6';
        const size = isCurrentUser ? 36 : 32;
        const destinationLabel = destinationLabels.get(emp.id);
        
        // Create container for marker with label
        const container = document.createElement("div");
        container.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        `;
        
        // Add destination label above marker if exists
        if (destinationLabel) {
          const label = document.createElement("div");
          label.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            color: #1f2937;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            white-space: nowrap;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            border: 2px solid ${backgroundColor};
          `;
          label.textContent = `📍 ${destinationLabel}`;
          label.title = destinationLabel; // Full text on hover
          container.appendChild(label);
        }
        
        // Create avatar marker
        const el = document.createElement("div");
        el.className = "employee-marker";
        el.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          background: ${backgroundColor};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
        `;
        
        // Use first letter of name
        const displayText = emp.name.charAt(0).toUpperCase();
        el.textContent = displayText;
        container.appendChild(el);
        
        console.log(`Marker element created with text: "${displayText}", color: ${backgroundColor}, size: ${size}px, destination: ${destinationLabel || 'none'}`);

        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
          `<div style="padding: 8px;">
            <strong>${emp.name}${isCurrentUser ? ' (You)' : ''}</strong><br/>
            ${destinationLabel ? `<div style="margin-top: 4px; color: #059669;">📍 Going to: ${destinationLabel}</div>` : ''}
            Battery: ${emp.battery_level || 'N/A'}%<br/>
            ${emp.last_location_update ? `Updated: ${formatDistanceToNow(new Date(emp.last_location_update), { addSuffix: true })}` : ''}
          </div>`
        );

        try {
          const marker = new maplibregl.Marker({ 
            element: container,
            anchor: 'bottom'
          })
            .setLngLat([emp.location_lng, emp.location_lat])
            .setPopup(popup)
            .addTo(map.current!);

          employeeMarkersRef.current.set(emp.id, marker);
          markersCreated++;
          console.log(`✅ Marker successfully created and added for ${emp.name}`);
        } catch (error) {
          console.error(`❌ Failed to create marker for ${emp.name}:`, error);
        }
      } else {
        console.log(`❌ Skipping ${emp.name} - missing location data (lat: ${emp.location_lat}, lng: ${emp.location_lng})`);
      }
    });

    console.log(`\n=== MARKER CREATION SUMMARY ===`);
    console.log(`Total employees processed: ${employees.length}`);
    console.log(`Markers successfully created: ${markersCreated}`);
    console.log(`Markers in ref map: ${employeeMarkersRef.current.size}`);

    // Fit bounds to show all employees when none is selected
    if (!selectedEmployee && employees.length > 0 && markersCreated > 0) {
      console.log("Fitting map to show all employee markers...");
      setTimeout(() => {
        fitMapToEmployees();
      }, 200);
    } else if (markersCreated === 0) {
      console.log("No markers created, skipping map fit");
    }
  };

  // Focus on selected employee; refit when deselected - Mobile Optimized
  useEffect(() => {
    if (!map.current) return;
    if (selectedEmployee) {
      const emp = employees.find(e => e.id === selectedEmployee);
      if (emp && emp.location_lat && emp.location_lng) {
        const isMobile = window.innerWidth < 768;
        map.current.flyTo({ 
          center: [emp.location_lng, emp.location_lat], 
          zoom: isMobile ? 14 : 16, 
          essential: true 
        });
      }
    } else {
      fitMapToEmployees();
    }
    updateNavigationOverlay();
  }, [selectedEmployee]);

  // Update navigation overlay and distance in real-time as locations change
  useEffect(() => {
    updateNavigationOverlay();
  }, [employees]);

  const handleNavigate = (emp: EmployeeLocation) => {
    if (!(emp.location_lat && emp.location_lng)) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${emp.location_lat},${emp.location_lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  // Draw navigation trail only for the selected employee
  useEffect(() => {
    if (!map.current || !showTrails) {
      // Remove trail layers if trails are hidden
      if (map.current) {
        employees.forEach(emp => {
          const sourceId = `trail-${emp.id}`;
          if (map.current!.getLayer(sourceId)) {
            map.current!.removeLayer(sourceId);
          }
          if (map.current!.getSource(sourceId)) {
            map.current!.removeSource(sourceId);
          }
        });
      }
      return;
    }
    // Remove all existing trails first
    employees.forEach(emp => {
      const sourceId = `trail-${emp.id}`;
      if (map.current!.getLayer(sourceId)) {
        map.current!.removeLayer(sourceId);
      }
      if (map.current!.getSource(sourceId)) {
        map.current!.removeSource(sourceId);
      }
    });

    if (!selectedEmployee) return;

    const history = employeeHistory.get(selectedEmployee);
    const sourceId = `trail-${selectedEmployee}`;

    if (history && history.length > 1) {
      const coordinates = history.map(point => [point.location_lng, point.location_lat]);

      map.current!.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates
          }
        }
      });

      map.current!.addLayer({
        id: sourceId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#1d4ed8',
          'line-width': 4,
          'line-opacity': 0.95
        }
      });
    }
  }, [employees, employeeHistory, showTrails, selectedEmployee]);

  // Follow selected employee while moving; stop if inactive > 2 minutes - Mobile Optimized
  useEffect(() => {
    if (!map.current || !selectedEmployee) return;
    const emp = employees.find(e => e.id === selectedEmployee);
    if (!emp || !emp.location_lat || !emp.location_lng) return;

    const lastUpdate = emp.last_location_update ? new Date(emp.last_location_update).getTime() : 0;
    const now = Date.now();
    const isActive = lastUpdate && (now - lastUpdate) < 2 * 60 * 1000; // 2 minutes

    if (isActive) {
      const isMobile = window.innerWidth < 768;
      const minZoom = isMobile ? 13 : 15;
      map.current.easeTo({ 
        center: [emp.location_lng, emp.location_lat], 
        zoom: Math.max(minZoom, map.current.getZoom()), 
        duration: 800, 
        essential: true 
      });
    }
  }, [employees, selectedEmployee]);

  // Update task markers on map
  useEffect(() => {
    if (!map.current) return;

    // Clear old task markers
    taskMarkersRef.current.forEach(marker => marker.remove());
    taskMarkersRef.current.clear();

    // Add task markers
    tasks.forEach(task => {
      if (task.location_lat && task.location_lng) {
        const el = document.createElement("div");
        el.className = "task-marker";
        el.style.cssText = `
          width: 28px;
          height: 28px;
          background: #ef4444;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
        `;

        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
          `<div style="padding: 8px;">
            <strong>${task.title}</strong><br/>
            ${task.location_address || ''}<br/>
            Status: ${task.status}
          </div>`
        );

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([task.location_lng, task.location_lat])
          .setPopup(popup)
          .addTo(map.current!);

        taskMarkersRef.current.set(task.id, marker);
      }
    });
  }, [tasks]);

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(2);
  };

  const formatDistance = (kmString: string) => {
    const km = parseFloat(kmString);
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(2)} km`;
  };

  const getCurrentUserEmployee = () => {
    if (!currentUserIdRef.current) return null;
    return employees.find(e => e.id === currentUserIdRef.current) || null;
  };

  const updateNavigationOverlay = () => {
    if (!map.current) return;
    const me = getCurrentUserEmployee();
    const target = employees.find(e => e.id === selectedEmployee);

    const sourceId = 'nav-line';
    if (map.current.getLayer(sourceId)) {
      map.current.removeLayer(sourceId);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }

    if (me && me.location_lat && me.location_lng && target && target.location_lat && target.location_lng) {
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [me.location_lng, me.location_lat],
              [target.location_lng, target.location_lat]
            ]
          }
        }
      });
      map.current.addLayer({
        id: sourceId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#2563eb',
          'line-width': 3,
          'line-opacity': 0.9
        }
      });

      const km = calculateDistance(me.location_lat, me.location_lng, target.location_lat, target.location_lng);
      setNavigationDistance(formatDistance(km));
    } else {
      setNavigationDistance(null);
    }
  };

  return (
    <div>
      <EmployeeTracker departmentId={departmentId} onLocationUpdate={handleLocationUpdate} />
      
      {/* Header - Mobile Optimized */}
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Live Location Tracking</h2>
        
        {/* Mobile Controls - Stack vertically on mobile */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
          {/* Map Controls */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={showTrails ? "default" : "outline"}
              size="sm"
              onClick={() => setShowTrails(!showTrails)}
              className="flex items-center gap-2 text-xs sm:text-sm"
            >
              <Route className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">{showTrails ? "Hide Trails" : "Show Trails"}</span>
              <span className="xs:hidden">{showTrails ? "Hide" : "Show"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEmployee(null)}
              className="text-xs sm:text-sm"
            >
              Reset
            </Button>
          </div>

          {/* Vehicle Tracking - Mobile Optimized */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex items-center gap-2 border rounded-lg px-2 py-1.5 bg-white min-w-0 flex-1 sm:flex-none">
              <Car className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <input
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="Vehicle No"
                className="outline-none text-xs sm:text-sm flex-1 min-w-0"
              />
            </div>
            {!isVehicleLive ? (
              <Button 
                size="sm" 
                onClick={() => {
                  if (!vehicleNumber.trim()) return;
                  // Clear previous
                  if (vehicleUnsubscribeRef.current) { vehicleUnsubscribeRef.current(); vehicleUnsubscribeRef.current = null; }
                  vehicleTrailRef.current = [];
                  // Remove previous marker and trail
                  if (vehicleMarkerRef.current) { vehicleMarkerRef.current.remove(); vehicleMarkerRef.current = null; }
                  if (map.current?.getLayer('vehicle-trail')) map.current.removeLayer('vehicle-trail');
                  if (map.current?.getSource('vehicle-trail')) map.current.removeSource('vehicle-trail');

                  setIsVehicleLive(true);
                  vehicleUnsubscribeRef.current = connectVehicleStream(vehicleNumber, (u) => {
                    vehicleTrailRef.current.push(u);
                    // Create/update marker
                    if (map.current) {
                      if (!vehicleMarkerRef.current) {
                        const el = document.createElement('div');
                        el.style.cssText = 'width: 28px; height: 28px; background:#111827; border:3px solid #fff; border-radius:50%; box-shadow:0 2px 8px rgba(0,0,0,.3);';
                        vehicleMarkerRef.current = new maplibregl.Marker({ element: el })
                          .setLngLat([u.lng, u.lat])
                          .addTo(map.current);
                      } else {
                        vehicleMarkerRef.current.setLngLat([u.lng, u.lat]);
                      }

                      // Update high-accuracy trail
                      const coords = vehicleTrailRef.current.map(p => [p.lng, p.lat]);
                      if (map.current.getSource('vehicle-trail')) {
                        const src = map.current.getSource('vehicle-trail') as maplibregl.GeoJSONSource;
                        src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
                      } else {
                        map.current.addSource('vehicle-trail', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } });
                        map.current.addLayer({ id: 'vehicle-trail', type: 'line', source: 'vehicle-trail', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#111827', 'line-width': 4, 'line-opacity': 0.95 } });
                      }

                      // Follow vehicle (slightly higher zoom if mock provider) - Mobile Optimized
                      const isMobile = window.innerWidth < 768;
                      const baseZoom = isVehicleMockProvider() ? (isMobile ? 14 : 16) : Math.max(isMobile ? 13 : 15, map.current.getZoom());
                      map.current.easeTo({ center: [u.lng, u.lat], zoom: baseZoom, duration: 600, essential: true });
                    }
                  });
                }}
                className="text-xs sm:text-sm"
              >
                Track
              </Button>
            ) : (
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={() => {
                  setIsVehicleLive(false);
                  if (vehicleUnsubscribeRef.current) { vehicleUnsubscribeRef.current(); vehicleUnsubscribeRef.current = null; }
                  if (vehicleMarkerRef.current) { vehicleMarkerRef.current.remove(); vehicleMarkerRef.current = null; }
                  if (map.current?.getLayer('vehicle-trail')) map.current.removeLayer('vehicle-trail');
                  if (map.current?.getSource('vehicle-trail')) map.current.removeSource('vehicle-trail');
                }}
                className="text-xs sm:text-sm"
              >
                Stop
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Mobile First Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 3D Map with OpenFreeMap - Full width on mobile */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <Card className="p-2 sm:p-4">
            <div
              ref={mapContainer}
              className="w-full rounded-lg overflow-hidden"
              style={{ height: '50vh', minHeight: 280 }}
            />
          </Card>
        </div>

        {/* Employee List - Full width on mobile, sidebar on desktop */}
        <div className="space-y-4 order-1 lg:order-2">
          <Card className="p-3 sm:p-4">
            <h3 className="font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
              <Navigation className="h-4 w-4 sm:h-5 sm:w-5" />
              Active Employees ({employees.length})
            </h3>
            <div className="space-y-2 sm:space-y-3 overflow-y-auto" style={{ maxHeight: '40vh' }}>
              {employees.map(emp => {
                const assignedTask = tasks.find(t => t.assigned_to === emp.id);
                let distanceToTask = null;

                if (assignedTask?.location_lat && assignedTask?.location_lng && emp.location_lat && emp.location_lng) {
                  distanceToTask = calculateDistance(
                    emp.location_lat,
                    emp.location_lng,
                    assignedTask.location_lat,
                    assignedTask.location_lng
                  );
                }

                const isSelected = selectedEmployee === emp.id;
                const me = getCurrentUserEmployee();
                const distanceToMe = me && me.location_lat && me.location_lng && emp.location_lat && emp.location_lng
                  ? formatDistance(calculateDistance(me.location_lat, me.location_lng, emp.location_lat, emp.location_lng))
                  : null;

                return (
                  <div 
                    key={emp.id} 
                    className={`p-2 sm:p-3 border rounded-lg space-y-1 sm:space-y-2 cursor-pointer transition-colors touch-manipulation ${
                      isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedEmployee(selectedEmployee === emp.id ? null : emp.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                        <span className="font-medium text-sm sm:text-base truncate">{emp.name}</span>
                        {employeeHistory.get(emp.id)?.length ? (
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            <Route className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                            {employeeHistory.get(emp.id)?.length} pts
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        {distanceToMe && (
                          <Badge className="bg-blue-600 text-white text-xs" title="Distance from you">
                            {distanceToMe}
                          </Badge>
                        )}
                        <Badge variant="outline" className="flex items-center gap-1 text-xs">
                          <Battery className="h-2 w-2 sm:h-3 sm:w-3" />
                          {emp.battery_level || 'N/A'}%
                        </Badge>
                      </div>
                    </div>
                    
                    {emp.last_location_update && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-2 w-2 sm:h-3 sm:w-3" />
                        {formatDistanceToNow(new Date(emp.last_location_update), { addSuffix: true })}
                      </div>
                    )}

                    {/* Hide coordinates on mobile to save space */}
                    <div className="hidden sm:block text-xs text-muted-foreground">
                      {emp.location_lat && emp.location_lng && (
                        <>
                          <div>Lat: {emp.location_lat.toFixed(6)}</div>
                          <div>Lng: {emp.location_lng.toFixed(6)}</div>
                        </>
                      )}
                    </div>

                    {distanceToTask && (
                      <div className="flex items-center gap-1 text-xs">
                        <MapPin className="h-2 w-2 sm:h-3 sm:w-3 text-destructive" />
                        <span>Distance to task: {distanceToTask} km</span>
                      </div>
                    )}

                    {isSelected && navigationDistance && (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-1 sm:pt-2 gap-2">
                        <div className="text-xs sm:text-sm font-medium text-blue-700">
                          You → {emp.name}: {navigationDistance}
                        </div>
                        <Button 
                          size="sm" 
                          className="bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm w-full sm:w-auto" 
                          onClick={(e) => { e.stopPropagation(); handleNavigate(emp); }}
                        >
                          Navigate
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {employees.length === 0 && (
                <p className="text-xs sm:text-sm text-muted-foreground text-center py-6 sm:py-8">
                  No active employees with location data
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MapView;
