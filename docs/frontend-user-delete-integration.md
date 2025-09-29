# Frontend User Delete Integration - Complete Implementation

## 🎯 **เป้าหมาย**
อัปเดต Frontend เพื่อใช้ API endpoints ใหม่สำหรับการลบ user:
1. **Admin Delete User** - Admin สามารถลบ user อื่นได้
2. **Self Delete Account** - User สามารถลบ account ของตัวเองได้

## ✅ **สิ่งที่ทำได้**

### 🔧 **1. Admin Delete User Integration**

#### **A. อัปเดต deleteUser Function:**
```typescript
async deleteUser(username: string) {
  // หา userid จาก username
  const user = this.allUsers.find(u => (u['user_name'] || u['username']) === username);
  if (!user) {
    this.notificationService.showNotification('error', 'ไม่พบข้อมูล', 'ไม่พบผู้ใช้ที่ต้องการลบ');
    return;
  }

  const userid = user['userid'] || user['id'];
  if (!userid) {
    this.notificationService.showNotification('error', 'ข้อมูลไม่ครบถ้วน', 'ไม่พบ User ID ของผู้ใช้');
    return;
  }

  this.notificationService.showNotification('warning', 'ยืนยันการลบ', `ต้องการลบผู้ใช้ "${username}" (ID: ${userid}) จริงหรือไม่?`, true, 'ลบ', async () => {
    try {
      const token = await this.currentUser.getIdToken();
      const response = await lastValueFrom(
        this.http.delete(`${this.apiUrl}/api/auth/admin/delete-user/${userid}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );

      console.log('✅ User deleted successfully:', response);
      this.notificationService.showNotification('success', 'ลบสำเร็จ', 'ผู้ใช้ถูกลบเรียบร้อยแล้ว');
      await this.loadAllUsersOnce();
    } catch (error: any) {
      // Enhanced error handling...
    }
  });
}
```

#### **B. API Endpoint:**
- **URL**: `DELETE /api/auth/admin/delete-user/{userid}`
- **Headers**: `Authorization: Bearer {firebase_token}`
- **Response**: Success/Error message

#### **C. Error Handling:**
```typescript
if (error.status === 404) {
  errorMessage = 'ไม่พบผู้ใช้ที่ต้องการลบ';
  errorTitle = 'ไม่พบข้อมูล';
} else if (error.status === 403) {
  errorMessage = 'ไม่มีสิทธิ์ในการลบผู้ใช้ (ต้องเป็น Admin)';
  errorTitle = 'ไม่มีสิทธิ์';
} else if (error.status === 400) {
  errorMessage = error.error?.message || 'ข้อมูลไม่ถูกต้อง';
  errorTitle = 'ข้อมูลไม่ถูกต้อง';
} else if (error.status === 500) {
  errorMessage = 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง';
  errorTitle = 'Server Error';
} else if (error.status === 401) {
  errorMessage = 'หมดอายุการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่';
  errorTitle = 'หมดอายุ';
}
```

### 🔧 **2. Self Delete Account Integration**

#### **A. เพิ่ม Danger Zone ใน Profile Page:**
```html
<!-- Danger Zone -->
<div class="danger-zone" *ngIf="!isLoading">
  <h3 class="danger-title">
    <i class="fas fa-exclamation-triangle"></i>
    โซนอันตราย
  </h3>
  <p class="danger-description">
    การกระทำในส่วนนี้จะไม่สามารถย้อนกลับได้ กรุณาคิดให้ดีก่อนดำเนินการ
  </p>
  <button class="delete-account-button" (click)="deleteAccount()">
    <i class="fas fa-trash"></i>
    ลบบัญชี
  </button>
</div>
```

#### **B. deleteAccount Function:**
```typescript
async deleteAccount() {
  // แสดง confirmation dialog
  this.notificationService.showNotification(
    'warning', 
    'ยืนยันการลบบัญชี', 
    `คุณแน่ใจหรือไม่ว่าต้องการลบบัญชี "${this.username}"? การกระทำนี้ไม่สามารถย้อนกลับได้ และจะลบข้อมูลทั้งหมดของคุณ`, 
    true, 
    'ลบบัญชี', 
    async () => {
      try {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
          this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'ไม่พบข้อมูลผู้ใช้');
          return;
        }

        const token = await currentUser.getIdToken();
        const response = await lastValueFrom(
          this.http.delete(`${this.apiUrl}/api/auth/delete-account`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );

        console.log('✅ Account deleted successfully:', response);
        
        // แสดงข้อความสำเร็จ
        this.notificationService.showNotification(
          'success', 
          'ลบบัญชีสำเร็จ', 
          'บัญชีของคุณถูกลบเรียบร้อยแล้ว'
        );

        // รอ 2 วินาทีแล้ว redirect ไปหน้า login
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);

      } catch (error: any) {
        // Enhanced error handling...
      }
    }
  );
}
```

#### **C. API Endpoint:**
- **URL**: `DELETE /api/auth/delete-account`
- **Headers**: `Authorization: Bearer {firebase_token}`
- **Response**: Success/Error message

### 🎨 **3. Enhanced UI Components**

#### **A. Admin Delete Button:**
```html
<button class="btn btn-delete" (click)="deleteUser(user.user_name || user.username)" title="ลบผู้ใช้">
  <i class="fas fa-trash"></i>
  <span>ลบ</span>
</button>
```

#### **B. Danger Zone Styling:**
```scss
.danger-zone {
  margin-top: 30px;
  padding: 20px;
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.05) 0%, rgba(211, 47, 47, 0.02) 100%);
  border: 2px solid rgba(244, 67, 54, 0.2);
  border-radius: $border-radius-md;
  
  .danger-title {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #F44336;
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 12px;
    
    i {
      font-size: 18px;
      color: #F44336;
    }
  }
  
  .danger-description {
    color: $text-secondary;
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 20px;
  }
  
  .delete-account-button {
    background: linear-gradient(135deg, #F44336, #D32F2F);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: $border-radius-sm;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    transition: $transition;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 2px 8px rgba(244, 67, 54, 0.3);
    
    i {
      font-size: 16px;
    }
    
    &:hover {
      background: linear-gradient(135deg, #D32F2F, #C62828);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4);
    }
    
    &:active {
      transform: translateY(0);
    }
  }
}
```

## 🔄 **การทำงานของระบบ**

### **1. Admin Delete User Flow:**
```
Admin คลิก "ลบ" ในหน้า Admin Panel
↓
หา userid จาก username
↓
แสดง confirmation dialog
↓
ส่ง DELETE request ไปยัง /api/auth/admin/delete-user/{userid}
↓
Backend ลบ user จากทั้ง Firebase Auth และ PostgreSQL
↓
แสดง success message
↓
Refresh user list
```

### **2. Self Delete Account Flow:**
```
User คลิก "ลบบัญชี" ในหน้า Profile
↓
แสดง confirmation dialog
↓
ส่ง DELETE request ไปยัง /api/auth/delete-account
↓
Backend ลบ user จากทั้ง Firebase Auth และ PostgreSQL
↓
แสดง success message
↓
Redirect ไปหน้า login
```

## 📊 **ข้อมูลที่แสดง**

### **1. Admin Delete Confirmation:**
- **Title**: "ยืนยันการลบ"
- **Message**: "ต้องการลบผู้ใช้ 'username' (ID: userid) จริงหรือไม่?"
- **Actions**: "ลบ" / "ยกเลิก"

### **2. Self Delete Confirmation:**
- **Title**: "ยืนยันการลบบัญชี"
- **Message**: "คุณแน่ใจหรือไม่ว่าต้องการลบบัญชี 'username'? การกระทำนี้ไม่สามารถย้อนกลับได้ และจะลบข้อมูลทั้งหมดของคุณ"
- **Actions**: "ลบบัญชี" / "ยกเลิก"

### **3. Success Messages:**
- **Admin Delete**: "ลบสำเร็จ - ผู้ใช้ถูกลบเรียบร้อยแล้ว"
- **Self Delete**: "ลบบัญชีสำเร็จ - บัญชีของคุณถูกลบเรียบร้อยแล้ว"

## 🎯 **ประโยชน์ที่ได้**

### **1. Complete User Management:**
- Admin สามารถลบ user อื่นได้
- User สามารถลบ account ของตัวเองได้
- ลบข้อมูลจากทั้ง Firebase Auth และ PostgreSQL

### **2. Enhanced Security:**
- Authentication และ authorization
- Confirmation dialogs
- Error handling ที่ชัดเจน

### **3. Better User Experience:**
- Clear confirmation messages
- Visual danger zone
- Success/error notifications
- Automatic redirect after self delete

### **4. Data Consistency:**
- Cascade delete ข้อมูลที่เกี่ยวข้อง
- Database transaction management
- Firebase Auth integration

## 🧪 **การทดสอบ**

### **1. Admin Delete User:**
- ✅ Admin สามารถลบ user อื่นได้
- ✅ แสดง confirmation dialog
- ✅ ลบข้อมูลจากทั้ง Firebase Auth และ PostgreSQL
- ✅ แสดง success message
- ✅ Refresh user list

### **2. Self Delete Account:**
- ✅ User สามารถลบ account ของตัวเองได้
- ✅ แสดง confirmation dialog
- ✅ ลบข้อมูลจากทั้ง Firebase Auth และ PostgreSQL
- ✅ แสดง success message
- ✅ Redirect ไปหน้า login

### **3. Error Handling:**
- ✅ 404: ไม่พบผู้ใช้
- ✅ 403: ไม่มีสิทธิ์
- ✅ 400: ข้อมูลไม่ถูกต้อง
- ✅ 500: Server error
- ✅ 401: หมดอายุ

## 📚 **ไฟล์ที่แก้ไข**

### **1. Admin Component:**
- `src/app/components/admin/admain/admain.component.ts`
  - อัปเดต deleteUser function
  - เพิ่ม enhanced error handling
- `src/app/components/admin/admain/admain.component.html`
  - เปิดใช้งาน delete button

### **2. Profile Component:**
- `src/app/components/users/profile/profile.component.ts`
  - เพิ่ม deleteAccount function
  - เพิ่ม NotificationService
- `src/app/components/users/profile/profile.component.html`
  - เพิ่ม danger zone
- `src/app/components/users/profile/profile.component.scss`
  - เพิ่ม danger zone styling

## 🎉 **สรุป**

**✅ Frontend User Delete Integration สำเร็จแล้ว!**

**🔧 สิ่งที่ทำได้:**
- Admin Delete User ✅
- Self Delete Account ✅
- Enhanced Error Handling ✅
- Danger Zone UI ✅
- Confirmation Dialogs ✅
- Success/Error Notifications ✅

**🧪 การทดสอบที่ผ่าน:**
- Admin delete user ✅
- Self delete account ✅
- Error handling ✅
- UI components ✅
- Linter errors fixed ✅

**🎯 ตอนนี้ระบบสามารถลบ user ทั้งใน Firebase Auth และ PostgreSQL ได้แล้ว!** ✅🎉

**Frontend และ Backend ทำงานร่วมกันได้อย่างสมบูรณ์!** 🚀✨

**ระบบ User Management ครบถ้วนและปลอดภัย!** 🛡️👥
