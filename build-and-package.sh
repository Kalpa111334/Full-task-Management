#!/bin/bash

# Build and Package Script for Task Vision PWA

echo "📦 Building Task Vision PWA with Enhanced Notifications"
echo "=================================================="

# Build the project
echo "🔨 Building production version..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build completed successfully!"

# Create package info
echo "📋 Creating package information..."
cat > package-info.txt << EOF
Task Vision - Enhanced PWA Task Management System
================================================

Features Implemented:
✅ Complete PWA Push Notification System
✅ Real-time Task Assignment Notifications
✅ Auto Task Reassignment Workflow
✅ Live Location Tracking (Uber-like)
✅ Geofence and Proximity Alerts
✅ Task Verification Process
✅ Employee Management with Credentials
✅ Background Location Tracking
✅ Battery-optimized Tracking
✅ Service Worker with Offline Support

Technical Stack:
- React 18 + TypeScript
- Vite + PWA Plugin
- Supabase (Backend & Edge Functions)
- Tailwind CSS + Shadcn/UI
- Web Push Notifications
- Geolocation API
- Service Workers

Installation:
1. Extract the ZIP file
2. Run: npm install --legacy-peer-deps
3. Run: npm run dev
4. Open: http://localhost:8080
5. Install as PWA when prompted
6. Enable notifications

PWA Features:
- Push Notifications (All notification types)
- Location Tracking (Real-time)
- Offline Support
- Background Sync
- Service Worker
- App-like Experience

Notification Types:
1. Task Assignment (Admin→Dept Head→Employee)
2. Task Status Updates (Approval/Rejection)
3. Task Verification (Admin requests)
4. Auto Reassignment (Rejected tasks)
5. Location Alerts (Geofence/Proximity)
6. Employee Credentials (Registration)

Built on: $(date)
Version: 2.0.0
EOF

echo "📦 Creating final package..."

# Create a clean copy for packaging
rm -rf ../task-vision-pwa-enhanced
mkdir -p ../task-vision-pwa-enhanced

# Copy all necessary files
cp -r public ../task-vision-pwa-enhanced/
cp -r src ../task-vision-pwa-enhanced/
cp -r supabase ../task-vision-pwa-enhanced/
cp -r dist ../task-vision-pwa-enhanced/
cp -r AppImages ../task-vision-pwa-enhanced/
cp -r dev-dist ../task-vision-pwa-enhanced/
cp -r node_modules ../task-vision-pwa-enhanced/ 2>/dev/null || true

# Copy configuration files
cp package.json ../task-vision-pwa-enhanced/
cp package-lock.json ../task-vision-pwa-enhanced/
cp vite.config.ts ../task-vision-pwa-enhanced/
cp tailwind.config.ts ../task-vision-pwa-enhanced/
cp tsconfig.json ../task-vision-pwa-enhanced/
cp tsconfig.app.json ../task-vision-pwa-enhanced/
cp tsconfig.node.json ../task-vision-pwa-enhanced/
cp eslint.config.js ../task-vision-pwa-enhanced/
cp postcss.config.js ../task-vision-pwa-enhanced/
cp components.json ../task-vision-pwa-enhanced/
cp index.html ../task-vision-pwa-enhanced/
cp netlify.toml ../task-vision-pwa-enhanced/
cp vercel.json ../task-vision-pwa-enhanced/

# Copy documentation
cp README.md ../task-vision-pwa-enhanced/
cp PWA_NOTIFICATIONS_README.md ../task-vision-pwa-enhanced/
cp NOTIFICATION_*.md ../task-vision-pwa-enhanced/
cp PWA_*.md ../task-vision-pwa-enhanced/
cp package-info.txt ../task-vision-pwa-enhanced/

# Copy startup script
cp start-dev.sh ../task-vision-pwa-enhanced/

# Create ZIP file
cd ..
zip -r "TaskVision-PWA-Enhanced-v2.0.0.zip" task-vision-pwa-enhanced/

echo ""
echo "🎉 Package created successfully!"
echo "📁 Location: ../TaskVision-PWA-Enhanced-v2.0.0.zip"
echo ""
echo "📋 Package Contents:"
echo "  ✅ Source Code (src/)"
echo "  ✅ PWA Assets (public/, AppImages/)"
echo "  ✅ Build Output (dist/)"
echo "  ✅ Configuration (package.json, vite.config.ts, etc.)"
echo "  ✅ Documentation (README.md, PWA_NOTIFICATIONS_README.md)"
echo "  ✅ Supabase Functions (supabase/)"
echo "  ✅ Startup Script (start-dev.sh)"
echo ""
echo "🚀 Ready for deployment!"
echo "=================================================="