# Manual Point ID System - API Documentation 📚

## 📋 Overview

**Document:** Complete API documentation for Manual Point ID System  
**Version:** 1.0.0  
**Status:** ✅ **Production Ready**  
**Base URL:** `http://localhost:3000/api`

**Last Updated:** October 12, 2025

---

## 🏷️ Manual Point Management APIs

### **1. Create Measurement Points**

#### **Endpoint:** `POST /api/manual-points/create-points/:areaId`

**Description:** Create measurement points for a specific area

**Parameters:**
- `areaId` (path): Area ID (integer)

**Request Body Options:**

#### **Option 1: Custom Points**
```json
{
  "pointIds": ["A1", "A2", "B1", "B2", "C1", "C2"]
}
```

#### **Option 2: Grid Points**
```json
{
  "gridSize": {
    "rows": 5,
    "cols": 5
  }
}
```

#### **Option 3: Sequential Points**
```json
{
  "totalPoints": 25
}
```

#### **Option 4: Pattern-based Points**
```json
{
  "pattern": "A",
  "totalPoints": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "Points created successfully",
  "data": {
    "areaId": 87,
    "pointsCreated": 6,
    "pointIds": ["A1", "A2", "B1", "B2", "C1", "C2"],
    "pointType": "custom"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Area not found",
  "code": "AREA_NOT_FOUND"
}
```

---

### **2. Get All Points**

#### **Endpoint:** `GET /api/manual-points/points/:areaId`

**Description:** Retrieve all measurement points for an area

**Parameters:**
- `areaId` (path): Area ID (integer)

**Response:**
```json
{
  "success": true,
  "data": {
    "areaId": 87,
    "totalPoints": 6,
    "points": [
      {
        "id": 1,
        "pointId": "A1",
        "pointType": "custom",
        "isMeasured": false,
        "createdAt": "2025-10-12T10:30:00.000Z",
        "measuredAt": null
      },
      {
        "id": 2,
        "pointId": "A2",
        "pointType": "custom",
        "isMeasured": true,
        "createdAt": "2025-10-12T10:30:00.000Z",
        "measuredAt": "2025-10-12T11:00:00.000Z"
      }
    ]
  }
}
```

---

### **3. Check Progress**

#### **Endpoint:** `GET /api/manual-points/progress/:areaId`

**Description:** Get measurement progress for an area

**Parameters:**
- `areaId` (path): Area ID (integer)

**Response:**
```json
{
  "success": true,
  "data": {
    "areaId": 87,
    "totalPoints": 6,
    "measuredPoints": 2,
    "remainingPoints": 4,
    "completionPercentage": 33,
    "status": "in_progress"
  }
}
```

---

### **4. Get Next Point**

#### **Endpoint:** `GET /api/manual-points/next-point/:areaId`

**Description:** Get the next unmeasured point

**Parameters:**
- `areaId` (path): Area ID (integer)

**Response:**
```json
{
  "success": true,
  "data": {
    "nextPoint": "B1",
    "pointId": "B1",
    "areaId": 87,
    "isLast": false
  }
}
```

**No More Points Response:**
```json
{
  "success": true,
  "data": {
    "nextPoint": null,
    "pointId": null,
    "areaId": 87,
    "isLast": true,
    "message": "All points have been measured"
  }
}
```

---

### **5. Mark Point as Measured**

#### **Endpoint:** `PUT /api/manual-points/mark-measured/:areaId/:pointId`

**Description:** Mark a specific point as measured

**Parameters:**
- `areaId` (path): Area ID (integer)
- `pointId` (path): Point ID (string)

**Response:**
```json
{
  "success": true,
  "message": "Point marked as measured",
  "data": {
    "pointId": "A1",
    "areaId": 87,
    "isMeasured": true,
    "measuredAt": "2025-10-12T11:00:00.000Z"
  }
}
```

---

### **6. Reset All Points**

#### **Endpoint:** `PUT /api/manual-points/reset/:areaId`

**Description:** Reset all points in an area to unmeasured status

**Parameters:**
- `areaId` (path): Area ID (integer)

**Response:**
```json
{
  "success": true,
  "message": "All points reset successfully",
  "data": {
    "areaId": 87,
    "pointsReset": 6,
    "status": "reset"
  }
}
```

---

### **7. Get Statistics**

#### **Endpoint:** `GET /api/manual-points/stats/:areaId`

**Description:** Get comprehensive statistics for an area

**Parameters:**
- `areaId` (path): Area ID (integer)

**Response:**
```json
{
  "success": true,
  "data": {
    "areaId": 87,
    "totalPoints": 6,
    "measuredPoints": 2,
    "skippedPoints": 0,
    "completionRate": 33,
    "averageTimePerPoint": "2.5 minutes",
    "estimatedTimeRemaining": "10 minutes",
    "startDate": "2025-10-12T10:30:00.000Z",
    "lastMeasurement": "2025-10-12T11:00:00.000Z"
  }
}
```

---

## 🔄 Sequential Measurement APIs

### **1. Start Session**

#### **Endpoint:** `POST /api/sequential/start-session/:areaId`

**Description:** Start a new measurement session

**Parameters:**
- `areaId` (path): Area ID (integer)

**Response:**
```json
{
  "success": true,
  "message": "Session started successfully",
  "data": {
    "sessionId": "session_123456",
    "areaId": 87,
    "totalPoints": 6,
    "currentPoint": "A1",
    "status": "active",
    "startedAt": "2025-10-12T10:30:00.000Z"
  }
}
```

---

### **2. Get Current Point**

#### **Endpoint:** `GET /api/sequential/current-point/:areaId`

**Description:** Get the current point in the session

**Parameters:**
- `areaId` (path): Area ID (integer)

**Response:**
```json
{
  "success": true,
  "data": {
    "currentPoint": "A1",
    "pointId": "A1",
    "sessionId": "session_123456",
    "isFirst": true,
    "isLast": false,
    "progress": "1/6"
  }
}
```

---

### **3. Complete Measurement**

#### **Endpoint:** `POST /api/sequential/complete-measurement/:areaId/:pointId`

**Description:** Complete measurement for a specific point

**Parameters:**
- `areaId` (path): Area ID (integer)
- `pointId` (path): Point ID (string)

**Request Body:**
```json
{
  "measurementData": {
    "moisture": 45.2,
    "ph": 6.8,
    "temperature": 24.5,
    "nitrogen": 120,
    "phosphorus": 45,
    "potassium": 180
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Measurement completed successfully",
  "data": {
    "completedPoint": "A1",
    "nextPoint": "A2",
    "progress": "1/6 completed",
    "measurementId": 123,
    "sessionId": "session_123456"
  }
}
```

---

### **4. Skip Point**

#### **Endpoint:** `POST /api/sequential/skip-point/:areaId/:pointId`

**Description:** Skip a specific point

**Parameters:**
- `areaId` (path): Area ID (integer)
- `pointId` (path): Point ID (string)

**Request Body:**
```json
{
  "reason": "Point inaccessible"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Point skipped successfully",
  "data": {
    "skippedPoint": "A2",
    "nextPoint": "A3",
    "reason": "Point inaccessible",
    "sessionId": "session_123456"
  }
}
```

---

### **5. Get Session Status**

#### **Endpoint:** `GET /api/sequential/session-status/:areaId`

**Description:** Get current session status

**Parameters:**
- `areaId` (path): Area ID (integer)

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session_123456",
    "areaId": 87,
    "status": "active",
    "totalPoints": 6,
    "completedPoints": 2,
    "skippedPoints": 1,
    "currentPoint": "A3",
    "progress": "2/6 completed",
    "startedAt": "2025-10-12T10:30:00.000Z",
    "lastActivity": "2025-10-12T11:00:00.000Z"
  }
}
```

---

## 🔗 ESP32 Integration API

### **Firebase Measurement Endpoint**

#### **Endpoint:** `POST /api/firebase-measurements/from-firebase`

**Description:** Receive measurement data from ESP32 via Firebase

**Request Body:**
```json
{
  "deviceId": "esp32-soil-01",
  "deviceName": "esp32-soil-01",
  "finished": true,
  "point_id": "A1",
  "areasid": 87,
  "moisture": 45.2,
  "ph": 6.8,
  "temperature": 24.5,
  "nitrogen": 120,
  "phosphorus": 45,
  "potassium": 180,
  "timestamp": 1697123456789
}
```

**Response:**
```json
{
  "success": true,
  "message": "Measurement recorded successfully",
  "data": {
    "measurementId": 123,
    "pointId": "A1",
    "areaId": 87,
    "deviceId": "esp32-soil-01",
    "progress": {
      "completed": 1,
      "total": 6,
      "percentage": 17
    },
    "nextPoint": "A2"
  }
}
```

---

## 📊 Error Handling

### **Standard Error Response Format:**
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-10-12T10:30:00.000Z"
}
```

### **Common Error Codes:**

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `AREA_NOT_FOUND` | Area ID does not exist | 404 |
| `POINT_NOT_FOUND` | Point ID does not exist | 404 |
| `POINT_ALREADY_MEASURED` | Point already measured | 400 |
| `INVALID_POINT_ID` | Invalid point ID format | 400 |
| `SESSION_NOT_FOUND` | Session does not exist | 404 |
| `SESSION_EXPIRED` | Session has expired | 410 |
| `INVALID_MEASUREMENT_DATA` | Invalid measurement data | 400 |
| `DATABASE_ERROR` | Database operation failed | 500 |

---

## 🧪 Testing Examples

### **Complete Workflow Test:**

#### **Step 1: Create Points**
```bash
curl -X POST http://localhost:3000/api/manual-points/create-points/87 \
  -H "Content-Type: application/json" \
  -d '{"pointIds": ["A1", "A2", "B1", "B2"]}'
```

#### **Step 2: Check Progress**
```bash
curl http://localhost:3000/api/manual-points/progress/87
```

#### **Step 3: Get Next Point**
```bash
curl http://localhost:3000/api/manual-points/next-point/87
```

#### **Step 4: Mark Point Measured**
```bash
curl -X PUT http://localhost:3000/api/manual-points/mark-measured/87/A1
```

#### **Step 5: Get Statistics**
```bash
curl http://localhost:3000/api/manual-points/stats/87
```

---

## 📋 Summary

### **API Coverage:**
- ✅ **Manual Point Management:** 7 endpoints
- ✅ **Sequential Measurement:** 5 endpoints
- ✅ **ESP32 Integration:** 1 endpoint
- ✅ **Error Handling:** Comprehensive error codes
- ✅ **Testing:** Complete workflow examples

### **Key Features:**
- ✅ **RESTful Design:** Standard HTTP methods
- ✅ **JSON Format:** Consistent request/response format
- ✅ **Error Handling:** Comprehensive error codes
- ✅ **Documentation:** Complete API reference
- ✅ **Testing:** Ready-to-use examples

---

**Status:** ✅ **COMPLETE API DOCUMENTATION**  
**Coverage:** ✅ **ALL ENDPOINTS DOCUMENTED**  
**Examples:** ✅ **READY-TO-USE**  
**Error Handling:** ✅ **COMPREHENSIVE**  
**Last Updated:** October 12, 2025
