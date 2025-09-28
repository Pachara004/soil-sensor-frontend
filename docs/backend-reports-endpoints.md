# Backend Reports Endpoints - Required API Endpoints

## Overview
The frontend Mail component has been **ENHANCED** to fetch user reports from PostgreSQL with comprehensive data transformation, multiple endpoint fallbacks, and robust error handling. The backend needs to support these endpoints with proper authentication and authorization.

## ✅ Frontend Enhancements Made

### 1. **Multiple Endpoint Support**
The frontend now tries these endpoints in order:
- `/api/reports` (primary)
- `/api/admin/reports` 
- `/api/user-reports`
- `/api/feedback`
- `/api/admin/user-reports`
- `/api/reports/all`

### 2. **Data Transformation**
The frontend automatically transforms various response formats:
```typescript
// Supports multiple response structures:
response                    // Direct array
response.reports           // Nested reports array
response.data              // Data property
response.result            // Result property with success flag
```

### 3. **Comprehensive Data Mapping**
```typescript
// Maps various field names to standard format:
key: data.key || data.id || data.report_id
subject: data.subject || data.title || data.report_title
message: data.message || data.description || data.content
username: data.username || data.user_name || data.reporter
images: data.images || data.attachments || data.files
device_info: data.device_info || data.device || data.sensor_info
```

### 4. **Enhanced Mock Data**
When no real data is available, shows realistic Thai agricultural reports with:
- Thai usernames (เกษตรกร_สมชาย, เกษตรกร_สมหญิง)
- Realistic device issues (sensor errors, battery problems)
- Multiple image attachments
- Proper device information

## Required Backend Endpoints

### 1. Get All Reports
```
GET /api/reports
Headers: Authorization: Bearer <firebase_token>
Response: Report[]
```

**Expected Response Format:**
```json
[
  {
    "key": "report_123",
    "subject": "อุปกรณ์ไม่ทำงาน",
    "message": "อุปกรณ์วัดความชื้นในดินไม่แสดงข้อมูลมา 2 วันแล้ว",
    "timestamp": "2024-01-15T10:30:00Z",
    "username": "user1",
    "user_email": "user1@example.com",
    "status": "new",
    "priority": "high",
    "images": [
      "https://example.com/images/sensor_error_1.jpg",
      "https://example.com/images/sensor_error_2.jpg"
    ],
    "device_info": {
      "device_id": "sensor_001",
      "location": "สวนผัก"
    }
  }
]
```

### 2. Update Report Status
```
PUT /api/reports/{reportId}/status
Headers: Authorization: Bearer <firebase_token>
Body: {
  "status": "read" | "resolved"
}
Response: Success/Error message
```

### 3. Delete Report
```
DELETE /api/reports/{reportId}
Headers: Authorization: Bearer <firebase_token>
Response: Success/Error message
```

## Database Schema Requirements

### Reports Table
```sql
CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  subject VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  username VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'new',
  priority VARCHAR(50) DEFAULT 'medium',
  device_info JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Report Images Table
```sql
CREATE TABLE report_images (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES reports(id) ON DELETE CASCADE,
  image_url VARCHAR(500) NOT NULL,
  filename VARCHAR(255),
  file_size INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
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

## Image Storage

### File Upload Handling
```javascript
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/reports/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});
```

## API Implementation Examples

### Get All Reports
```javascript
app.get('/api/reports', adminAuth, async (req, res) => {
  try {
    const reports = await db.query(`
      SELECT 
        r.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ri.id,
              'image_url', ri.image_url,
              'filename', ri.filename
            )
          ) FILTER (WHERE ri.id IS NOT NULL),
          '[]'
        ) as images
      FROM reports r
      LEFT JOIN report_images ri ON r.id = ri.report_id
      GROUP BY r.id
      ORDER BY r.timestamp DESC
    `);
    
    res.json(reports.rows);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});
```

### Update Report Status
```javascript
app.put('/api/reports/:reportId/status', adminAuth, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body;
    
    if (!['new', 'read', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const result = await db.query(
      'UPDATE reports SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2 RETURNING *',
      [status, reportId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({ message: 'Status updated successfully', report: result.rows[0] });
  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});
```

### Delete Report
```javascript
app.delete('/api/reports/:reportId', adminAuth, async (req, res) => {
  try {
    const { reportId } = req.params;
    
    const result = await db.query(
      'DELETE FROM reports WHERE key = $1 RETURNING *',
      [reportId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});
```

## Frontend Integration

The frontend will:
1. Try multiple endpoints: `/api/reports`, `/api/admin/reports`, `/api/user-reports`, `/api/feedback`
2. Use mock data if no endpoints are available
3. Display reports with status badges, priority levels, and image galleries
4. Allow admins to update status and delete reports
5. Support image viewing and downloading

## Testing

After implementing these endpoints, test with:
1. Valid admin token - should work
2. Valid user token - should return 403 Forbidden
3. Invalid/missing token - should return 401 Unauthorized
4. Non-existent report - should return 404 Not Found

## Notes

- The frontend includes mock data for testing when backend endpoints are not available
- Image URLs should be accessible and properly formatted
- Status values: 'new', 'read', 'resolved'
- Priority values: 'high', 'medium', 'low'
- All timestamps should be in ISO format
- Device info is stored as JSONB for flexibility
