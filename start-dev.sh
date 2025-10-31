#!/bin/bash

# Task Vision - PWA Task Management System
# Enhanced with Real-time Push Notifications

echo "🚀 Starting Task Vision - PWA Task Management System"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

echo "📦 Checking dependencies..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📥 Installing dependencies (this may take a few minutes)..."
    npm install --legacy-peer-deps
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies. Please run 'npm install --legacy-peer-deps' manually."
        exit 1
    fi
    echo "✅ Dependencies installed successfully!"
else
    echo "✅ Dependencies already installed"
fi

echo ""
echo "🔧 PWA Features Enabled:"
echo "  ✅ Push Notifications"
echo "  ✅ Service Worker"
echo "  ✅ Location Tracking"
echo "  ✅ Background Sync"
echo "  ✅ Auto Task Reassignment"
echo "  ✅ Live Tracking (Uber-like)"
echo ""

echo "🌐 Starting development server..."
echo "📱 PWA will be available at: http://localhost:8080"
echo ""
echo "📋 To test PWA features:"
echo "  1. Open http://localhost:8080 in your browser"
echo "  2. Install as PWA when prompted"
echo "  3. Enable push notifications"
echo "  4. Test location tracking"
echo "  5. Try task assignments and approvals"
echo ""
echo "🔔 Notification Features:"
echo "  • Task Assignment → Employee Notification"
echo "  • Task Completion → Department Head Notification"
echo "  • Task Approval/Rejection → Employee Notification"
echo "  • Task Verification → Admin Notification"
echo "  • Auto Task Reassignment → Both Employees"
echo "  • Live Location Tracking → Real-time Updates"
echo "  • Geofence Breaches → Supervisor Alerts"
echo "  • Proximity Alerts → Arrival Notifications"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=================================================="
echo ""

# Start the development server
npm run dev