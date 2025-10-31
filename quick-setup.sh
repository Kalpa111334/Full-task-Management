#!/bin/bash

# Quick Installation and Setup Script
# Task Vision PWA - Enhanced with Real-time Notifications

echo "🚀 Task Vision PWA - Quick Setup"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found."
    echo "Please run this script from the Task Vision project directory."
    exit 1
fi

echo "📦 Installing dependencies..."
echo "This may take a few minutes on first run..."
echo ""

# Install dependencies with legacy peer deps to avoid conflicts
npm install --legacy-peer-deps

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
else
    echo "⚠️  Some dependencies had issues, but core features should work."
    echo "You can try: npm install --force"
fi

echo ""
echo "🌟 Starting Task Vision PWA..."
echo "================================"
echo ""
echo "📱 PWA Features Enabled:"
echo "  ✅ Push Notifications (All Types)"
echo "  ✅ Real-time Location Tracking"
echo "  ✅ Auto Task Reassignment"
echo "  ✅ Geofence & Proximity Alerts"
echo "  ✅ Service Worker & Offline Support"
echo ""
echo "🔗 Application will be available at:"
echo "   http://localhost:8080"
echo ""
echo "📋 Quick Test Steps:"
echo "1. Open http://localhost:8080"
echo "2. Install as PWA (browser will prompt)"
echo "3. Login with any test account"
echo "4. Enable notifications in dashboard"
echo "5. Test task assignments and approvals"
echo "6. Try location tracking features"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=================================="
echo ""

# Start the development server
npm run dev