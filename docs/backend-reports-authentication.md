# Backend Reports Authentication Fix

## 🚨 ปัญหา: 401 Unauthorized

Frontend ส่ง Firebase ID token แล้ว แต่ backend ยังไม่สามารถ verify token ได้

## 🔧 การแก้ไข Frontend (เสร็จแล้ว)

### ✅ เพิ่ม Firebase ID Token:
```typescript
// reports.component.ts
async sendReport() {
  // ตรวจสอบ authentication
  if (!this.currentUser) {
    this.notificationService.showNotification('error', 'ไม่พบข้อมูลผู้ใช้', 'กรุณาเข้าสู่ระบบใหม่');
    return;
  }

  // ดึง Firebase ID token
  const token = await this.currentUser.getIdToken();
  
  if (!token) {
    throw new Error('ไม่สามารถรับ Firebase token ได้');
  }
  
  // ส่ง request พร้อม Authorization header
  await this.http
    .post(`${this.apiUrl}/api/reports`, reportData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    .toPromise();
}
```

## 🔧 การแก้ไข Backend (ต้องทำ)

### 1. เพิ่ม Firebase Admin SDK Middleware:

```javascript
// middleware/auth.js
const admin = require('firebase-admin');

// Initialize Firebase Admin (ถ้ายังไม่ได้ทำ)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "your-project-id",
      clientEmail: "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
    })
  });
}

const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Add user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name
    };
    
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
};

module.exports = { verifyFirebaseToken };
```

### 2. อัปเดต Reports Route:

```javascript
// api/report.js
const { verifyFirebaseToken } = require('../middleware/auth');

// POST /api/reports - สร้าง report ใหม่
router.post('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { subject, message, timestamp, images, userId, userEmail } = req.body;
    
    // ใช้ข้อมูลจาก token แทน request body
    const reportData = {
      subject,
      message,
      timestamp: new Date(timestamp),
      images: images || [],
      userId: req.user.uid, // ใช้จาก token
      userEmail: req.user.email, // ใช้จาก token
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // บันทึกลง PostgreSQL
    const result = await db.query(
      'INSERT INTO reports (title, description, type, priority, status, userid, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [reportData.subject, reportData.message, 'general', 'medium', 'open', reportData.userId, reportData.created_at, reportData.updated_at]
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

### 3. อัปเดต server.js:

```javascript
// server.js
const { verifyFirebaseToken } = require('./middleware/auth');

// Mount reports routes with authentication
app.use('/api/reports', verifyFirebaseToken, require('./api/report'));
```

## 🔑 Firebase Admin SDK Setup

### 1. ดาวน์โหลด Service Account Key:
1. ไปที่ Firebase Console
2. Project Settings > Service Accounts
3. Generate New Private Key
4. บันทึกไฟล์ JSON

### 2. ตั้งค่า Environment Variables:
```bash
# .env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
```

### 3. อัปเดต Firebase Admin Config:
```javascript
// config/firebase.js
const admin = require('firebase-admin');

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;
```

## 🧪 การทดสอบ

### 1. ตรวจสอบ Token ใน Frontend:
```typescript
// Debug logging จะแสดง:
console.log('🔑 Firebase Token:', token.substring(0, 20) + '...');
console.log('📊 Report Data:', reportData);
console.log('🌐 API URL:', `${this.apiUrl}/api/reports`);
```

### 2. ตรวจสอบ Backend Logs:
```bash
# ควรเห็น:
Token verification successful for user: user@example.com
Creating report for user: user@example.com
```

## 🎯 สรุป

**Frontend พร้อมแล้ว** - ส่ง Firebase ID token ไปยัง backend

**Backend ต้องทำ:**
1. ✅ เพิ่ม Firebase Admin SDK middleware
2. ✅ ใช้ `verifyFirebaseToken` ใน reports route
3. ✅ ตั้งค่า Firebase Admin credentials
4. ✅ อัปเดต database schema ให้ตรงกับ frontend

**หลังจากแก้ไข backend แล้ว หน้า Reports จะทำงานได้ปกติครับ!** 🎉
