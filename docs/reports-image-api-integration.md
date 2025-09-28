# Reports Endpoint Integration with Image API

## 🎯 **เป้าหมาย**
แก้ไข reports endpoint ให้ใช้ Image API ที่เราสร้างใหม่เพื่อเก็บภาพจาก Firebase Storage

## 🔍 **ปัญหาปัจจุบัน**
- Reports endpoint เก็บ images เป็น JSON array ใน reports table
- ไม่ได้ใช้ Image API ที่เราสร้างใหม่
- ไม่สามารถจัดการภาพแยกต่างหากได้

## ✅ **การแก้ไขที่ต้องทำ**

### 1. **แก้ไข POST /api/reports**

#### **เดิม (เก็บ images ใน reports table):**
```javascript
// บันทึกลง PostgreSQL
const result = await db.query(
  'INSERT INTO reports (title, description, type, priority, status, userid, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
  [reportData.subject, reportData.message, 'general', 'medium', 'open', reportData.userId, reportData.created_at, reportData.updated_at]
);
```

#### **ใหม่ (ใช้ Image API):**
```javascript
// 1. สร้าง report ก่อน
const result = await db.query(
  'INSERT INTO reports (title, description, type, priority, status, userid, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
  [reportData.subject, reportData.message, 'general', 'medium', 'open', reportData.userId, reportData.created_at, reportData.updated_at]
);

const reportId = result.rows[0].reportid;

// 2. เพิ่มภาพใน Image API
if (images && images.length > 0) {
  for (const imageUrl of images) {
    await db.query(
      'INSERT INTO image (reportid, imageUrl, created_at, updated_at) VALUES ($1, $2, $3, $4)',
      [reportId, imageUrl, new Date(), new Date()]
    );
  }
}
```

### 2. **แก้ไข GET /api/reports**

#### **เดิม (ดึง images จาก reports table):**
```javascript
const result = await db.query(
  'SELECT * FROM reports ORDER BY created_at DESC'
);
```

#### **ใหม่ (ดึง images จาก Image API):**
```javascript
// 1. ดึง reports
const result = await db.query(
  'SELECT * FROM reports ORDER BY created_at DESC'
);

// 2. ดึง images สำหรับแต่ละ report
for (let report of result.rows) {
  const imageResult = await db.query(
    'SELECT * FROM image WHERE reportid = $1 ORDER BY created_at ASC',
    [report.reportid]
  );
  report.images = imageResult.rows.map(img => img.imageurl);
}
```

### 3. **แก้ไข GET /api/reports/:id**

#### **เดิม:**
```javascript
const result = await db.query(
  'SELECT * FROM reports WHERE reportid = $1',
  [id]
);
```

#### **ใหม่:**
```javascript
// 1. ดึง report
const result = await db.query(
  'SELECT * FROM reports WHERE reportid = $1',
  [id]
);

if (result.rows.length === 0) {
  return res.status(404).json({ message: 'Report not found' });
}

const report = result.rows[0];

// 2. ดึง images
const imageResult = await db.query(
  'SELECT * FROM image WHERE reportid = $1 ORDER BY created_at ASC',
  [id]
);

report.images = imageResult.rows.map(img => img.imageurl);
```

## 🔧 **การใช้งาน Image API**

### **1. เพิ่มภาพใน report:**
```javascript
// POST /api/images
{
  "reportid": 1,
  "imageUrl": "https://firebasestorage.googleapis.com/v0/b/project/o/images%2Fimage1.jpg"
}
```

### **2. ดูภาพใน report:**
```javascript
// GET /api/images/report/1
// Response: { "images": [...] }
```

### **3. ลบภาพ:**
```javascript
// DELETE /api/images/1
```

## 📊 **Database Schema**

### **Reports Table (เดิม):**
```sql
CREATE TABLE reports (
    reportid SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'general',
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'open',
    userid INTEGER REFERENCES users(userid),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### **Image Table (ใหม่):**
```sql
CREATE TABLE image (
    imageid SERIAL PRIMARY KEY,
    reportid INTEGER REFERENCES reports(reportid) ON DELETE CASCADE,
    imageUrl TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🎯 **ข้อดีของการแก้ไข**

1. **Separation of Concerns** - แยกการจัดการภาพออกจาก reports
2. **Better Performance** - ไม่ต้องโหลด images ทุกครั้งที่ดู reports
3. **Flexible Management** - จัดการภาพได้อิสระ
4. **Scalability** - รองรับการเพิ่มฟีเจอร์ภาพได้ง่าย
5. **Data Integrity** - ใช้ foreign key และ CASCADE DELETE

## 📝 **ตัวอย่างการใช้งาน**

### **Frontend (Angular):**
```typescript
// reports.component.ts
async sendReport() {
  try {
    // 1. สร้าง report
    const reportData = {
      subject: this.subject,
      message: this.message,
      images: imageUrls // Firebase Storage URLs
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

### **Backend Response:**
```json
{
  "message": "Report sent successfully",
  "report": {
    "reportid": 1,
    "title": "Test Report",
    "description": "Test message",
    "images": [
      "https://firebasestorage.googleapis.com/v0/b/project/o/images%2Fimage1.jpg",
      "https://firebasestorage.googleapis.com/v0/b/project/o/images%2Fimage2.jpg"
    ],
    "userid": 7,
    "created_at": "2025-09-28T02:50:11.820Z"
  }
}
```

## 🚀 **ขั้นตอนการแก้ไข**

1. **แก้ไข POST /api/reports** - ใช้ Image API
2. **แก้ไข GET /api/reports** - ดึง images จาก Image API
3. **แก้ไข GET /api/reports/:id** - ดึง images จาก Image API
4. **ทดสอบ endpoints** - ดูว่า images ถูกเก็บและดึงได้ถูกต้อง
5. **อัปเดต frontend** - ใช้ response format ใหม่

**ตอนนี้ระบบพร้อมแล้ว! Reports endpoint จะใช้ Image API เพื่อจัดการภาพจาก Firebase Storage** 📷✨
