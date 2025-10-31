// Service Worker for PWA, Push Notifications and Background Location Tracking

const CACHE_NAME = 'task-vision-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/android-launchericon-192-192.png',
  '/icons/android-launchericon-512-512.png'
];

console.log('✅ Service Worker loaded');

// Service Worker installation
self.addEventListener('install', (event) => {
  console.log('✅ Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Service Worker activation
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

// Fetch event - Network first, falling back to cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            // Return offline page or default response
            return new Response('Offline - Content not available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('📨 Push notification received:', event);
  console.log('Push notification received:', event);
  
  if (!event.data) {
    return;
  }

  const data = event.data.json();
  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/icons/android-launchericon-192-192.png',
    badge: data.badge || '/icons/android-launchericon-96-96.png',
    data: data.data || {},
    requireInteraction: true,
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Task Vision', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  if (event.action) {
    console.log('Action clicked:', event.action);
  }

  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});

// Background location tracking
let locationTrackingActive = false;
let lastLocation = null;
let trackingInterval = null;

self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data.type === 'START_LOCATION_TRACKING') {
    startLocationTracking();
  } else if (event.data.type === 'STOP_LOCATION_TRACKING') {
    stopLocationTracking();
  } else if (event.data.type === 'LOCATION_UPDATE') {
    handleLocationUpdate(event.data.location);
  } else if (event.data.type === 'SHOW_INSTANT_NOTIFICATION') {
    showInstantNotification(event.data.title, event.data.body, event.data.data);
  }
});

function startLocationTracking() {
  if (locationTrackingActive) return;
  
  console.log('📍 Starting background location tracking...');
  locationTrackingActive = true;
  
  // Get current location immediately
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleLocationUpdate({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        });
      },
      (error) => {
        console.error('Error getting current location:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }
  
  // Set up periodic tracking every 30 seconds
  trackingInterval = setInterval(() => {
    if (navigator.geolocation && locationTrackingActive) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleLocationUpdate({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          });
        },
        (error) => {
          console.error('Background location tracking error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );
    }
  }, 30000); // 30 seconds
}

function stopLocationTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  locationTrackingActive = false;
  console.log('⏹️ Stopped background location tracking');
}

function handleLocationUpdate(location) {
  const distance = calculateDistance(lastLocation, location);
  const speed = calculateSpeed(lastLocation, location);
  
  // Notify if employee is moving (like Uber tracking)
  if (distance > 50 && speed > 1) { // Moved more than 50m and moving
    const notificationData = {
      action: 'employee_moving',
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy
      },
      distance: Math.round(distance),
      speed: Math.round(speed * 3.6) // Convert m/s to km/h
    };
    
    // Send location update notification to admin/supervisor
    showInstantNotification(
      '📍 Employee Moving',
      `Tracking employee movement - Speed: ${Math.round(speed * 3.6)}km/h`,
      notificationData
    );
  }
  
  lastLocation = location;
  
  // Store location for offline sync
  storeLocationForSync(location);
}

function calculateDistance(pos1, pos2) {
  if (!pos1 || !pos2) return 0;
  
  const R = 6371000; // Earth's radius in meters
  const lat1 = pos1.latitude * Math.PI / 180;
  const lat2 = pos2.latitude * Math.PI / 180;
  const deltaLat = (pos2.latitude - pos1.latitude) * Math.PI / 180;
  const deltaLon = (pos2.longitude - pos1.longitude) * Math.PI / 180;
  
  const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
          Math.cos(lat1) * Math.cos(lat2) *
          Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
}

function calculateSpeed(pos1, pos2) {
  if (!pos1 || !pos2) return 0;
  
  const distance = calculateDistance(pos1, pos2);
  const timeDiff = (pos2.timestamp - pos1.timestamp) / 1000; // seconds
  
  if (timeDiff === 0) return 0;
  
  return distance / timeDiff; // meters per second
}

function storeLocationForSync(location) {
  // Store in IndexedDB for offline sync
  const locationData = {
    ...location,
    synced: false,
    id: Date.now()
  };
  
  // This would typically use IndexedDB, but for simplicity we'll use localStorage
  try {
    const locations = JSON.parse(localStorage.getItem('offlineLocations') || '[]');
    locations.push(locationData);
    
    // Keep only last 100 locations
    if (locations.length > 100) {
      locations.splice(0, locations.length - 100);
    }
    
    localStorage.setItem('offlineLocations', JSON.stringify(locations));
  } catch (error) {
    console.error('Error storing location for sync:', error);
  }
}

function showInstantNotification(title, body, data = {}) {
  const options = {
    body,
    icon: '/icons/android-launchericon-192-192.png',
    badge: '/icons/android-launchericon-96-96.png',
    data,
    requireInteraction: false,
    tag: 'instant-notification',
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  
  self.registration.showNotification(title, options);
}

// Periodic background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'location-sync') {
    event.waitUntil(syncOfflineLocations());
  }
});

async function syncOfflineLocations() {
  try {
    const locations = JSON.parse(localStorage.getItem('offlineLocations') || '[]');
    const unsyncedLocations = locations.filter(loc => !loc.synced);
    
    if (unsyncedLocations.length === 0) return;
    
    // Send to server (this would require a proper implementation)
    console.log('Syncing', unsyncedLocations.length, 'locations to server');
    
    // Mark as synced
    unsyncedLocations.forEach(loc => {
      loc.synced = true;
    });
    
    localStorage.setItem('offlineLocations', JSON.stringify(locations));
  } catch (error) {
    console.error('Error syncing offline locations:', error);
  }
}

// Background fetch for large uploads
self.addEventListener('backgroundfetch', (event) => {
  console.log('Background fetch event:', event.tag);
});
