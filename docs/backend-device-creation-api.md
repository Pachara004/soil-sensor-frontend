# 🔧 Backend Device Creation API - Required

## Status: URGENT ⚠️
**Date**: 2024-01-15
**Issue**: Frontend needs API endpoint for device creation

## Required API Endpoint:

### **POST /api/devices**

#### **Request:**
```http
POST /api/devices
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "deviceId": "esp32-soil-001",
  "device_name": "esp32-soil-001",
  "status": "offline",
  "device_type": true,
  "description": "อุปกรณ์ทั่วไป"
}
```

#### **Response (Success):**
```json
{
  "success": true,
  "message": "Device created successfully",
  "device": {
    "deviceid": 123,
    "device_name": "esp32-soil-001",
    "status": "offline",
    "device_type": true,
    "description": "อุปกรณ์ทั่วไป",
    "userid": 7,
    "api_key": "sk_abc123def456",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

#### **Response (Error):**
```json
{
  "success": false,
  "message": "Device ID already exists"
}
```

## Database Schema:

### **Device Table:**
```sql
CREATE TABLE device (
  deviceid SERIAL PRIMARY KEY,
  device_name VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'offline',
  device_type BOOLEAN DEFAULT true,
  description TEXT,
  userid INTEGER REFERENCES users(userid),
  api_key VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Backend Implementation:

### **Express.js Route:**
```javascript
// api/devices.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const authMiddleware = require('../middleware/auth');

// POST /api/devices - Create new device
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { deviceId, device_name, status, device_type, description } = req.body;
    const userid = req.user.userid;
    
    // Generate API key
    const api_key = 'sk_' + Math.random().toString(36).substring(2, 15);
    
    // Insert device into database
    const result = await pool.query(
      `INSERT INTO device (device_name, status, device_type, description, userid, api_key, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
       RETURNING *`,
      [device_name, status, device_type, description, userid, api_key]
    );
    
    const device = result.rows[0];
    
    res.json({
      success: true,
      message: 'Device created successfully',
      device: {
        deviceid: device.deviceid,
        device_name: device.device_name,
        status: device.status,
        device_type: device.device_type,
        description: device.description,
        userid: device.userid,
        api_key: device.api_key,
        created_at: device.created_at,
        updated_at: device.updated_at
      }
    });
    
  } catch (err) {
    console.error('Error creating device:', err);
    
    if (err.code === '23505') { // Unique constraint violation
      res.status(409).json({
        success: false,
        message: 'Device ID already exists'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
});

module.exports = router;
```

### **Authentication Middleware:**
```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = authMiddleware;
```

## Error Handling:

### **HTTP Status Codes:**
- **200** - Success
- **400** - Bad Request (invalid data)
- **401** - Unauthorized (invalid token)
- **409** - Conflict (device ID exists)
- **500** - Internal Server Error

### **Error Messages:**
```json
// 400 Bad Request
{
  "success": false,
  "message": "Invalid device data"
}

// 401 Unauthorized
{
  "success": false,
  "message": "Invalid token"
}

// 409 Conflict
{
  "success": false,
  "message": "Device ID already exists"
}

// 500 Internal Server Error
{
  "success": false,
  "message": "Internal server error"
}
```

## Frontend Integration:

### **Request Data:**
```typescript
const requestData = {
  deviceId: isTestDevice ? `esp32-soil-test-${Date.now()}` : deviceName,
  device_name: isTestDevice ? `esp32-soil-test-${Date.now()}` : deviceName,
  status: isTestDevice ? 'online' : 'offline',
  device_type: isTestDevice ? false : true,
  description: isTestDevice ? 'อุปกรณ์ทดสอบ ESP32 Soil Sensor สำหรับทดสอบ API measurement' : 'อุปกรณ์ทั่วไป'
};
```

### **API Call:**
```typescript
const response = await lastValueFrom(
  this.http.post<ClaimResponse>(`${this.apiUrl}/api/devices`, requestData, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
);
```

### **Response Handling:**
```typescript
if (isSuccess) {
  // Add device to array
  const newDevice: Device = {
    deviceid: response.device?.deviceid,
    device_name: response.device?.device_name,
    status: response.device?.status,
    device_type: response.device?.device_type,
    description: response.device?.description,
    api_key: response.device?.api_key,
    created_at: response.device?.created_at,
    updated_at: response.device?.updated_at,
    userid: this.userID ? parseInt(this.userID) : 0
  };
  
  this.devices.push(newDevice);
  this.selectedDeviceId = newDevice.device_name;
  this.selectedDevice = newDevice;
}
```

## Testing:

### **Test Cases:**

#### **1. Valid Device Creation:**
```bash
curl -X POST http://localhost:3000/api/devices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "esp32-soil-001",
    "device_name": "esp32-soil-001",
    "status": "offline",
    "device_type": true,
    "description": "อุปกรณ์ทั่วไป"
  }'
```

#### **2. Test Device Creation:**
```bash
curl -X POST http://localhost:3000/api/devices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "esp32-soil-test-1234567890",
    "device_name": "esp32-soil-test-1234567890",
    "status": "online",
    "device_type": false,
    "description": "อุปกรณ์ทดสอบ ESP32 Soil Sensor สำหรับทดสอบ API measurement"
  }'
```

#### **3. Duplicate Device ID:**
```bash
# First request - should succeed
curl -X POST http://localhost:3000/api/devices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"device_name": "esp32-soil-001", ...}'

# Second request - should fail with 409
curl -X POST http://localhost:3000/api/devices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"device_name": "esp32-soil-001", ...}'
```

## Security Considerations:

### **1. Authentication:**
- ✅ **JWT Token Required** - All requests must include valid JWT
- ✅ **User Validation** - Token must contain valid user ID
- ✅ **Token Expiry** - Tokens should have reasonable expiry time

### **2. Input Validation:**
- ✅ **Device Name** - Must be unique, alphanumeric with hyphens
- ✅ **Status** - Must be 'online' or 'offline'
- ✅ **Device Type** - Must be boolean
- ✅ **Description** - Must be string, max length 500

### **3. Database Security:**
- ✅ **SQL Injection Prevention** - Use parameterized queries
- ✅ **User Isolation** - Users can only create devices for themselves
- ✅ **Unique Constraints** - Prevent duplicate device names

## Deployment:

### **1. Environment Variables:**
```bash
JWT_SECRET=your_jwt_secret_here
DATABASE_URL=postgresql://user:password@localhost:5432/soil_sensor
```

### **2. Database Migration:**
```sql
-- Create device table
CREATE TABLE device (
  deviceid SERIAL PRIMARY KEY,
  device_name VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'offline',
  device_type BOOLEAN DEFAULT true,
  description TEXT,
  userid INTEGER REFERENCES users(userid),
  api_key VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_device_userid ON device(userid);
CREATE INDEX idx_device_name ON device(device_name);
```

### **3. API Documentation:**
```yaml
/api/devices:
  post:
    summary: Create new device
    security:
      - bearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              deviceId:
                type: string
                example: "esp32-soil-001"
              device_name:
                type: string
                example: "esp32-soil-001"
              status:
                type: string
                enum: ["online", "offline"]
                example: "offline"
              device_type:
                type: boolean
                example: true
              description:
                type: string
                example: "อุปกรณ์ทั่วไป"
    responses:
      200:
        description: Device created successfully
      400:
        description: Bad request
      401:
        description: Unauthorized
      409:
        description: Device ID already exists
      500:
        description: Internal server error
```

## Priority: URGENT ⚠️

**This API endpoint is required for the frontend device creation feature to work properly. Without this endpoint, users cannot create new devices and the feature will fail with 404 errors.**

**Please implement this endpoint as soon as possible to ensure the frontend functionality works correctly.**
