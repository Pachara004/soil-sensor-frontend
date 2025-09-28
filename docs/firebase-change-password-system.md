# Firebase Change Password System

## 🎯 ระบบเปลี่ยนรหัสผ่านด้วย Firebase Auth

ระบบเปลี่ยนรหัสผ่านที่สมบูรณ์สำหรับ Firebase Authentication พร้อมความปลอดภัยและ UX ที่ดี

## 🔧 ฟีเจอร์ที่รองรับ

### ✅ **ความปลอดภัยสูง:**
- **Re-authentication** - ต้องกรอกรหัสผ่านปัจจุบันก่อนเปลี่ยน
- **Password Strength Check** - ตรวจสอบความแข็งแรงของรหัสผ่าน
- **Real-time Validation** - ตรวจสอบความถูกต้องแบบเรียลไทม์
- **Error Handling** - จัดการข้อผิดพลาดอย่างละเอียด

### ✅ **User Experience:**
- **Password Visibility Toggle** - แสดง/ซ่อนรหัสผ่าน
- **Strength Indicator** - แสดงระดับความแข็งแรงของรหัสผ่าน
- **Loading States** - แสดงสถานะการโหลด
- **Responsive Design** - รองรับทุกขนาดหน้าจอ

## 📁 ไฟล์ที่สร้าง/แก้ไข

### 1. **Change Password Component**
```
src/app/components/users/change-password/
├── change-password.component.ts
├── change-password.component.html
└── change-password.component.scss
```

### 2. **Route Configuration**
```typescript
// src/app/app.routes.ts
{
  path: 'change-password',
  loadComponent: () =>
    import('./components/users/change-password/change-password.component').then(
      (m) => m.ChangePasswordComponent
    ),
}
```

### 3. **Profile Integration**
```typescript
// src/app/components/users/profile/profile.component.ts
goToChangePassword() {
  this.router.navigate(['/change-password']);
}
```

### 4. **AuthService Enhancement**
```typescript
// src/app/service/auth.service.ts
async changePasswordWithFirebase(currentPassword: string, newPassword: string): Promise<void> {
  const user = this.auth.currentUser;
  if (!user) {
    throw new Error('No user logged in');
  }

  try {
    // Re-authenticate user with current password
    const credential = EmailAuthProvider.credential(user.email!, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // Update password
    await updatePassword(user, newPassword);
  } catch (error: any) {
    console.error('Error changing password:', error);
    throw error;
  }
}
```

## 🔄 การทำงานของระบบ

### **Flow การเปลี่ยนรหัสผ่าน:**

1. **เข้าสู่หน้า Change Password** → จาก Profile page
2. **กรอกรหัสผ่านปัจจุบัน** → ต้องถูกต้อง
3. **กรอกรหัสผ่านใหม่** → ตรวจสอบความแข็งแรง
4. **ยืนยันรหัสผ่านใหม่** → ต้องตรงกัน
5. **Re-authenticate** → Firebase ตรวจสอบรหัสผ่านปัจจุบัน
6. **Update Password** → Firebase อัปเดตรหัสผ่านใหม่
7. **Success Notification** → แจ้งผลสำเร็จและกลับไป Profile

### **Password Strength Criteria:**

| Criteria | Points | Description |
|----------|--------|-------------|
| **Length ≥ 8** | 1 | อย่างน้อย 8 ตัวอักษร |
| **Lowercase** | 1 | มีตัวอักษรพิมพ์เล็ก |
| **Uppercase** | 1 | มีตัวอักษรพิมพ์ใหญ่ |
| **Numbers** | 1 | มีตัวเลข |
| **Special Chars** | 1 | มีอักขระพิเศษ |

### **Strength Levels:**
- **Weak** (0-39%): สีแดง
- **Medium** (40-69%): สีเหลือง
- **Strong** (70-100%): สีเขียว

## 🎨 UI/UX Features

### **Password Visibility Toggle:**
```html
<i class="password-toggle fas" 
   [class.fa-eye]="!showPassword" 
   [class.fa-eye-slash]="showPassword"
   (click)="togglePassword()">
</i>
```

### **Strength Indicator:**
```html
<div class="password-strength" *ngIf="newPassword">
  <div class="strength-bar">
    <div class="strength-fill" 
         [style.width.%]="passwordStrength.width" 
         [class]="passwordStrength.class">
    </div>
  </div>
  <span class="strength-text" [class]="passwordStrength.class">
    {{ passwordStrength.text }}
  </span>
</div>
```

### **Real-time Validation:**
```typescript
checkPasswordStrength() {
  // ตรวจสอบความแข็งแรงแบบเรียลไทม์
  // อัปเดต UI ทันที
}

canChangePassword(): boolean {
  return (
    this.currentPassword.trim() !== '' &&
    this.newPassword.trim() !== '' &&
    this.confirmPassword.trim() !== '' &&
    this.newPassword === this.confirmPassword &&
    this.passwordStrength.width >= 40 && // อย่างน้อย medium
    !this.passwordMismatch
  );
}
```

## 🛡️ Security Features

### **Firebase Re-authentication:**
```typescript
// ต้องกรอกรหัสผ่านปัจจุบันก่อนเปลี่ยน
const credential = EmailAuthProvider.credential(user.email!, currentPassword);
await reauthenticateWithCredential(user, credential);
```

### **Error Handling:**
```typescript
catch (error: any) {
  let errorMessage = 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน';
  
  if (error.code === 'auth/wrong-password') {
    errorMessage = 'รหัสผ่านปัจจุบันไม่ถูกต้อง';
  } else if (error.code === 'auth/weak-password') {
    errorMessage = 'รหัสผ่านใหม่ไม่แข็งแรงพอ';
  } else if (error.code === 'auth/requires-recent-login') {
    errorMessage = 'กรุณาเข้าสู่ระบบใหม่ก่อนเปลี่ยนรหัสผ่าน';
  } else if (error.code === 'auth/too-many-requests') {
    errorMessage = 'มีการพยายามเปลี่ยนรหัสผ่านบ่อยเกินไป กรุณารอสักครู่';
  }

  this.notificationService.showNotification('error', 'ไม่สามารถเปลี่ยนรหัสผ่านได้', errorMessage);
}
```

## 📱 Responsive Design

### **Desktop (≥ 768px):**
- Card width: 500px
- Padding: 32px
- Font size: 16px

### **Tablet (≤ 768px):**
- Card width: 100%
- Padding: 24px
- Font size: 14px

### **Mobile (≤ 480px):**
- Card width: 100%
- Padding: 16px
- Font size: 12px

## 🎯 การใช้งาน

### **1. เข้าสู่หน้า Change Password:**
```
Profile Page → "เปลี่ยนรหัสผ่าน" Button → Change Password Page
```

### **2. กรอกข้อมูล:**
- รหัสผ่านปัจจุบัน
- รหัสผ่านใหม่ (ต้องผ่านเกณฑ์ความแข็งแรง)
- ยืนยันรหัสผ่านใหม่ (ต้องตรงกัน)

### **3. เปลี่ยนรหัสผ่าน:**
- กดปุ่ม "เปลี่ยนรหัสผ่าน"
- ระบบจะ re-authenticate
- อัปเดตรหัสผ่านใน Firebase
- แสดงผลสำเร็จ

## 🔗 Integration Points

### **Profile Page:**
```html
<button class="change-password-button" (click)="goToChangePassword()">
  เปลี่ยนรหัสผ่าน
</button>
```

### **AuthService:**
```typescript
// ใช้ใน ChangePasswordComponent
await this.authService.changePasswordWithFirebase(currentPassword, newPassword);
```

### **Firebase Auth:**
```typescript
// ใช้ Firebase Auth methods
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from '@angular/fire/auth';
```

## 🎉 ผลลัพธ์

**ระบบเปลี่ยนรหัสผ่านที่สมบูรณ์:**
- ✅ **ปลอดภัย** - Re-authentication + Strong password validation
- ✅ **ใช้งานง่าย** - Real-time feedback + Clear error messages
- ✅ **Responsive** - รองรับทุกขนาดหน้าจอ
- ✅ **Integrated** - เชื่อมต่อกับ Profile page และ Firebase Auth
- ✅ **Professional** - UI/UX ที่สวยงามและใช้งานง่าย

**พร้อมใช้งานแล้ว!** 🚀✨
