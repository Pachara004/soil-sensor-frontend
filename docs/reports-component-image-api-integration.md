# Reports Component Integration with Image API

## 🎯 **เป้าหมาย**
แก้ไข reports component ให้สร้าง reports และเก็บ URL Firebase ใน table image

## 🔍 **การแก้ไขที่ทำ**

### **1. แก้ไข sendReport() function:**

#### **เดิม (เก็บ images ใน reports table):**
```typescript
// ส่งข้อมูลไปยัง backend
const reportData = {
  subject: this.subject,
  message: this.message,
  timestamp: new Date().toISOString(),
  images: imageUrls, // เก็บ images ใน reports table
  userId: this.currentUser?.uid || null,
  userEmail: this.currentUser?.email || null
};

await this.http.post(`${this.apiUrl}/api/reports`, reportData, { headers });
```

#### **ใหม่ (ใช้ Image API):**
```typescript
// 1. สร้าง report ก่อน
const reportData = {
  subject: this.subject,
  message: this.message,
  timestamp: new Date().toISOString(),
  userId: this.currentUser?.uid || null,
  userEmail: this.currentUser?.email || null
};

const reportResponse = await this.http.post(`${this.apiUrl}/api/reports`, reportData, { headers });
const reportId = reportResponse.report?.reportid || reportResponse.reportid;

// 2. อัปโหลดรูปภาพไปยัง Firebase Storage
if (this.selectedImages.length > 0) {
  const imageUrls = await this.uploadImagesToFirebase();
  
  // 3. บันทึก URL ของภาพใน table image
  for (const imageUrl of imageUrls) {
    const imageData = {
      reportid: reportId,
      imageUrl: imageUrl
    };
    
    await this.http.post(`${this.apiUrl}/api/images`, imageData, { headers });
  }
}
```

## 🔄 **การทำงานของระบบ (ใหม่):**

### **1. สร้าง Report:**
```typescript
// สร้าง report ใน table reports
const reportResponse = await this.http.post('/api/reports', {
  subject: "ปัญหาอุปกรณ์",
  message: "อุปกรณ์ไม่ทำงาน",
  userId: "firebase_uid",
  userEmail: "user@example.com"
});

// ได้ reportId กลับมา
const reportId = reportResponse.report.reportid;
```

### **2. อัปโหลดภาพ:**
```typescript
// อัปโหลดภาพไปยัง Firebase Storage
const imageUrls = await this.uploadImagesToFirebase();
// ได้: ["https://firebasestorage.googleapis.com/...", "https://firebasestorage.googleapis.com/..."]
```

### **3. บันทึกภาพใน Database:**
```typescript
// บันทึก URL ของภาพใน table image
for (const imageUrl of imageUrls) {
  await this.http.post('/api/images', {
    reportid: reportId,
    imageUrl: imageUrl
  });
}
```

## 📊 **Database Schema:**

### **Reports Table:**
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

### **Image Table:**
```sql
CREATE TABLE image (
    imageid SERIAL PRIMARY KEY,
    reportid INTEGER REFERENCES reports(reportid) ON DELETE CASCADE,
    imageUrl TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🎯 **ข้อดีของการแก้ไข:**

1. **Separation of Concerns** - แยกการจัดการภาพออกจาก reports
2. **Better Performance** - ไม่ต้องโหลด images ทุกครั้งที่ดู reports
3. **Flexible Management** - จัดการภาพได้อิสระ
4. **Scalability** - รองรับการเพิ่มฟีเจอร์ภาพได้ง่าย
5. **Data Integrity** - ใช้ foreign key และ CASCADE DELETE

## 📝 **ตัวอย่างการใช้งาน:**

### **Frontend (Angular):**
```typescript
// reports.component.ts
async sendReport() {
  // 1. สร้าง report
  const reportResponse = await this.http.post('/api/reports', reportData);
  const reportId = reportResponse.report.reportid;

  // 2. อัปโหลดภาพ
  const imageUrls = await this.uploadImagesToFirebase();

  // 3. บันทึกภาพใน database
  for (const imageUrl of imageUrls) {
    await this.http.post('/api/images', {
      reportid: reportId,
      imageUrl: imageUrl
    });
  }
}
```

### **Backend Response:**
```json
{
  "message": "Report sent successfully",
  "report": {
    "reportid": 1,
    "title": "ปัญหาอุปกรณ์",
    "description": "อุปกรณ์ไม่ทำงาน",
    "userid": 7,
    "created_at": "2025-09-28T03:00:00.000Z"
  }
}
```

## 🔧 **Error Handling:**

### **1. Report Creation Error:**
```typescript
try {
  const reportResponse = await this.http.post('/api/reports', reportData);
} catch (error) {
  console.error('❌ Error creating report:', error);
  this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถสร้าง report ได้');
  return;
}
```

### **2. Image Upload Error:**
```typescript
try {
  const imageUrls = await this.uploadImagesToFirebase();
} catch (error) {
  console.error('❌ Error uploading images:', error);
  this.notificationService.showNotification('warning', 'อัปโหลดภาพไม่สำเร็จ', 'Report ถูกสร้างแล้ว แต่ภาพไม่ถูกอัปโหลด');
}
```

### **3. Image Database Error:**
```typescript
for (const imageUrl of imageUrls) {
  try {
    await this.http.post('/api/images', { reportid, imageUrl });
  } catch (imageError) {
    console.error('❌ Error saving image to database:', imageError);
    // ไม่ throw error เพื่อไม่ให้กระทบการสร้าง report
  }
}
```

## 🚀 **ขั้นตอนการทดสอบ:**

1. **สร้าง Report** - ดูว่า report ถูกสร้างใน table reports
2. **อัปโหลดภาพ** - ดูว่าภาพถูกอัปโหลดไปยัง Firebase Storage
3. **บันทึกภาพ** - ดูว่า URL ของภาพถูกบันทึกใน table image
4. **ตรวจสอบความสัมพันธ์** - ดูว่า reportid ใน table image ตรงกับ reportid ใน table reports

## 📚 **เอกสารที่เกี่ยวข้อง:**
- **`docs/reports-image-api-integration.md`** - คู่มือการแก้ไข reports endpoint
- **`docs/image-management-endpoints.md`** - คู่มือการใช้งาน Image API

**ตอนนี้ reports component ใช้ Image API เพื่อจัดการภาพจาก Firebase Storage แล้ว!** 📷✨
