# ✅ Frontend Localhost Configuration

## Status: COMPLETED ✅
**Date**: 2024-01-15
**Issue**: Change API base URL from production to localhost

## Changes Made:

### 🔧 **Environment Configuration:**

**File**: `src/app/service/environment.ts`

#### **Before (Production):**
```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'https://soil-sensor-backend.onrender.com',
  // ... other config
};
```

#### **After (Localhost):**
```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  // ... other config
};
```

## 🎯 **Impact:**

### **API Endpoints Changed:**

#### **Before:**
```
https://soil-sensor-backend.onrender.com/api/devices
https://soil-sensor-backend.onrender.com/api/users
https://soil-sensor-backend.onrender.com/api/measurements
```

#### **After:**
```
http://localhost:3000/api/devices
http://localhost:3000/api/users
http://localhost:3000/api/measurements
```

### **Frontend API Calls:**

#### **1. Device Creation:**
```typescript
// Before
POST https://soil-sensor-backend.onrender.com/api/devices

// After
POST http://localhost:3000/api/devices
```

#### **2. User Management:**
```typescript
// Before
GET https://soil-sensor-backend.onrender.com/api/users

// After
GET http://localhost:3000/api/users
```

#### **3. GPS Service:**
```typescript
// Before
GET https://soil-sensor-backend.onrender.com/api/gps/device/${deviceName}

// After
GET http://localhost:3000/api/gps/device/${deviceName}
```

## 🚀 **Benefits:**

### **1. Development Speed:**
- ✅ **Faster Response** - No network latency
- ✅ **Real-time Testing** - Immediate feedback
- ✅ **Debug Friendly** - Easy to debug locally

### **2. Backend Control:**
- ✅ **Local Backend** - Full control over backend
- ✅ **Database Access** - Direct database access
- ✅ **Log Monitoring** - Real-time logs

### **3. Development Workflow:**
- ✅ **Hot Reload** - Backend changes reflect immediately
- ✅ **No Deployment** - No need to deploy for testing
- ✅ **Offline Development** - Works without internet

## 📋 **Requirements:**

### **Backend Server Must Be Running:**
```bash
# Start backend server
cd backend-directory
npm start
# or
node server.js
```

### **Expected Backend Response:**
```json
// POST /api/devices
{
  "message": "Device created successfully",
  "device": {
    "deviceid": 1,
    "device_name": "esp32-soil-001",
    "device_status": "offline",
    "device_type": true,
    "description": "อุปกรณ์ทั่วไป",
    "userid": null,
    "api_key": "sk_abc123def456",
    "created_at": "2025-10-09T16:30:00.000Z",
    "updated_at": "2025-10-09T16:30:00.000Z"
  }
}
```

## 🔧 **Testing:**

### **1. Start Backend Server:**
```bash
# Terminal 1 - Backend
cd backend-directory
npm start
# Server running on http://localhost:3000
```

### **2. Start Frontend Server:**
```bash
# Terminal 2 - Frontend
cd frontend-directory
npm start
# Server running on http://localhost:4200
```

### **3. Test API Endpoint:**
```bash
# Test device creation
curl -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "esp32-soil-001",
    "device_name": "esp32-soil-001",
    "status": "offline",
    "device_type": true,
    "description": "อุปกรณ์ทั่วไป"
  }'
```

### **4. Expected Response:**
```json
{
  "message": "Device created successfully",
  "device": {
    "deviceid": 1,
    "device_name": "esp32-soil-001",
    "device_status": "offline",
    "device_type": true,
    "description": "อุปกรณ์ทั่วไป",
    "userid": null,
    "api_key": "sk_abc123def456",
    "created_at": "2025-10-09T16:30:00.000Z",
    "updated_at": "2025-10-09T16:30:00.000Z"
  }
}
```

## 📊 **Console Output:**

### **Frontend Console:**
```
🚀 addNewDevice() called with deviceId: esp32-soil-001
📤 Sending request to: http://localhost:3000/api/devices
📤 Request data: { deviceId: "esp32-soil-001", device_name: "esp32-soil-001", ... }
✅ Device created in database: { message: "Device created successfully", device: { ... } }
✅ Device added to devices array: { deviceid: 1, device_name: "esp32-soil-001", ... }
📋 Total devices: 3
```

### **Backend Console:**
```
POST /api/devices 201 15.432 ms - 234
Device created: esp32-soil-001
Database insert successful
```

## 🎯 **Development Workflow:**

### **1. Start Development:**
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend  
cd frontend
npm start
```

### **2. Test Features:**
- ✅ **Device Creation** - Create new devices
- ✅ **User Management** - Manage users
- ✅ **GPS Display** - View GPS data
- ✅ **History** - View measurement history

### **3. Debug Issues:**
- ✅ **Backend Logs** - Check server console
- ✅ **Frontend Logs** - Check browser console
- ✅ **Network Tab** - Check API calls
- ✅ **Database** - Check PostgreSQL data

## 🔄 **Revert to Production:**

### **If Needed:**
```typescript
// Change back to production
export const environment = {
  production: false,
  apiBaseUrl: 'https://soil-sensor-backend.onrender.com',
  // ... other config
};
```

## 📱 **Frontend Features:**

### **1. Device Creation:**
- ✅ **Local API** - Calls localhost:3000
- ✅ **Real Database** - Saves to local PostgreSQL
- ✅ **Immediate Response** - Fast local response

### **2. User Management:**
- ✅ **Local Users** - Local user data
- ✅ **Real Authentication** - Local Firebase auth
- ✅ **Database Sync** - Local database updates

### **3. GPS Display:**
- ✅ **Local GPS** - Local GPS data
- ✅ **Real Coordinates** - Actual coordinates
- ✅ **Map Display** - Local map rendering

## 🎉 **Result:**

### **✅ Before (Production):**
```
API calls to: https://soil-sensor-backend.onrender.com
❌ Network latency
❌ Deployment dependency
❌ Remote debugging
```

### **✅ After (Localhost):**
```
API calls to: http://localhost:3000
✅ Fast response
✅ Local control
✅ Easy debugging
```

**ตอนนี้ Frontend ใช้ localhost:3000 สำหรับ API calls แล้วครับ!** 🚀

**ต้องแน่ใจว่า Backend server ทำงานอยู่ที่ localhost:3000** ⚠️
