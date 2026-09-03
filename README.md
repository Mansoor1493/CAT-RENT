# 🏗️ CatRent

**Smart Rental Tracking, Utilization & Predictive Asset Optimization**

> **TRACK → MONITOR → ANALYZE → PREDICT → RECOMMEND → ACT**

**CatRent** transforms heavy equipment rental operations into an intelligent, real-time platform with live GIS fleet tracking, automated geofencing, multi-role approval workflows, AI-driven anomaly detection, demand forecasting, and smart asset reallocation.

---

## 📌 System Architecture

```
                                  ┌──────────────────────────────┐
                                  │       React + TypeScript      │
                                  │      TailwindCSS + Leaflet   │
                                  └──────────────┬───────────────┘
                                                 │ HTTP / REST & Socket.IO
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │     Node.js + Express API    │
                                  │   (JWT, RBAC, AlertEngine)   │
                                  └──────┬───────────────┬───────┘
                                         │               │
                     ┌───────────────────┴───┐       ┌───┴────────────────────────┐
                     │   MongoDB + Mongoose  │       │   FastAPI Python ML Engine │
                     │   (Fleet, Rentals,    │       │   (Isolation Forest,       │
                     │    Logs, Alerts)      │       │    XGBoost Forecasting)    │
                     └───────────────────────┘       └────────────────────────────┘
```

---

## 🚀 Key Feature Modules

### 1. 🗺️ Live Geospatial Fleet Intelligence Map
* **Real OpenStreetMap GIS**: Free, keyless map tiles centered on India (`[22.9734, 78.6569]`).
* **Assigned Site vs. Current Detected Site**: Real-time Haversine distance matching against 8 Indian project sites.
  * `✓ AT ASSIGNED SITE` (Green)
  * `⚠ WRONG SITE` (Red Pulsing Alert)
  * `⚠ OUTSIDE GEOFENCE` (Amber Alert)
* **Historical Movement Trail**: Breadcrumbs polyline over the last 30 min, 1 hour, or 4 hours.
* **Interactive GPS Playback**: Animated marker playback with Play / Pause / Reset controls and timestamp overlays.
* **Site Dwell Time**: Duration spent at the current detected site with active vs. idle ratio breakdown.
* **Site Summary & Utilization Heatmap**: Visual utilization intensity across all 8 project sites.
* **Nearest Equipment Finder**: Recommends nearby available machines ranked by distance, status, and health.

### 2. 🛡️ Role-Based Access Control (RBAC) & Approvals
* **Customer**: Browse available equipment, submit rental requests, request rental extensions, and view rented assets.
* **Admin / Rental Manager**: Full fleet oversight, approve/reject rental and extension requests, audit logs, and trigger simulation scenarios.
* **Site Manager**: Scoped visibility limited strictly to assigned project sites (e.g., S002 & S005) with 403 Forbidden enforcement on unauthorized sites.

### 3. 🔍 3-Method Check-In / Check-Out Station
* **QR Code Scanner**: Camera-based HTML5-QRCode scanner, interactive file upload, and sample QR tester.
* **RFID Simulation**: Simulated RFID reader with instant asset discovery.
* **Manual User Entry**: Fast alphanumeric lookup by Equipment ID or Serial Number.
* **Thermal Label Generation**: Reusable modal to download PNG/SVG or print 4×6 industrial thermal labels.
* **Rich Equipment Action Panel**: Live telematics, assigned vs. detected site match, active rental agreement details, and direct digital shift check-in / check-out.

### 4. ⚙️ Industrial Alert Engine (10 Rules)
1. **Machine Overuse** (>12h daily operation)
2. **High Idle Hours** (>5h continuous idle)
3. **Under-Utilization** (<20% running time)
4. **High Engine Hours** (Approaching maintenance threshold)
5. **Fuel Anomaly** (Rapid fuel drop >15%/h)
6. **High Engine Temperature** (>100°C thermal threshold)
7. **Geofence Breach** (Movement outside assigned site radius)
8. **Overdue Rental** (Unreturned past expected return date)
9. **Unassigned Machine Operation** (Active without assigned operator)
10. **Unauthorized Site Movement** (`LOCATION_MISMATCH` wrong site operation)

---

## 📍 Demonstration Project Sites (India)

| Site ID | Project Site Name | Location | Coordinates | Geofence |
|---|---|---|---|---|
| **S001** | Chennai Industrial Project | OMR IT & Manufacturing Corridor, Chennai, TN | `13.0827, 80.2707` | 5.0 km |
| **S002** | Bengaluru Infrastructure Project | Electronic City Phase II, Bengaluru, KA | `12.9716, 77.5946` | 5.0 km |
| **S003** | Hyderabad Construction Project | HITEC City Metro Extension, Hyderabad, TG | `17.3850, 78.4867` | 5.0 km |
| **S004** | Pune Industrial Project | Chakan Industrial Area Phase III, Pune, MH | `18.5204, 73.8567` | 5.0 km |
| **S005** | Mumbai Infrastructure Project | Bandra-Kurla Complex (BKC), Mumbai, MH | `19.0760, 72.8777` | 5.0 km |
| **S006** | Ahmedabad Manufacturing Project | Sanand Industrial Estate, Ahmedabad, GJ | `23.0225, 72.5714` | 5.0 km |
| **S007** | Delhi NCR Construction Project | Dwarka Expressway Sector 113, Gurugram / Delhi | `28.6139, 77.2090` | 5.0 km |
| **S008** | Kolkata Infrastructure Project | New Town Action Area II, Kolkata, WB | `22.5726, 88.3639` | 5.0 km |

---

## 🔑 Demo Login Credentials

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Admin** | `admin@example.com` | `catrent2026` | Full administrative access, approvals, audit logs, simulations |
| **Site Manager** | `manager@example.com` | `catrent2026` | Scoped to Sites **S002** (Bengaluru) and **S005** (Mumbai) |
| **Customer** | `customer@example.com` | `catrent2026` | Rental catalog, request submission, rental extension requests |

---

## 🛠️ Quick Start & Local Setup

### Prerequisites
* **Node.js**: v18.0.0+
* **MongoDB**: v6.0+ running locally on `mongodb://localhost:27017/catrent`
* **Python**: v3.10+ (for ML microservice)

### 1. Backend Setup
```bash
cd backend
npm install
npm run seed      # Seeds 8 Indian sites, 60 assets, users, rentals, and logs
npm run dev       # Starts Express API + Socket.IO server on port 3001
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev       # Starts Vite React client on http://localhost:5173
```

### 3. ML Service (Optional / Python)
```bash
cd ml-service
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

---

## 🧪 Automated Testing & Verification

Run the end-to-end verification suites from the `backend/` directory:

```bash
# 1. Enhanced QR Scanning & Check-In/Out Workflow Suite (18/18 Tests)
npx tsx src/test-qr-workflow.ts

# 2. Live Geospatial Fleet Map Suite (27/27 Tests)
npx tsx src/test-live-map.ts

# 3. RBAC & Rental Workflow Suite (12/12 Tests)
npx tsx src/test-rbac-workflow.ts

# 4. Caterpillar 3-Method Check-In/Check-Out Suite
npx tsx src/test-caterpillar-station.ts
```

---

## 📦 Tech Stack

* **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Leaflet, React-Leaflet, TanStack Query, Recharts, Lucide Icons, html5-qrcode, qrcode.
* **Backend**: Node.js, Express, TypeScript, Mongoose (MongoDB), Socket.IO, bcryptjs, JSON Web Tokens (JWT).
* **ML Microservice**: Python, FastAPI, scikit-learn, Isolation Forest, XGBoost.
