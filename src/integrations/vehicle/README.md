# Real GPS Vehicle Tracking Integration

This system connects to OpenGTS (Open GPS Tracking System) to display live vehicle locations with 100% accurate satellite data.

## 🚗 OpenGTS Setup (Open Source & Free)

### Step 1: Deploy OpenGTS Server

**Requirements:**
- Java 8 or higher
- Apache Tomcat 8.5+
- MySQL or PostgreSQL database

**Option A: Cloud Deployment**
1. Deploy to DigitalOcean, AWS, or any VPS with Java support
2. Download OpenGTS from http://www.opengts.org/
3. Extract and configure:
```bash
cd OpenGTS_*/
bin/initdb.sh -rootUser=root -rootPass=yourpass
ant all
```
4. Deploy WAR file to Tomcat
5. Access at `http://your-server-ip:8080/track`

**Option B: Docker Deployment (Easier)**
```bash
docker pull wanix/opengts
docker run -d -p 8080:8080 -p 31000-31010:31000-31010 wanix/opengts
```

### Step 2: Configure OpenGTS

1. Login to OpenGTS web interface (default: admin/admin)
2. Create an account for your organization
3. Add devices under Devices → Add New Device
4. Set Device ID to match vehicle registration number (e.g., CAB-1234)
5. Configure device protocols based on your GPS hardware

### Step 3: Configure GPS Devices

OpenGTS supports many GPS protocols:
- **GPRMC/GPGGA** (Generic NMEA)
- **TK102/TK103** (Xexun/Coban)
- **GT06** (Concox/JiMi)
- **H02** (GPS Watch Protocol)
- **And many more**

Configure each GPS tracker with:
- Server IP: Your OpenGTS server address
- Port: Depends on protocol (e.g., 31272 for TK103, 31200 for GPRMC)
- Device ID: Vehicle registration number

### Step 4: Connect Your App

Add these to your environment configuration:

```bash
VITE_OPENGTS_URL=http://your-opengts-server.com:8080
VITE_OPENGTS_USER=admin
VITE_OPENGTS_PASS=your_password
```

**Security Note:** For production, use HTTPS and create a dedicated API user with read-only permissions.

### Step 5: Test Vehicle Tracking

1. In your app, enter the Device ID (vehicle registration number)
2. The system will poll OpenGTS every 5 seconds for latest position
3. Live location will display on the map with real GPS data

## 📡 What You'll Get

✅ **Real-time GPS coordinates** (latitude, longitude from satellites)  
✅ **Speed and heading** (calculated from GPS data)  
✅ **Odometer readings** (if device supports)  
✅ **Battery level** (if device reports it)  
✅ **Movement status** (moving/stationary)  
✅ **Vehicle information** (configured in OpenGTS)  
✅ **Historical tracking data**  
✅ **Geofencing alerts** (configured in OpenGTS)

## 🛠️ Alternative: Custom GPS Provider

If you have your own GPS tracking API:

```bash
VITE_VEHICLE_WS_URL=wss://your-provider.example.com/stream
```

Your WebSocket endpoint must:
- Accept `?vehicle=ABC-1234` query parameter
- Emit JSON messages: `{ lat: number, lng: number, timestamp: string }`

## 📋 Supported GPS Hardware

OpenGTS works with hundreds of GPS tracker models:
- **Chinese Trackers**: GT06, TK102, TK103, TK104, TK106
- **Professional**: Teltonika, Queclink, Coban
- **Smartphones**: Can use OpenGTS mobile apps
- **Vehicle OBD-II**: Devices that plug into car diagnostics port
- **Asset Trackers**: Battery-powered devices for containers/equipment

## 🔧 OpenGTS Configuration Files

Key configuration files:
- `config.conf`: Main configuration
- `dcservers.xml`: Device communication server definitions
- `webapp.conf`: Web interface settings

## 🔒 Security Recommendations

1. **Use HTTPS** in production (configure Tomcat with SSL)
2. **Create dedicated API user** with read-only access
3. **Firewall rules**: Only allow GPS device ports from known IPs
4. **Change default passwords** immediately after installation
5. **Regular backups** of MySQL/PostgreSQL database
6. **Keep OpenGTS updated** for security patches

## 💡 Cost Considerations

- **OpenGTS Server**: Free (self-hosted) or ~$10-40/month for VPS
- **GPS Tracking Devices**: $15-80 per device (one-time purchase)
- **SIM Cards**: $3-15/month per device (for cellular trackers)
- **Database**: Free (MySQL/PostgreSQL)
- **Total First Year**: ~$150-500 per vehicle (much cheaper than commercial services!)

## 📚 Additional Resources

- Official Documentation: http://www.opengts.org/
- Device Configuration Guide: Check dcservers.xml for port numbers
- Community Forum: http://www.geotelematic.com/forum/
- GitHub: https://github.com/OpenGTS/OpenGTS

## 🆘 Troubleshooting

**No data appearing?**
- Check GPS device is online and has cellular signal
- Verify device is configured with correct server IP and port
- Check OpenGTS logs: `tail -f OpenGTS_*/logs/track.log`
- Ensure firewall allows GPS device ports

**Authentication errors?**
- Verify VITE_OPENGTS_USER and VITE_OPENGTS_PASS are correct
- Check user has appropriate permissions in OpenGTS

**Outdated positions?**
- GPS device may be offline or out of cellular coverage
- Check device battery level
- Verify SIM card has active data plan


