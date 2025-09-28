# Forgot Password Debug Fix

## ปัญหา
- **Error**: `PUT http://localhost:3000/api/auth/reset-password 400 (Bad Request)`
- **สาเหตุ**: ไม่ทราบข้อมูลที่ Angular ส่งไปยัง Backend

## การแก้ไข

### 1. เพิ่ม Debug Logging ใน Frontend

#### **Send OTP Method:**
```typescript
async sendOtp() {
  // สร้าง OTP และ Reference Number
  this.generatedOtp = this.generateOtp();
  this.referenceNumber = this.generateReferenceNumber();
  
  // Debug logging
  console.log('🔍 Generated OTP:', this.generatedOtp);
  console.log('🔍 Generated Reference Number:', this.referenceNumber);
  console.log('🔍 Email:', this.email);
  console.log('🔍 Sending OTP data:', sendData);
  
  // ส่งไปยัง backend
  const response = await firstValueFrom(
    this.http.post(`${this.apiUrl}/api/auth/send-otp`, sendData)
  );
}
```

#### **Verify OTP Method:**
```typescript
async verifyOtp() {
  const enteredOtp = this.otp.join('');
  
  // Debug logging
  console.log('🔍 Sending OTP verification data:', verifyData);
  console.log('🔍 Generated OTP (should match):', this.generatedOtp);
  console.log('🔍 Entered OTP:', enteredOtp);
  console.log('🔍 Reference Number:', this.referenceNumber);
  
  // ส่งไปยัง backend
  const response = await firstValueFrom(
    this.http.post(`${this.apiUrl}/api/auth/verify-otp`, verifyData)
  );
}
```

#### **Reset Password Method:**
```typescript
async resetPassword() {
  // Debug logging
  const resetData = {
    email: this.email,
    newPassword: this.newPassword,
    otp: this.generatedOtp,
    referenceNumber: this.referenceNumber
  };
  
  console.log('🔍 Sending reset password data:', resetData);
  console.log('🔍 Generated OTP:', this.generatedOtp);
  console.log('🔍 Reference Number:', this.referenceNumber);
  console.log('🔍 Email:', this.email);
  
  // ส่งไปยัง backend
  const response = await firstValueFrom(
    this.http.put(`${this.apiUrl}/api/auth/reset-password`, resetData)
  );
}
```

### 2. ปรับปรุง Error Handling

#### **Error Messages ที่ชัดเจน:**
```typescript
catch (error: any) {
  console.error('Error details:', {
    status: error.status,
    statusText: error.statusText,
    message: error.message,
    url: error.url
  });
  
  // แสดง error message ที่ชัดเจนขึ้น
  let errorMessage = 'ไม่สามารถเปลี่ยนรหัสผ่านได้';
  if (error.status === 400) {
    errorMessage = 'OTP ไม่ถูกต้องหรือหมดอายุ กรุณาขอ OTP ใหม่';
  } else if (error.status === 404) {
    errorMessage = 'ไม่พบผู้ใช้ในระบบ';
  } else if (error.status === 500) {
    errorMessage = 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่';
  }
  
  this.notificationService.showNotification('error', 'ไม่สามารถเปลี่ยนรหัสผ่านได้', errorMessage);
}
```

## การทดสอบ

### 1. ทดสอบ Send OTP
```
1. ไปที่หน้า forgot password
2. กรอกอีเมล: test@example.com
3. กดส่ง OTP
4. ดู console log ใน browser
```

### 2. ทดสอบ Verify OTP
```
1. กรอก OTP ที่ได้รับ
2. กดยืนยัน OTP
3. ดู console log ใน browser
```

### 3. ทดสอบ Reset Password
```
1. กรอกรหัสผ่านใหม่
2. กด reset password
3. ดู console log ใน browser
```

## ข้อมูลที่ Console จะแสดง

### **Frontend Console (Browser):**
```
🔍 Generated OTP: 123456
🔍 Generated Reference Number: ABC12345
🔍 Email: test@example.com
🔍 Sending OTP data: {email: "test@example.com", otp: "123456", referenceNumber: "ABC12345", type: "password-reset"}
✅ OTP sent successfully: {message: "OTP sent", ref: "ABC12345"}

🔍 Sending OTP verification data: {email: "test@example.com", otp: "123456", referenceNumber: "ABC12345", type: "password-reset"}
🔍 Generated OTP (should match): 123456
🔍 Entered OTP: 123456
✅ OTP verification successful: {message: "OTP verified"}

🔍 Sending reset password data: {email: "test@example.com", newPassword: "newpassword123", otp: "123456", referenceNumber: "ABC12345"}
🔍 Generated OTP: 123456
🔍 Reference Number: ABC12345
🔍 Email: test@example.com
```

### **Backend Console (Terminal):**
```
Reset password request: {
  email: 'test@example.com',
  otp: '123456',
  newPassword: 'newpassword123',
  referenceNumber: 'ABC12345'
}
Current OTP store: {
  'test@example.com': {
    otp: '123456',
    referenceNumber: 'ABC12345',
    expiresAt: '2025-01-26T10:40:00.000Z',
    used: false
  }
}
```

## สาเหตุที่เป็นไปได้

### 1. OTP ไม่พบใน otpStore
- OTP หมดอายุ (10 นาที)
- OTP ถูกใช้ไปแล้ว
- Reference number ไม่ตรงกัน

### 2. ข้อมูลไม่ตรงกัน
- Email ไม่ตรงกับที่ส่ง OTP
- OTP ไม่ตรงกับที่สร้าง
- Reference number ไม่ตรงกัน

### 3. Backend Error
- Database connection error
- Email service error
- Password hashing error

## การแก้ไขเพิ่มเติม

### หากยังได้ 400 Bad Request:
1. **ตรวจสอบ Backend Logs** - ดู console log ใน backend terminal
2. **ตรวจสอบ OTP Store** - ดูว่า OTP ถูกเก็บไว้หรือไม่
3. **ตรวจสอบ Database** - ดูว่า user มีอยู่ในระบบหรือไม่
4. **ตรวจสอบ Email Service** - ดูว่า email service ทำงานหรือไม่

### หากได้ Error อื่น:
- **401 Unauthorized** - ตรวจสอบ authentication
- **404 Not Found** - ตรวจสอบ endpoint
- **500 Internal Server Error** - ตรวจสอบ server logs

## ผลลัพธ์ที่คาดหวัง

หลังจากเพิ่ม debug logging แล้ว จะสามารถ:
1. **เห็นข้อมูลที่ส่งไป** - ตรวจสอบว่า Angular ส่งข้อมูลถูกต้องหรือไม่
2. **เห็นข้อมูลใน Backend** - ตรวจสอบว่า Backend รับข้อมูลถูกต้องหรือไม่
3. **ระบุปัญหาได้ชัดเจน** - รู้ว่าปัญหาอยู่ที่ Frontend หรือ Backend
4. **แก้ไขได้ตรงจุด** - แก้ไขปัญหาตามที่ระบุได้

## ไฟล์ที่แก้ไข

- `src/app/components/users/forgotpass/forgotpass.component.ts`
  - เพิ่ม debug logging ใน `sendOtp()`
  - เพิ่ม debug logging ใน `verifyOtp()`
  - เพิ่ม debug logging ใน `resetPassword()`
  - ปรับปรุง error handling

## สรุป

การเพิ่ม debug logging จะช่วยให้:
- **เห็นข้อมูลที่ส่งไป** - ตรวจสอบความถูกต้องของข้อมูล
- **เห็นข้อมูลที่รับมา** - ตรวจสอบการทำงานของ Backend
- **ระบุปัญหาได้ชัดเจน** - รู้ว่าปัญหาอยู่ที่ไหน
- **แก้ไขได้ตรงจุด** - แก้ไขปัญหาตามที่ระบุได้

**ตอนนี้ลองทดสอบใหม่และดู console log เพื่อระบุปัญหาที่แท้จริง!** 🔍✨
