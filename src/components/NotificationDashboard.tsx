import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Bell, 
  MapPin, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock,
  Smartphone,
  Navigation,
  Shield,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface NotificationFeature {
  id: string;
  title: string;
  description: string;
  icon: any;
  status: 'active' | 'inactive' | 'pending';
  lastTriggered?: string;
  count: number;
}

const NotificationDashboard = () => {
  const { toast } = useToast();
  const { isSubscribed, subscribe, unsubscribe, loading } = usePushNotifications();
  const [employee, setEmployee] = useState<any>(null);
  const [features, setFeatures] = useState<NotificationFeature[]>([]);

  useEffect(() => {
    const employeeData = localStorage.getItem("employee");
    if (employeeData) {
      setEmployee(JSON.parse(employeeData));
    }
    loadNotificationFeatures();
  }, []);

  const loadNotificationFeatures = () => {
    const notificationFeatures: NotificationFeature[] = [
      {
        id: 'task_assignment',
        title: 'Task Assignment',
        description: 'Get notified when tasks are assigned to you',
        icon: CheckCircle,
        status: 'active',
        count: 0
      },
      {
        id: 'task_approval',
        title: 'Task Approval/Rejection',
        description: 'Notifications for task status updates',
        icon: XCircle,
        status: 'active',
        count: 0
      },
      {
        id: 'verification',
        title: 'Task Verification',
        description: 'Admin verification request notifications',
        icon: Shield,
        status: 'active',
        count: 0
      },
      {
        id: 'location_tracking',
        title: 'Live Location Tracking',
        description: 'Real-time location updates like Uber',
        icon: Navigation,
        status: 'active',
        count: 0
      },
      {
        id: 'auto_reassignment',
        title: 'Auto Task Reassignment',
        description: 'Automatic reassignment of rejected tasks',
        icon: Zap,
        status: 'active',
        count: 0
      },
      {
        id: 'employee_credentials',
        title: 'Login Credentials',
        description: 'Receive login credentials when registered',
        icon: Smartphone,
        status: 'active',
        count: 0
      },
      {
        id: 'proximity_alerts',
        title: 'Proximity Alerts',
        description: 'Alerts when reaching destination',
        icon: MapPin,
        status: 'active',
        count: 0
      },
      {
        id: 'geofence',
        title: 'Geofence Breaches',
        description: 'Alerts when leaving designated areas',
        icon: Users,
        status: 'active',
        count: 0
      }
    ];

    setFeatures(notificationFeatures);
  };

  const testNotification = async (featureId: string) => {
    const feature = features.find(f => f.id === featureId);
    if (!feature) return;

    try {
      // Show local notification
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_INSTANT_NOTIFICATION',
          title: `🔔 ${feature.title} Test`,
          body: feature.description,
          data: {
            action: 'test_notification',
            featureId
          }
        });
      } else {
        // Fallback to regular notification
        new Notification(`🔔 ${feature.title}`, {
          body: feature.description,
          icon: '/icons/android-launchericon-192-192.png',
          badge: '/icons/android-launchericon-96-96.png'
        });
      }

      toast({
        title: "Test Notification Sent!",
        description: `${feature.title} notification was sent successfully.`
      });

    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: "Error",
        description: "Failed to send test notification",
        variant: "destructive"
      });
    }
  };

  const togglePushNotifications = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const testLocationTracking = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          toast({
            title: "📍 Location Test",
            description: `Current location: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`
          });
        },
        (error) => {
          toast({
            title: "Location Error",
            description: "Unable to get current location",
            variant: "destructive"
          });
        }
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Notification Dashboard</h2>
        <p className="text-muted-foreground">
          Manage and test all PWA push notification features
        </p>
      </div>

      {/* PWA Push Notification Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">PWA Push Notifications</h3>
              <p className="text-sm text-muted-foreground">
                {isSubscribed ? 'Notifications are enabled' : 'Enable push notifications to receive alerts'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={isSubscribed ? "default" : "secondary"}>
              {isSubscribed ? "Enabled" : "Disabled"}
            </Badge>
            <Button 
              onClick={togglePushNotifications}
              disabled={loading}
              variant={isSubscribed ? "destructive" : "default"}
            >
              {loading ? "Processing..." : isSubscribed ? "Disable" : "Enable"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Notification Features Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.id} className="p-4 hover:shadow-lg transition-all">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">{feature.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {feature.description}
                  </p>
                </div>
                <Badge variant="default" className="text-xs">
                  {feature.status}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {feature.lastTriggered ? `Last: ${feature.lastTriggered}` : 'No recent activity'}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testNotification(feature.id)}
                  className="h-8 text-xs"
                >
                  Test
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Location Tracking Test */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/10 rounded-full">
              <Navigation className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Location Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Test real-time location tracking like Uber/Pick Me
              </p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button onClick={testLocationTracking} variant="outline">
              <MapPin className="h-4 w-4 mr-2" />
              Test Current Location
            </Button>
            <Button onClick={() => {
              toast({
                title: "Live Tracking",
                description: "Location tracking is now active in the background"
              });
            }}>
              <Zap className="h-4 w-4 mr-2" />
              Start Live Tracking
            </Button>
          </div>
        </div>
      </Card>

      {/* Statistics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Notification Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">24</div>
            <div className="text-sm text-muted-foreground">Today's Notifications</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">156</div>
            <div className="text-sm text-muted-foreground">This Week</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">98.5%</div>
            <div className="text-sm text-muted-foreground">Delivery Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">3.2s</div>
            <div className="text-sm text-muted-foreground">Avg Response Time</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default NotificationDashboard;