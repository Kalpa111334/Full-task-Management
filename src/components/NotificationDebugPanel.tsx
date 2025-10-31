import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellOff, Check, X, AlertCircle } from "lucide-react";

export const NotificationDebugPanel = () => {
  const [status, setStatus] = useState<string>("checking");
  const { toast } = useToast();

  const checkStatus = async () => {
    const checks = {
      serviceWorker: false,
      pushManager: false,
      permission: "",
      registration: false,
      subscription: false
    };

    // Check Service Worker
    if ('serviceWorker' in navigator) {
      checks.serviceWorker = true;
      
      // Check Push Manager
      if ('PushManager' in window) {
        checks.pushManager = true;
      }

      // Check Permission
      checks.permission = Notification.permission;

      // Check Registration
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          checks.registration = true;
          
          // Check Subscription
          const sub = await reg.pushManager.getSubscription();
          checks.subscription = !!sub;
        }
      } catch (error) {
        console.error('Error checking registration:', error);
      }
    }

    return checks;
  };

  const runDiagnostics = async () => {
    setStatus("running");
    const checks = await checkStatus();
    
    console.log("=== NOTIFICATION DIAGNOSTICS ===");
    console.log("Service Worker Support:", checks.serviceWorker);
    console.log("Push Manager Support:", checks.pushManager);
    console.log("Notification Permission:", checks.permission);
    console.log("Service Worker Registered:", checks.registration);
    console.log("Push Subscription Active:", checks.subscription);
    console.log("==============================");

    setStatus("complete");
    
    toast({
      title: "Diagnostics Complete",
      description: "Check browser console for details"
    });
  };

  const requestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      console.log('Permission result:', permission);
      
      if (permission === 'granted') {
        toast({
          title: "Permission Granted ✅",
          description: "You can now receive notifications"
        });
      } else if (permission === 'denied') {
        toast({
          title: "Permission Denied ❌",
          description: "Please enable notifications in browser settings",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Permission Default",
          description: "Please click allow when prompted",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Permission error:', error);
      toast({
        title: "Error",
        description: "Failed to request permission",
        variant: "destructive"
      });
    }
  };

  const sendTestNotification = async () => {
    try {
      const permission = Notification.permission;
      
      if (permission !== 'granted') {
        toast({
          title: "Permission Required",
          description: "Please enable notifications first",
          variant: "destructive"
        });
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('🎯 Test Notification', {
        body: 'This is a test notification from Task Vision!',
        icon: '/icons/android-launchericon-192-192.png',
        badge: '/icons/android-launchericon-96-96.png',
        tag: 'debug-test',
        requireInteraction: false
      });

      toast({
        title: "Test Sent! ✅",
        description: "Check your notifications"
      });
    } catch (error) {
      console.error('Test notification error:', error);
      toast({
        title: "Test Failed ❌",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const resetNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        console.log('Subscription removed');
      }

      toast({
        title: "Reset Complete",
        description: "Push subscription has been cleared. Please re-enable notifications."
      });
    } catch (error) {
      console.error('Reset error:', error);
      toast({
        title: "Reset Failed",
        description: "Could not reset notifications",
        variant: "destructive"
      });
    }
  };

  const checkBrowserSettings = () => {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    let instructions = "Open browser settings and enable notifications for this site.";
    
    if (isChrome || isEdge) {
      instructions = "Chrome/Edge: Click the lock icon in address bar → Site Settings → Notifications → Allow";
    } else if (isFirefox) {
      instructions = "Firefox: Click the shield icon → Permissions → Allow notifications";
    } else if (isSafari) {
      instructions = "Safari: Safari menu → Preferences → Websites → Notifications → Allow for this site";
    }

    toast({
      title: "Browser Settings",
      description: instructions,
      duration: 10000
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Debug Panel
        </CardTitle>
        <CardDescription>
          Test and troubleshoot push notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Info */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
          <div>
            <p className="text-sm font-medium">Service Worker</p>
            <Badge variant={('serviceWorker' in navigator) ? "default" : "destructive"}>
              {('serviceWorker' in navigator) ? "Supported" : "Not Supported"}
            </Badge>
          </div>
          <div>
            <p className="text-sm font-medium">Push Manager</p>
            <Badge variant={('PushManager' in window) ? "default" : "destructive"}>
              {('PushManager' in window) ? "Supported" : "Not Supported"}
            </Badge>
          </div>
          <div>
            <p className="text-sm font-medium">Permission</p>
            <Badge variant={
              Notification.permission === 'granted' ? "default" : 
              Notification.permission === 'denied' ? "destructive" : "secondary"
            }>
              {Notification.permission}
            </Badge>
          </div>
          <div>
            <p className="text-sm font-medium">HTTPS/Localhost</p>
            <Badge variant={
              window.location.protocol === 'https:' || 
              window.location.hostname === 'localhost' ? "default" : "destructive"
            }>
              {window.location.protocol === 'https:' || window.location.hostname === 'localhost' ? 
                "Secure" : "Insecure"}
            </Badge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button 
            onClick={runDiagnostics} 
            className="w-full"
            variant="outline"
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            Run Full Diagnostics
          </Button>

          <Button 
            onClick={requestPermission} 
            className="w-full"
            variant="outline"
          >
            <Check className="h-4 w-4 mr-2" />
            Request Permission
          </Button>

          <Button 
            onClick={sendTestNotification} 
            className="w-full"
            variant="default"
          >
            <Bell className="h-4 w-4 mr-2" />
            Send Test Notification
          </Button>

          {/* Server-side broadcast test */}
          <Button 
            onClick={async () => {
              try {
                const { supabase } = await import('@/integrations/supabase/client');
                const { data, error } = await supabase.functions.invoke('send-push-notification', {
                  body: {
                    title: '📣 Broadcast Test',
                    body: 'This is a broadcast to all PWA subscribers',
                    broadcast: true,
                    data: { url: '/' }
                  }
                });
                if (error) {
                  throw new Error(error.message || 'Invoke failed');
                }
                console.log('Broadcast push result:', data);
                toast({ title: 'Broadcast Sent ✅', description: 'All subscribers should receive it' });
              } catch (e) {
                console.error(e);
                toast({ title: 'Broadcast Failed ❌', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
              }
            }} 
            className="w-full"
            variant="outline"
          >
            <BellOff className="h-4 w-4 mr-2" />
            Send Broadcast Test Push
          </Button>

          <Button 
            onClick={checkBrowserSettings} 
            className="w-full"
            variant="outline"
          >
            How to Enable in Browser
          </Button>

          <Button 
            onClick={resetNotifications} 
            className="w-full"
            variant="destructive"
          >
            <X className="h-4 w-4 mr-2" />
            Reset Subscription
          </Button>
        </div>

        {/* Instructions */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-2">
          <h4 className="font-semibold text-sm">Troubleshooting Steps:</h4>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Run diagnostics to check system status</li>
            <li>Request permission if not granted</li>
            <li>Send test notification to verify it works</li>
            <li>Use Server Test Push to validate Edge Function</li>
            <li>Check browser console for error messages</li>
            <li>Try resetting subscription and re-enabling</li>
          </ol>
        </div>

        {/* Console Instructions */}
        <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
          <h4 className="font-semibold text-sm mb-2">Browser Console Commands:</h4>
          <code className="text-xs block space-y-1">
            <div>Notification.permission</div>
            <div>navigator.serviceWorker.ready</div>
            <div>navigator.serviceWorker.getRegistration()</div>
          </code>
        </div>
      </CardContent>
    </Card>
  );
};
