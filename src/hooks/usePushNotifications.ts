import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// VAPID public key - this should match your edge function's private key
const VAPID_PUBLIC_KEY = 'BATeM8ErELbJtiZabm68KIZ-dUjAXhu5XrnFMVOmJy0raKF_3Vvr6sDZu226H3k27gc41ZG8YcEG2u6-6yuymKY';

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = async () => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Push notifications are not supported in this browser.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Check current permission status
      console.log('Current notification permission:', Notification.permission);
      
      // Request notification permission
      const permission = await Notification.requestPermission();
      console.log('Permission result:', permission);
      
      if (permission !== 'granted') {
        setLoading(false);
        toast({
          title: "Permission Denied",
          description: "Please allow notifications when prompted, or check your browser settings.",
          variant: "destructive"
        });
        return;
      }

      // Wait for service worker to be ready
      console.log('Waiting for service worker...');
      const registration = await navigator.serviceWorker.ready;
      console.log('Service worker ready:', registration);

      // Check for existing subscription first
      let subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        console.log('Existing subscription found:', subscription);
      } else {
        // Subscribe to push notifications
        console.log('Creating new subscription...');
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        console.log('New subscription created:', subscription);
      }

      // Save subscription to database - get employee from localStorage
      const employeeData = localStorage.getItem("employee");
      if (!employeeData) {
        throw new Error('Employee not found. Please log in again.');
      }

      const employee = JSON.parse(employeeData);
      if (!employee?.id) {
        throw new Error('Employee ID not found');
      }

      console.log('Saving subscription for employee:', employee.id);
      const subscriptionData = subscription.toJSON();
      
      // Use upsert to handle duplicates
      const { error } = await supabase.from('push_subscriptions').upsert({
        employee_id: employee.id,
        endpoint: subscriptionData.endpoint!,
        p256dh: subscriptionData.keys!.p256dh,
        auth: subscriptionData.keys!.auth
      }, {
        onConflict: 'employee_id,endpoint'
      });

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('✅ Subscription saved successfully');
      setIsSubscribed(true);
      
      // Send a test notification
      console.log('Sending test notification...');
      registration.showNotification('🎉 Notifications Enabled!', {
        body: 'You will now receive push notifications for tasks and updates.',
        icon: '/icons/android-launchericon-192-192.png',
        badge: '/icons/android-launchericon-96-96.png',
        tag: 'test-notification',
        requireInteraction: false
      });
      
      toast({
        title: "Success! ✅",
        description: "Push notifications enabled successfully!"
      });
    } catch (error) {
      console.error('❌ Error subscribing to push notifications:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to enable push notifications.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Remove from database
        const subscriptionData = subscription.toJSON();
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscriptionData.endpoint!);
      }

      setIsSubscribed(false);
      toast({
        title: "Success",
        description: "Push notifications disabled."
      });
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      toast({
        title: "Error",
        description: "Failed to disable push notifications.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    isSupported,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe
  };
};
