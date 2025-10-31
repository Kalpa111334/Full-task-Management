import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA: Register service worker for push notifications and offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        console.log('✅ Service Worker registered successfully:', registration.scope);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
      })
      .catch(error => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });
}

// PWA: Handle install prompt
let deferredPrompt: any;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  console.log('💡 PWA install prompt available');
  
  // Optional: Show your own install button
  // You can dispatch a custom event here to show an install button in your UI
  window.dispatchEvent(new CustomEvent('pwa-install-available'));
});

// PWA: Handle successful installation
window.addEventListener('appinstalled', () => {
  console.log('✅ PWA installed successfully');
  deferredPrompt = null;
});

// Export function to trigger install prompt (can be called from UI)
(window as any).showPWAInstallPrompt = async () => {
  if (!deferredPrompt) {
    console.log('⚠️ Install prompt not available');
    return false;
  }
  
  // Show the install prompt
  deferredPrompt.prompt();
  
  // Wait for the user to respond to the prompt
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`👤 User response to install prompt: ${outcome}`);
  
  // Clear the saved prompt
  deferredPrompt = null;
  
  return outcome === 'accepted';
};

createRoot(document.getElementById("root")!).render(<App />);
