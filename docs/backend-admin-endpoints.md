# Backend Admin Endpoints - Required API Endpoints

## Overview
The frontend AdminService has been updated to use standard API endpoints instead of admin-specific ones. However, the backend needs to support these endpoints with proper authentication and authorization.

## Required Backend Endpoints

### 1. Get All Devices
```
GET /api/devices
Headers: Authorization: Bearer <firebase_token>
Response: Device[]
```

**Expected Response Format:**
```json
[
  {
    "id": "device_123",
    "display_name": "Soil Sensor 1",
    "status": "active",
    "user_id": 1
  }
]
```

### 2. Add Device
```
POST /api/devices
Headers: Authorization: Bearer <firebase_token>
Body: {
  "deviceId": "device_123",
  "device_name": "Soil Sensor 1", 
  "user": "username"
}
Response: Success/Error message
```

### 3. Delete Device
```
DELETE /api/devices/{deviceName}
Headers: Authorization: Bearer <firebase_token>
Response: Success/Error message
```

### 4. Get All Users
```
GET /api/users
Headers: Authorization: Bearer <firebase_token>
Response: User[]
```

**Expected Response Format:**
```json
[
  {
    "id": 1,
    "username": "user1",
    "email": "user1@example.com",
    "name": "User One",
    "phone_number": "0123456789",
    "type": "user"
  }
]
```

### 5. Update User
```
PUT /api/users/{username}
Headers: Authorization: Bearer <firebase_token>
Body: {
  "name": "New Name",
  "email": "new@example.com",
  "phone_number": "0987654321"
}
Response: Success/Error message
```

### 6. Delete User
```
DELETE /api/users/{username}
Headers: Authorization: Bearer <firebase_token>
Response: Success/Error message
```

## Authentication & Authorization

### Firebase Token Validation
All endpoints should:
1. Validate the Firebase ID token from the `Authorization: Bearer <token>` header
2. Extract the user's Firebase UID from the token
3. Check if the user has admin role in PostgreSQL
4. Only allow admin users to access these endpoints

### Example Middleware (Node.js/Express)
```javascript
const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const firebaseUid = decodedToken.uid;

    // Check if user is admin in PostgreSQL
    const user = await db.query(
      'SELECT role FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );

    if (!user.rows[0] || user.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = { firebaseUid, role: 'admin' };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

## Database Schema Requirements

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  firebase_uid VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  phone_number VARCHAR(20),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Devices Table
```sql
CREATE TABLE devices (
  id VARCHAR(255) PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Implementation Priority

1. **High Priority**: `/api/devices` (GET, POST, DELETE) - Required for device management
2. **High Priority**: `/api/users` (GET, PUT, DELETE) - Required for user management
3. **Medium Priority**: Add proper error handling and validation
4. **Low Priority**: Add pagination for large datasets

## Testing

After implementing these endpoints, test with:
1. Valid admin token - should work
2. Valid user token - should return 403 Forbidden
3. Invalid/missing token - should return 401 Unauthorized
4. Non-existent resources - should return 404 Not Found

## Notes

- The frontend has been updated to use these standard endpoints
- All requests include Firebase ID tokens for authentication
- Admin role verification is required on the backend
- Error responses should be consistent and informative
