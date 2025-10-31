import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";

export const PushNotificationToggle = () => {
  const { isSupported, isSubscribed, loading, subscribe, unsubscribe } = usePushNotifications();
  const { toast } = useToast();

  if (!isSupported) {
    return null;
  }

  const testNotification = async () => {
    if (!isSubscribed) {
      toast({
        title: "Not Enabled",
        description: "Please enable notifications first.",
        variant: "destructive"
      });
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('🧪 Test Notification', {
        body: 'This is a test notification. If you see this, notifications are working!',
        icon: '/icons/android-launchericon-192-192.png',
        badge: '/icons/android-launchericon-96-96.png',
        tag: 'manual-test',
        requireInteraction: false
      });
      
      toast({
        title: "Test Sent! ✅",
        description: "Check your notifications"
      });
    } catch (error) {
      console.error('Test notification error:', error);
      toast({
        title: "Test Failed",
        description: "Could not send test notification",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant={isSubscribed ? "default" : "outline"}
        size="sm"
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={loading}
        className="gap-2"
      >
        {isSubscribed ? (
          <>
            <Bell className="h-4 w-4" />
            Notifications On
          </>
        ) : (
          <>
            <BellOff className="h-4 w-4" />
            Enable Notifications
          </>
        )}
      </Button>
      
      {isSubscribed && (
        <Button
          variant="ghost"
          size="sm"
          onClick={testNotification}
          className="gap-2"
        >
          Test
        </Button>
      )}
    </div>
  );
};
