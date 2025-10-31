import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Use web-push-deno for reliable push notifications
import webpush from "npm:web-push@3.6.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// VAPID keys for web push (must match the client public key)
const VAPID_PUBLIC_KEY = 'BATeM8ErELbJtiZabm68KIZ-dUjAXhu5XrnFMVOmJy0raKF_3Vvr6sDZu226H3k27gc41ZG8YcEG2u6-6yuymKY';
const VAPID_PRIVATE_KEY = '91bmBXERomHDgpQXsHPN_dmRHCXmAyBzowVdCWgbTQw';
const VAPID_SUBJECT = 'mailto:kalpawishvajith01@gmail.com';

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Configure web-push
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Proper Web Push using VAPID and encrypted payloads
async function sendWebPushNotification(
  subscription: PushSubscription,
  payload: string
): Promise<void> {
  const subscriptionObject = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  console.log('📤 Sending push to endpoint:', subscription.endpoint);

  try {
    await webpush.sendNotification(subscriptionObject, payload, { TTL: 86400 });
    console.log('✅ Push sent successfully');
  } catch (error) {
    console.error('❌ Failed to send push:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { employeeIds, title, body, data, broadcast } = await req.json();

    console.log('📨 Push notification request received');
    console.log('Employee IDs:', employeeIds);
    console.log('Title:', title);
    console.log('Body:', body);

    // Load subscriptions: either targeted list or broadcast to all
    let subscriptions: any[] | null = null;
    let subsError: any = null;

    if (broadcast === true) {
      const result = await supabase
        .from('push_subscriptions')
        .select('*');
      subscriptions = result.data;
      subsError = result.error;
    } else {
      if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
        throw new Error('employeeIds must be a non-empty array (or set broadcast=true)');
      }
      const result = await supabase
        .from('push_subscriptions')
        .select('*')
        .in('employee_id', employeeIds);
      subscriptions = result.data;
      subsError = result.error;
    }

    if (subsError) {
      console.error('❌ Database error:', subsError);
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('⚠️ No push subscriptions found for employees:', employeeIds);
      return new Response(
        JSON.stringify({ 
          message: 'No subscriptions found. Employees need to enable notifications first.',
          sent: 0,
          total: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Found ${subscriptions.length} subscription(s)`);

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: title || 'Task Vision',
      body: body || 'You have a new notification',
      icon: '/icons/android-launchericon-192-192.png',
      badge: '/icons/android-launchericon-96-96.png',
      data: data || {},
      requireInteraction: true
    });

    // Deduplicate by endpoint to avoid double-sending
    const uniqueByEndpoint = new Map<string, any>();
    for (const sub of subscriptions) {
      if (!uniqueByEndpoint.has(sub.endpoint)) {
        uniqueByEndpoint.set(sub.endpoint, sub);
      }
    }
    const uniqueSubscriptions = Array.from(uniqueByEndpoint.values());

    // Helper: send with one retry for transient errors
    async function sendWithRetry(sub: any): Promise<{ success: boolean; employeeId: string; error?: string }>{
      try {
        await sendWebPushNotification({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, notificationPayload);
        return { success: true, employeeId: sub.employee_id };
      } catch (err1) {
        const msg1 = err1 instanceof Error ? err1.message : 'Unknown error';
        const transient = msg1.includes('429') || msg1.startsWith('5');
        if (transient) {
          // brief delay then retry once
          await new Promise(r => setTimeout(r, 500));
          try {
            await sendWebPushNotification({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, notificationPayload);
            return { success: true, employeeId: sub.employee_id };
          } catch (err2) {
            const msg2 = err2 instanceof Error ? err2.message : 'Unknown error';
            return { success: false, employeeId: sub.employee_id, error: msg2 };
          }
        }
        return { success: false, employeeId: sub.employee_id, error: msg1 };
      }
    }

    // Concurrency-limited batching to avoid timeouts
    const concurrency = 25;
    const results: Array<{ success: boolean; employeeId: string; error?: string }> = [];
    for (let i = 0; i < uniqueSubscriptions.length; i += concurrency) {
      const slice = uniqueSubscriptions.slice(i, i + concurrency);
      const batch = await Promise.all(
        slice.map(async (sub) => {
          const res = await sendWithRetry(sub);
          if (res.error && (res.error.includes('410') || res.error.includes('404'))) {
            console.log(`🗑️ Removing invalid subscription for employee ${sub.employee_id}`);
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
          return res;
        })
      );
      results.push(...batch);
    }

    const successful = results.filter(r => r.success).length;
    
    console.log(`📊 Results: ${successful}/${subscriptions.length} notifications sent successfully`);

    return new Response(
      JSON.stringify({ 
        message: `Sent ${successful} of ${subscriptions.length} notifications`,
        sent: successful,
        total: subscriptions.length,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error in send-push-notification function:', errorMessage);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Check edge function logs for more information'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
