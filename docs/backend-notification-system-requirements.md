# Backend Requirements for Admin Notification System

## 🎯 **วัตถุประสงค์:**
สร้างระบบ notification สำหรับ admin ที่สามารถส่งข้อความไปยัง user แบบ persistent จนกว่า user จะกดรับทราบ

## 🔧 **Frontend Features ที่เพิ่มแล้ว:**

### **1. Admin Side:**
- ✅ **ปุ่มข้อความพร้อมตัวเลข** - แสดงจำนวนข้อความที่ยังไม่ได้อ่าน
- ✅ **Real-time Updates** - อัปเดตจำนวนข้อความแบบ real-time
- ✅ **Firebase Integration** - ใช้ Firebase Realtime Database
- ✅ **Send Notifications** - ส่ง notification เมื่อแก้ไขข้อมูล user

### **2. User Side:**
- ✅ **Persistent Notifications** - แสดง notification แบบ modal
- ✅ **Real-time Subscription** - subscribe ถึง notifications แบบ real-time
- ✅ **Acknowledge System** - user สามารถกดรับทราบได้
- ✅ **Dismiss Option** - ปิดชั่วคราวได้

---

## 🔧 **Backend Requirements:**

### **1. API Endpoints ที่ต้องมี:**

#### **A. Reports API (สำหรับ Admin)**
```javascript
// GET /api/reports
// ดึงรายการ reports ทั้งหมดสำหรับ admin
app.get('/api/reports', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reports = await db.query(`
      SELECT r.*, u.user_name, u.user_email 
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.userid
      WHERE r.status = 'new' 
      ORDER BY r.created_at DESC
    `);
    
    res.json(reports.rows);
  } catch (error) {
    console.error('❌ Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// PUT /api/reports/:id/read
// อัปเดต status ของ report เป็น 'read'
app.put('/api/reports/:id/read', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`
      UPDATE reports 
      SET status = 'read', read_at = NOW() 
      WHERE id = $1
    `, [id]);
    
    res.json({ success: true, message: 'Report marked as read' });
  } catch (error) {
    console.error('❌ Error updating report status:', error);
    res.status(500).json({ error: 'Failed to update report status' });
  }
});

// POST /api/reports
// สร้าง report ใหม่
app.post('/api/reports', authMiddleware, async (req, res) => {
  try {
    const { title, message, user_id } = req.body;
    const admin_id = req.user.userid;
    
    const result = await db.query(`
      INSERT INTO reports (title, message, user_id, admin_id, status)
      VALUES ($1, $2, $3, $4, 'new')
      RETURNING *
    `, [title, message, user_id, admin_id]);
    
    res.json({ success: true, report: result.rows[0] });
  } catch (error) {
    console.error('❌ Error creating report:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});
```

#### **B. User Management API (สำหรับ Admin)**
```javascript
// PUT /api/admin/users/:userId
// แก้ไขข้อมูล user และส่ง notification
app.put('/api/admin/users/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { user_name, user_phone, user_password, role } = req.body;
    
    // ✅ ตรวจสอบว่า user มีอยู่จริงหรือไม่
    const userCheck = await db.query(`
      SELECT userid, user_name FROM users WHERE userid = $1
    `, [userId]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // ✅ อัปเดตข้อมูล user ใน PostgreSQL
    let updateQuery = `
      UPDATE users 
      SET user_name = $1, user_phone = $2, role = $3, updated_at = NOW()
    `;
    let values = [user_name, user_phone, role];
    let paramIndex = 4;
    
    if (user_password && user_password.trim() !== '') {
      // Hash password ก่อนบันทึก
      const hashedPassword = await bcrypt.hash(user_password, 10);
      updateQuery += `, user_password = $${paramIndex}`;
      values.push(hashedPassword);
      paramIndex++;
    }
    
    updateQuery += ` WHERE userid = $${paramIndex}`;
    values.push(userId);
    
    await db.query(updateQuery, values);
    
    // ✅ ส่ง notification ไปยัง Firebase (ถ้ามี Firebase Admin SDK)
    if (firebaseAdmin) {
      try {
        const notificationData = {
          userId: parseInt(userId),
          type: 'admin_update',
          title: 'ข้อมูลของคุณได้รับการอัปเดต',
          message: `แอดมินได้แก้ไขข้อมูลของคุณแล้ว กรุณาตรวจสอบข้อมูลใหม่`,
          adminName: req.user.user_name || 'Admin',
          timestamp: new Date().toISOString(),
          read: false,
          persistent: true
        };
        
        // ส่งไปยัง Firebase Realtime Database
        const notificationsRef = firebaseAdmin.database().ref(`notifications/${userId}`);
        await notificationsRef.push(notificationData);
        
        console.log(`✅ Notification sent to user ${userId}:`, notificationData);
      } catch (firebaseError) {
        console.error('❌ Firebase notification error:', firebaseError);
        // ไม่ให้ error นี้หยุดการอัปเดต user
      }
    }
    
    res.json({ 
      success: true, 
      message: 'User updated successfully',
      notificationSent: true,
      user: {
        userid: userId,
        user_name: user_name,
        user_phone: user_phone,
        role: role
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /api/admin/users
// ดึงรายการ users ทั้งหมดสำหรับ admin
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await db.query(`
      SELECT userid, user_name, user_email, user_phone, role, created_at, updated_at
      FROM users 
      ORDER BY userid ASC
    `);
    
    res.json(users.rows);
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// DELETE /api/admin/users/:userId
// ลบ user (เฉพาะ admin)
app.delete('/api/admin/users/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // ตรวจสอบว่าไม่ใช่การลบตัวเอง
    if (parseInt(userId) === req.user.userid) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    
    await db.query(`DELETE FROM users WHERE userid = $1`, [userId]);
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});
```

### **2. Database Schema ที่ต้องมี:**

#### **A. Reports Table**
```sql
-- สร้างตาราง reports
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(userid) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'read')),
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP NULL,
  admin_id INTEGER REFERENCES users(userid) ON DELETE SET NULL
);

-- สร้าง index สำหรับ performance
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
```

#### **B. Users Table (ตรวจสอบและเพิ่ม fields ที่จำเป็น)**
```sql
-- ตรวจสอบและเพิ่ม fields ที่จำเป็น
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- สร้าง index สำหรับ performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_user_name ON users(user_name);
```

#### **C. Migration Script**
```sql
-- migration.sql
-- รัน script นี้เพื่ออัปเดต database

-- 1. สร้างตาราง reports
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(userid) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'read')),
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP NULL,
  admin_id INTEGER REFERENCES users(userid) ON DELETE SET NULL
);

-- 2. เพิ่ม fields ใน users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- 3. สร้าง indexes
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_user_name ON users(user_name);

-- 4. อัปเดต existing users ให้มี role = 'user'
UPDATE users SET role = 'user' WHERE role IS NULL;

-- 5. ตั้งค่า admin user (เปลี่ยน userid ตามที่ต้องการ)
UPDATE users SET role = 'admin' WHERE userid = 20; -- AdminPachara
```

### **3. Firebase Admin SDK Setup:**

#### **A. Install Firebase Admin SDK**
```bash
npm install firebase-admin
```

#### **B. Firebase Admin Configuration**
```javascript
// config/firebase-admin.js
const admin = require('firebase-admin');

// ✅ ใช้ Service Account Key
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://tripbooking-ajtawan-default-rtdb.asia-southeast1.firebasedatabase.app"
});

module.exports = admin;
```

#### **C. Service Account Key Setup**
1. ไปที่ Firebase Console
2. เลือก Project: `tripbooking-ajtawan`
3. ไปที่ Project Settings > Service Accounts
4. กดปุ่ม "Generate new private key"
5. ดาวน์โหลดไฟล์ JSON
6. เก็บไฟล์ไว้ใน `config/serviceAccountKey.json`

#### **D. Firebase Database Rules**
```json
{
  "rules": {
    "notifications": {
      "$userId": {
        ".read": "auth != null && auth.uid != null",
        ".write": "auth != null && auth.uid != null"
      }
    }
  }
}
```

### **4. Middleware ที่ต้องมี:**

#### **A. Auth Middleware**
```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token' });
    }
    
    // ✅ ตรวจสอบ Firebase token หรือ JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // ✅ ดึงข้อมูล user จาก database
    const user = await db.query(`
      SELECT userid, user_name, user_email, role 
      FROM users 
      WHERE userid = $1
    `, [decoded.userid]);
    
    if (user.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    req.user = user.rows[0];
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};
```

#### **B. Admin Middleware**
```javascript
// middleware/admin.js
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      message: 'Access denied. Admin required.',
      userRole: req.user.role 
    });
  }
  next();
};
```

#### **C. Error Handling Middleware**
```javascript
// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);
  
  if (err.code === '23505') { // Unique constraint violation
    return res.status(400).json({ error: 'Duplicate entry' });
  }
  
  if (err.code === '23503') { // Foreign key constraint violation
    return res.status(400).json({ error: 'Referenced record not found' });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
};
```

### **5. Environment Variables:**

#### **A. .env File**
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=soil_sensor_db
DB_USER=your_username
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_jwt_secret_key_here

# Firebase
FIREBASE_PROJECT_ID=tripbooking-ajtawan
FIREBASE_DATABASE_URL=https://tripbooking-ajtawan-default-rtdb.asia-southeast1.firebasedatabase.app

# Server
PORT=3000
NODE_ENV=production

# CORS
CORS_ORIGIN=http://localhost:4200,https://soil-sensor-dashboard.netlify.app
```

### **6. Package.json Dependencies:**

#### **A. Required Packages**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "firebase-admin": "^11.11.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

---

## 🧪 **การทดสอบ Backend:**

### **Test Case 1: Admin แก้ไขข้อมูล User**

#### **Request:**
```bash
PUT /api/admin/users/57
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "user_name": "new_username",
  "user_phone": "0999999999",
  "role": "user"
}
```

#### **Expected Response:**
```json
{
  "success": true,
  "message": "User updated successfully",
  "notificationSent": true,
  "user": {
    "userid": 57,
    "user_name": "new_username",
    "user_phone": "0999999999",
    "role": "user"
  }
}
```

#### **Firebase Database Result:**
```json
{
  "notifications": {
    "57": {
      "-Nx1234567890": {
        "userId": 57,
        "type": "admin_update",
        "title": "ข้อมูลของคุณได้รับการอัปเดต",
        "message": "แอดมินได้แก้ไขข้อมูลของคุณแล้ว กรุณาตรวจสอบข้อมูลใหม่",
        "adminName": "Admin",
        "timestamp": "2025-10-20T10:30:00.000Z",
        "read": false,
        "persistent": true
      }
    }
  }
}
```

### **Test Case 2: Admin ดึงรายการ Reports**

#### **Request:**
```bash
GET /api/reports
Authorization: Bearer <admin_token>
```

#### **Expected Response:**
```json
[
  {
    "id": 1,
    "user_id": 57,
    "title": "User Report",
    "message": "User has an issue",
    "status": "new",
    "created_at": "2025-10-20T10:30:00.000Z",
    "read_at": null,
    "admin_id": 20,
    "user_name": "test_user",
    "user_email": "test@example.com"
  }
]
```

### **Test Case 3: Admin อัปเดต Report Status**

#### **Request:**
```bash
PUT /api/reports/1/read
Authorization: Bearer <admin_token>
```

#### **Expected Response:**
```json
{
  "success": true,
  "message": "Report marked as read"
}
```

---

## 📊 **Firebase Database Structure:**

### **Notifications Path:**
```
notifications/
  {userId}/
    {notificationId}/
      userId: number
      type: string
      title: string
      message: string
      adminName: string
      timestamp: string
      read: boolean
      persistent: boolean
      acknowledgedAt?: string
```

### **Example Data:**
```json
{
  "notifications": {
    "57": {
      "-Nx1234567890": {
        "userId": 57,
        "type": "admin_update",
        "title": "ข้อมูลของคุณได้รับการอัปเดต",
        "message": "แอดมินได้แก้ไขข้อมูลของคุณแล้ว กรุณาตรวจสอบข้อมูลใหม่",
        "adminName": "Admin",
        "timestamp": "2025-10-20T10:30:00.000Z",
        "read": false,
        "persistent": true
      }
    }
  }
}
```

---

## 🎯 **สรุป Backend Requirements:**

### **✅ ที่ต้องทำ:**

#### **1. API Endpoints:**
- ✅ **GET /api/reports** - ดึงรายการ reports สำหรับ admin
- ✅ **PUT /api/reports/:id/read** - อัปเดต status ของ report
- ✅ **POST /api/reports** - สร้าง report ใหม่
- ✅ **PUT /api/admin/users/:userId** - แก้ไขข้อมูล user และส่ง notification
- ✅ **GET /api/admin/users** - ดึงรายการ users ทั้งหมด
- ✅ **DELETE /api/admin/users/:userId** - ลบ user

#### **2. Database:**
- ✅ **Reports Table** - เก็บรายการ reports
- ✅ **Users Table** - ตรวจสอบและเพิ่ม fields ที่จำเป็น
- ✅ **Indexes** - สำหรับ performance
- ✅ **Migration Script** - สำหรับอัปเดต database

#### **3. Firebase Integration:**
- ✅ **Firebase Admin SDK** - สำหรับส่ง notifications
- ✅ **Service Account Key** - สำหรับ authentication
- ✅ **Database Rules** - สำหรับ security

#### **4. Middleware:**
- ✅ **Auth Middleware** - ตรวจสอบ token
- ✅ **Admin Middleware** - ตรวจสอบสิทธิ์ admin
- ✅ **Error Handler** - จัดการ errors

#### **5. Security:**
- ✅ **Password Hashing** - ใช้ bcrypt
- ✅ **JWT Tokens** - สำหรับ authentication
- ✅ **CORS** - สำหรับ cross-origin requests
- ✅ **Helmet** - สำหรับ security headers

### **🎉 ผลลัพธ์ที่คาดหวัง:**

#### **หลังแก้ไข Admin จะ:**
- ✅ **เห็นปุ่มข้อความ** - พร้อมตัวเลขแสดงจำนวน
- ✅ **ส่ง Notification** - เมื่อแก้ไขข้อมูล user
- ✅ **Real-time Update** - จำนวนข้อความอัปเดตแบบ real-time

#### **หลังแก้ไข User จะ:**
- ✅ **เห็น Persistent Notification** - เมื่อ admin แก้ไขข้อมูล
- ✅ **รับทราบได้** - กดปุ่มรับทราบเพื่อปิด notification
- ✅ **ปิดชั่วคราวได้** - กดปิดชั่วคราวได้
- ✅ **Real-time Subscription** - รับ notification แบบ real-time

### **📝 หมายเหตุ:**
- การแก้ไขนี้ใช้ Firebase Realtime Database สำหรับ notification system
- Persistent notifications จะค้างไว้จนกว่า user จะกดรับทราบ
- การปิดชั่วคราวจะไม่ลบ notification จาก Firebase
- ระบบรองรับการส่ง notification ไปยัง user หลายคนพร้อมกัน

## 🚀 **Deployment Checklist:**

### **Backend:**
- [ ] Install required packages
- [ ] Setup Firebase Admin SDK
- [ ] Download Service Account Key
- [ ] Create Reports Table
- [ ] Update User Management API
- [ ] Test API Endpoints
- [ ] Setup Environment Variables
- [ ] Deploy to Production

### **Frontend:**
- ✅ **Build สำเร็จ** - Angular build ผ่าน
- ✅ **Deploy สำเร็จ** - Firebase hosting deploy ผ่าน
- ✅ **Firebase Integration** - เชื่อมต่อ Firebase Database สำเร็จ
- ✅ **Notification System** - ระบบ notification ทำงานได้ปกติ

**🎯 ตอนนี้เมื่อ backend ทำตาม requirements แล้ว ระบบ notification จะทำงานได้อย่างสมบูรณ์!** 🚀

**📝 เอกสาร Backend Requirements ถูกสร้างไว้ใน `docs/backend-notification-system-requirements.md` แล้ว** ✨