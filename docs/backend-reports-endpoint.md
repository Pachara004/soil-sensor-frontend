# Backend Reports API Endpoint

## 🚨 ปัญหา: 404 Not Found

Frontend กำลังเรียก `POST http://localhost:3000/api/reports` แต่ backend ยังไม่มี endpoint นี้

## 📋 ข้อมูลที่ Frontend ส่งมา

### Request Body:
```json
{
  "subject": "หัวข้อปัญหา",
  "message": "รายละเอียดปัญหา",
  "timestamp": "2024-01-26T10:30:00.000Z",
  "images": [
    "https://firebasestorage.googleapis.com/...",
    "https://firebasestorage.googleapis.com/..."
  ],
  "userId": "firebase_uid_here",
  "userEmail": "user@example.com"
}
```

### Headers:
```
Content-Type: application/json
Authorization: Bearer <firebase_id_token>
```

## 🔧 Backend Endpoint ที่ต้องสร้าง

### 1. POST `/api/reports` - สร้างรายงานใหม่

```javascript
// routes/reports.js หรือ app.js
app.post('/api/reports', async (req, res) => {
  try {
    const { subject, message, timestamp, images, userId, userEmail } = req.body;
    
    // ตรวจสอบ Firebase token (ถ้าใช้)
    // const token = req.headers.authorization?.replace('Bearer ', '');
    // const decodedToken = await admin.auth().verifyIdToken(token);
    
    // บันทึกลงฐานข้อมูล
    const reportData = {
      subject,
      message,
      timestamp: new Date(timestamp),
      images: images || [],
      userId,
      userEmail,
      status: 'pending', // pending, in_progress, resolved
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // บันทึกลง PostgreSQL หรือ MongoDB
    const result = await db.query(
      'INSERT INTO reports (subject, message, timestamp, images, user_id, user_email, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [subject, message, reportData.timestamp, JSON.stringify(images), userId, userEmail, 'pending', reportData.createdAt, reportData.updatedAt]
    );
    
    res.status(201).json({
      success: true,
      message: 'Report created successfully',
      report: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create report',
      error: error.message
    });
  }
});
```

### 2. GET `/api/reports` - ดึงรายการรายงาน (สำหรับ Admin)

```javascript
app.get('/api/reports', async (req, res) => {
  try {
    // ตรวจสอบ admin permissions
    // const token = req.headers.authorization?.replace('Bearer ', '');
    // const decodedToken = await admin.auth().verifyIdToken(token);
    
    const result = await db.query(
      'SELECT * FROM reports ORDER BY created_at DESC'
    );
    
    res.json({
      success: true,
      reports: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: error.message
    });
  }
});
```

### 3. PUT `/api/reports/:id` - อัปเดตสถานะรายงาน

```javascript
app.put('/api/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminResponse } = req.body;
    
    const result = await db.query(
      'UPDATE reports SET status = $1, admin_response = $2, updated_at = $3 WHERE id = $4 RETURNING *',
      [status, adminResponse, new Date(), id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Report updated successfully',
      report: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update report',
      error: error.message
    });
  }
});
```

## 🗃️ Database Schema

### PostgreSQL Table:
```sql
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    images JSONB DEFAULT '[]',
    user_id VARCHAR(255),
    user_email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    admin_response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at);
```

## 🔐 Authentication (ถ้าใช้ Firebase)

```javascript
// middleware/auth.js
const admin = require('firebase-admin');

const verifyFirebaseToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ใช้ middleware
app.post('/api/reports', verifyFirebaseToken, async (req, res) => {
  // endpoint code here
});
```

## 📝 ตัวอย่างการใช้งาน

### Frontend (Angular):
```typescript
// reports.component.ts
async sendReport() {
  try {
    const reportData = {
      subject: this.subject,
      message: this.message,
      timestamp: new Date().toISOString(),
      images: imageUrls,
      userId: this.currentUser?.uid,
      userEmail: this.currentUser?.email
    };

    const response = await this.http
      .post(`${this.apiUrl}/api/reports`, reportData)
      .toPromise();

    console.log('Report sent successfully:', response);
  } catch (error) {
    console.error('Error sending report:', error);
  }
}
```

## 🎯 สรุป

**ต้องสร้างใน Backend:**
1. ✅ POST `/api/reports` - สร้างรายงาน
2. ✅ GET `/api/reports` - ดึงรายการรายงาน (Admin)
3. ✅ PUT `/api/reports/:id` - อัปเดตสถานะ
4. ✅ Database table `reports`
5. ✅ Authentication middleware (ถ้าใช้)

**Frontend พร้อมใช้งานแล้ว** - เพียงแค่ backend สร้าง endpoint ตามที่ระบุไว้
