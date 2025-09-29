# Admin Delete User Error Fix - 500 Internal Server Error

## 🚨 **ปัญหา**
เมื่อพยายามลบ user "parkhyungseok" ในหน้า Admin เกิด error:
```
DELETE http://localhost:3000/api/users/parkhyungseok 500 (Internal Server Error)
```

## 🔍 **สาเหตุ**
Backend API endpoint `/api/users/{username}` สำหรับ DELETE operation ยังไม่ได้ implement หรือมีปัญหา

## ✅ **วิธีแก้ไข**

### **1. ตรวจสอบ Backend API Endpoints**

#### **A. ตรวจสอบว่า endpoint มีอยู่หรือไม่:**
```bash
# ตรวจสอบ GET users
curl -X GET http://localhost:3000/api/users

# ตรวจสอบ DELETE user
curl -X DELETE http://localhost:3000/api/users/parkhyungseok
```

#### **B. ตรวจสอบ Backend Logs:**
```bash
# ดู server logs เพื่อหาสาเหตุของ error 500
# ตรวจสอบ console หรือ log files
```

### **2. Backend Implementation ที่ต้องการ**

#### **A. DELETE /api/users/{username} Endpoint:**
```javascript
// Backend API endpoint ที่ต้องมี
app.delete('/api/users/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // ตรวจสอบ authentication
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const firebaseUid = decodedToken.uid;

    // ตรวจสอบว่า user เป็น admin
    const adminUser = await db.query(
      'SELECT role FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );

    if (!adminUser.rows[0] || adminUser.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // ลบ user จาก database
    const result = await db.query(
      'DELETE FROM users WHERE username = $1',
      [username]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

#### **B. Database Schema ที่ต้องการ:**
```sql
-- ตรวจสอบว่า users table มีอยู่
SELECT * FROM users WHERE username = 'parkhyungseok';

-- ตรวจสอบ foreign key constraints
-- อาจมี devices หรือ tables อื่นที่ reference ไปยัง user นี้
```

### **3. Frontend Error Handling**

#### **A. ปรับปรุง Error Handling:**
```typescript
async deleteUser(username: string) {
  this.notificationService.showNotification('warning', 'ยืนยันการลบ', `ต้องการลบผู้ใช้ ${username} จริงหรือไม่?`, true, 'ลบ', async () => {
    try {
      const token = await this.currentUser.getIdToken();
      const response = await lastValueFrom(
        this.http.delete(`${this.apiUrl}/api/users/${username}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );

      this.notificationService.showNotification('success', 'ลบสำเร็จ', 'ผู้ใช้ถูกลบเรียบร้อยแล้ว');
      await this.loadAllUsersOnce();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      
      // แสดง error message ที่ชัดเจนขึ้น
      let errorMessage = 'ไม่สามารถลบผู้ใช้ได้';
      
      if (error.status === 404) {
        errorMessage = 'ไม่พบผู้ใช้ที่ต้องการลบ';
      } else if (error.status === 403) {
        errorMessage = 'ไม่มีสิทธิ์ในการลบผู้ใช้';
      } else if (error.status === 500) {
        errorMessage = 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง';
      }
      
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', errorMessage);
    }
  });
}
```

### **4. การตรวจสอบและแก้ไข**

#### **A. ตรวจสอบ Backend Server:**
1. **ตรวจสอบว่า server ทำงานอยู่:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **ตรวจสอบ API endpoints:**
   ```bash
   curl -X GET http://localhost:3000/api/users
   ```

3. **ตรวจสอบ logs:**
   - ดู console logs ของ backend server
   - ตรวจสอบ error messages

#### **B. ตรวจสอบ Database:**
1. **ตรวจสอบ user ที่ต้องการลบ:**
   ```sql
   SELECT * FROM users WHERE username = 'parkhyungseok';
   ```

2. **ตรวจสอบ foreign key constraints:**
   ```sql
   -- ตรวจสอบว่า user นี้มี devices หรือไม่
   SELECT * FROM devices WHERE userid = (SELECT userid FROM users WHERE username = 'parkhyungseok');
   ```

3. **ตรวจสอบ tables อื่นที่อาจ reference ไปยัง user:**
   ```sql
   -- ตรวจสอบ measurements, areas, etc.
   SELECT * FROM measurements WHERE userid = (SELECT userid FROM users WHERE username = 'parkhyungseok');
   ```

### **5. Temporary Workaround**

#### **A. ปิดการใช้งาน Delete Button ชั่วคราว:**
```html
<!-- ใน admain.component.html -->
<button class="btn btn-delete" 
        (click)="deleteUser(user.user_name || user.username)" 
        title="ลบผู้ใช้"
        disabled>
  <i class="fas fa-trash"></i>
  <span>ลบ (ปิดใช้งานชั่วคราว)</span>
</button>
```

#### **B. แสดง Warning Message:**
```typescript
async deleteUser(username: string) {
  this.notificationService.showNotification(
    'warning', 
    'ฟีเจอร์ปิดใช้งานชั่วคราว', 
    'การลบผู้ใช้ปิดใช้งานชั่วคราว เนื่องจาก backend API ยังไม่ได้ implement'
  );
}
```

### **6. การแก้ไขระยะยาว**

#### **A. Backend Development:**
1. **Implement DELETE /api/users/{username} endpoint**
2. **เพิ่ม proper error handling**
3. **เพิ่ม authentication และ authorization**
4. **จัดการ foreign key constraints**

#### **B. Frontend Enhancement:**
1. **ปรับปรุง error handling**
2. **เพิ่ม loading states**
3. **เพิ่ม confirmation dialogs**
4. **เพิ่ม success/error notifications**

## 🎯 **ขั้นตอนการแก้ไข**

### **1. Immediate (ตอนนี้):**
- ตรวจสอบ backend server logs
- ตรวจสอบ database schema
- ปิดการใช้งาน delete button ชั่วคราว

### **2. Short-term (1-2 วัน):**
- Implement backend DELETE endpoint
- เพิ่ม proper error handling
- ทดสอบ API endpoints

### **3. Long-term (1 สัปดาห์):**
- ปรับปรุง frontend error handling
- เพิ่ม comprehensive testing
- เพิ่ม logging และ monitoring

## 📚 **เอกสารที่เกี่ยวข้อง**
- `docs/backend-admin-endpoints.md` - Backend API requirements
- `docs/admin-component-bug-fix.md` - Frontend implementation
- `docs/backend-reset-password-endpoint.md` - Similar endpoint implementation

## 🎉 **สรุป**

**🚨 ปัญหา:** Backend API endpoint `/api/users/{username}` สำหรับ DELETE ยังไม่ได้ implement

**✅ วิธีแก้ไข:**
1. ตรวจสอบ backend server และ logs
2. Implement DELETE endpoint ใน backend
3. ปรับปรุง frontend error handling
4. ทดสอบ API endpoints

**🎯 Priority:** High - ต้องแก้ไขเพื่อให้ admin สามารถลบ user ได้
