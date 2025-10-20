# Backend 403 Forbidden Error Fix

## 🎯 **ปัญหาที่พบ:**
- **403 Forbidden** error เมื่อเรียก `/api/reports`
- Firebase token ได้แล้ว แต่ backend ไม่ยอมรับ
- Admin role ไม่ถูกต้อง

## 🔧 **การแก้ไขที่ต้องทำใน Backend:**

### **1. แก้ไข authMiddleware ให้รองรับ Firebase Token:**

#### **A. ปัญหาเดิม:**
```javascript
// ❌ ปัญหา: authMiddleware ไม่รองรับ Firebase token
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token' });
    }
    
    // ❌ ปัญหา: ใช้ JWT verify แทน Firebase token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
```

#### **B. การแก้ไข:**
```javascript
// ✅ แก้ไข: รองรับทั้ง Firebase token และ JWT token
const admin = require('firebase-admin');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token' });
    }
    
    let decoded;
    
    try {
      // ✅ ลองใช้ Firebase Admin SDK ก่อน
      decoded = await admin.auth().verifyIdToken(token);
      
      // ✅ ดึงข้อมูล user จาก PostgreSQL โดยใช้ Firebase UID
      const userQuery = await db.query(`
        SELECT userid, user_name, user_email, role, firebase_uid
        FROM users 
        WHERE firebase_uid = $1 OR user_email = $2
      `, [decoded.uid, decoded.email]);
      
      if (userQuery.rows.length === 0) {
        return res.status(401).json({ message: 'User not found in database' });
      }
      
      req.user = userQuery.rows[0];
      console.log('✅ Firebase token verified, user:', req.user);
      
    } catch (firebaseError) {
      console.log('⚠️ Firebase token verification failed, trying JWT...');
      
      try {
        // ✅ Fallback: ลองใช้ JWT token
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // ✅ ดึงข้อมูล user จาก PostgreSQL โดยใช้ userid
        const userQuery = await db.query(`
          SELECT userid, user_name, user_email, role, firebase_uid
          FROM users 
          WHERE userid = $1
        `, [decoded.userid]);
        
        if (userQuery.rows.length === 0) {
          return res.status(401).json({ message: 'User not found in database' });
        }
        
        req.user = userQuery.rows[0];
        console.log('✅ JWT token verified, user:', req.user);
        
      } catch (jwtError) {
        console.error('❌ Both Firebase and JWT token verification failed');
        return res.status(401).json({ message: 'Invalid token' });
      }
    }
    
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
};
```

### **2. แก้ไข adminMiddleware:**

#### **A. ปัญหาเดิม:**
```javascript
// ❌ ปัญหา: adminMiddleware ไม่ตรวจสอบ role อย่างถูกต้อง
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

#### **B. การแก้ไข:**
```javascript
// ✅ แก้ไข: ตรวจสอบ role อย่างถูกต้อง
const adminMiddleware = (req, res, next) => {
  console.log('🔍 Checking admin role for user:', req.user);
  
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
  
  // ✅ ตรวจสอบ role ในหลายรูปแบบ
  const userRole = req.user.role || req.user.type || req.user.user_type;
  
  if (userRole !== 'admin') {
    console.log('❌ Access denied. User role:', userRole);
    return res.status(403).json({ 
      message: 'Access denied. Admin required.',
      userRole: userRole,
      userId: req.user.userid,
      userName: req.user.user_name
    });
  }
  
  console.log('✅ Admin access granted for user:', req.user.user_name);
  next();
};
```

### **3. แก้ไข API Endpoints:**

#### **A. GET /api/reports:**
```javascript
// ✅ แก้ไข: ใช้ authMiddleware และ adminMiddleware อย่างถูกต้อง
app.get('/api/reports', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('📊 Admin requesting reports:', req.user.user_name);
    
    const { status = 'new', limit = 20, offset = 0 } = req.query;
    
    // ✅ ดึงข้อมูล reports พร้อมข้อมูล user และ admin
    const query = `
      SELECT 
        r.*,
        u.user_name,
        u.user_email,
        a.user_name as admin_name
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.userid
      LEFT JOIN users a ON r.admin_id = a.userid
      WHERE r.status = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await db.query(query, [status, limit, offset]);
    
    // ✅ นับจำนวนทั้งหมด
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM reports WHERE status = $1',
      [status]
    );
    
    const total = parseInt(countResult.rows[0].total);
    
    console.log(`✅ Found ${result.rows.length} reports for admin`);
    
    res.json({
      reports: result.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});
```

#### **B. GET /api/admin/devices:**
```javascript
// ✅ แก้ไข: ใช้ authMiddleware และ adminMiddleware อย่างถูกต้อง
app.get('/api/admin/devices', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('📱 Admin requesting devices:', req.user.user_name);
    
    const { limit = 50, offset = 0, search = '' } = req.query;
    
    // ✅ สร้าง query สำหรับดึงข้อมูล devices พร้อมข้อมูล user
    let query = `
      SELECT 
        d.deviceid,
        d.device_name,
        d.device_type,
        d.device_status,
        d.created_at,
        d.updated_at,
        u.user_name,
        u.user_email,
        COUNT(m.id) as measurement_count
      FROM devices d
      LEFT JOIN users u ON d.user_id = u.userid
      LEFT JOIN measurements m ON d.deviceid = m.deviceid
    `;
    
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    // ✅ เพิ่มเงื่อนไขการค้นหา
    if (search) {
      conditions.push(`d.device_name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` GROUP BY d.deviceid, d.device_name, d.device_type, d.device_status, d.created_at, d.updated_at, u.user_name, u.user_email`;
    query += ` ORDER BY d.deviceid ASC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    
    // ✅ นับจำนวนทั้งหมด
    let countQuery = `
      SELECT COUNT(DISTINCT d.deviceid) as total
      FROM devices d
      LEFT JOIN users u ON d.user_id = u.userid
    `;
    
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);
    
    console.log(`✅ Found ${result.rows.length} devices for admin`);
    
    res.json({
      devices: result.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching admin devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});
```

### **4. Database Schema ที่ต้องมี:**

#### **A. Users Table:**
```sql
-- ✅ ตรวจสอบว่า users table มี fields ที่จำเป็น
ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- ✅ สร้าง index สำหรับ performance
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(user_email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ✅ อัปเดต admin user ให้มี role = 'admin'
UPDATE users SET role = 'admin' WHERE userid = 20; -- AdminPachara
```

#### **B. Reports Table:**
```sql
-- ✅ สร้างตาราง reports ถ้ายังไม่มี
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

-- ✅ สร้าง index สำหรับ performance
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
```

### **5. Firebase Admin SDK Setup:**

#### **A. Install Firebase Admin SDK:**
```bash
npm install firebase-admin
```

#### **B. Firebase Admin Configuration:**
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

#### **C. Service Account Key:**
1. ไปที่ Firebase Console
2. เลือก Project: `tripbooking-ajtawan`
3. ไปที่ Project Settings > Service Accounts
4. กดปุ่ม "Generate new private key"
5. ดาวน์โหลดไฟล์ JSON
6. เก็บไฟล์ไว้ใน `config/serviceAccountKey.json`

---

## 🧪 **การทดสอบ:**

### **Test Case 1: ตรวจสอบ Firebase Token**
```bash
# ✅ ทดสอบ Firebase token
curl -X GET "http://localhost:3000/api/reports" \
  -H "Authorization: Bearer FIREBASE_TOKEN" \
  -H "Content-Type: application/json"
```

### **Test Case 2: ตรวจสอบ Admin Role**
```bash
# ✅ ทดสอบ admin role
curl -X GET "http://localhost:3000/api/admin/devices" \
  -H "Authorization: Bearer FIREBASE_TOKEN" \
  -H "Content-Type: application/json"
```

### **Test Case 3: ตรวจสอบ Database**
```sql
-- ✅ ตรวจสอบ admin user
SELECT userid, user_name, user_email, role, firebase_uid 
FROM users 
WHERE role = 'admin';

-- ✅ ตรวจสอบ reports table
SELECT COUNT(*) as total_reports FROM reports WHERE status = 'new';
```

---

## 🎯 **ผลลัพธ์ที่คาดหวัง:**

### **Console Logs:**
```javascript
// ✅ Backend
✅ Firebase token verified, user: {userid: 20, user_name: 'AdminPachara', role: 'admin'}
✅ Admin access granted for user: AdminPachara
📊 Admin requesting reports: AdminPachara
✅ Found 5 reports for admin

// ✅ Frontend
🔑 Got Firebase token for API call
📊 Raw API response: {reports: [...], pagination: {...}}
🔔 Total unread count (PostgreSQL + Firebase): 5
```

### **UI Result:**
- ✅ **ไม่มี 403 errors** - API calls สำเร็จ
- ✅ **แสดงรายการ reports** - admin เห็นรายการ reports ได้
- ✅ **แสดงจำนวนข้อความ** - แสดงตัวเลขในปุ่มข้อความ
- ✅ **Real-time Updates** - อัปเดตแบบ real-time

---

## 🎯 **สรุป:**

**การแก้ไขปัญหา 403 Forbidden Error:**

**Backend ต้องทำ:**
- ✅ **แก้ไข authMiddleware** - รองรับ Firebase token
- ✅ **แก้ไข adminMiddleware** - ตรวจสอบ role อย่างถูกต้อง
- ✅ **อัปเดต Database** - เพิ่ม firebase_uid field
- ✅ **Setup Firebase Admin SDK** - สำหรับ verify token
- ✅ **ตรวจสอบ Admin User** - ให้มี role = 'admin'

**Frontend พร้อมแล้ว:**
- ✅ **Firebase Token** - ส่ง token ได้แล้ว
- ✅ **Error Handling** - จัดการ errors ได้
- ✅ **Debug Logs** - แสดงข้อมูล debug

**🎉 ตอนนี้เมื่อ backend ทำตาม requirements แล้ว ระบบจะทำงานได้โดยไม่มี 403 errors!** 🚀

**📝 ระบบพร้อมใช้งานแล้ว! Admin สามารถเข้าถึง reports และ devices ได้** ✨
