# Forgot Password - Email Only OTP System

## การเปลี่ยนแปลง

### ✅ **ลบ OTP ทดลองออก:**
- ลบ debug UI ที่แสดง OTP ที่ถูกต้อง
- ลบ Frontend OTP validation
- ลบ properties `generatedOtp` และ `backendOtp`
- ลบ method `generateOtp()`

### ✅ **อิง OTP จาก Email เท่านั้น:**
- ระบบจะตรวจสอบ OTP จาก Backend เท่านั้น
- ไม่มีการสร้าง OTP ใน Frontend
- ไม่มีการแสดง OTP ใน UI

## การทำงานของระบบ

### 1. ส่ง OTP
```typescript
async sendOtp() {
  // สร้างเลขอ้างอิงใหม่
  this.referenceNumber = this.generateReferenceNumber();
  
  const sendData = {
    email: this.email,
    referenceNumber: this.referenceNumber,
    type: 'password-reset',
    invalidatePrevious: true
  };
  
  // ส่งไปยัง Backend เพื่อสร้าง OTP และส่ง email
  const response = await firstValueFrom(
    this.http.post(`${this.apiUrl}/api/auth/send-otp`, sendData)
  );
}
```

### 2. ตรวจสอบ OTP
```typescript
async verifyOtp() {
  const enteredOtp = this.otp.join('');
  
  // ส่ง OTP ไปตรวจสอบที่ backend (อิง OTP จาก email เท่านั้น)
  const verifyData = {
    email: this.email,
    otp: enteredOtp,
    referenceNumber: this.referenceNumber,
    type: 'password-reset'
  };
  
  // ส่งไปยัง Backend เพื่อตรวจสอบ OTP
  const response = await firstValueFrom(
    this.http.post(`${this.apiUrl}/api/auth/verify-otp`, verifyData)
  );
}
```

### 3. Reset Password
```typescript
async resetPassword() {
  // ส่งข้อมูลไปยัง backend เพื่อ reset password (อิง OTP จาก email เท่านั้น)
  const resetData = {
    email: this.email,
    newPassword: this.newPassword,
    referenceNumber: this.referenceNumber
  };
  
  // ส่งไปยัง Backend เพื่อ reset password
  const response = await firstValueFrom(
    this.http.put(`${this.apiUrl}/api/auth/reset-password`, resetData)
  );
}
```

## ข้อมูลที่ส่งไป Backend

### **Send OTP:**
```json
{
  "email": "user@example.com",
  "referenceNumber": "ABC12345",
  "type": "password-reset",
  "invalidatePrevious": true
}
```

### **Verify OTP:**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "referenceNumber": "ABC12345",
  "type": "password-reset"
}
```

### **Reset Password:**
```json
{
  "email": "user@example.com",
  "newPassword": "newpassword123",
  "referenceNumber": "ABC12345"
}
```

## Console Logs ที่คาดหวัง

### **Send OTP:**
```
🔍 Generated NEW Reference Number: ABC12345
🔍 Email: user@example.com
🔄 Previous OTP will be invalidated
🔍 Sending OTP data: {email: "user@example.com", referenceNumber: "ABC12345", type: "password-reset", invalidatePrevious: true}
✅ NEW OTP sent successfully: {message: "OTP sent", ref: "ABC12345"}
🔄 Updated Reference Number from Backend: ABC12345
```

### **Verify OTP:**
```
🔍 Sending OTP verification data: {email: "user@example.com", otp: "123456", referenceNumber: "ABC12345", type: "password-reset"}
🔍 Entered OTP: 123456
🔍 Reference Number: ABC12345
🔍 Email: user@example.com
✅ OTP verification successful: {message: "OTP verified"}
```

### **Reset Password:**
```
🔍 Sending reset password data: {email: "user@example.com", newPassword: "newpassword123", referenceNumber: "ABC12345"}
🔍 Reference Number: ABC12345
🔍 Email: user@example.com
✅ Password reset successfully: {message: "Password reset successfully"}
```

## UI ที่เปลี่ยนแปลง

### **ก่อนหน้า (มี Debug UI):**
```
┌─────────────────────────────────────┐
│ เลขอ้างอิง: ABC12345                │
│ OTP ที่ถูกต้อง (สำหรับการทดสอบ):      │
│ 123456                              │
└─────────────────────────────────────┘
```

### **หลัง (ไม่มี Debug UI):**
```
┌─────────────────────────────────────┐
│ เลขอ้างอิง: ABC12345                │
└─────────────────────────────────────┘
```

## ข้อดีของการเปลี่ยนแปลง

1. **ความปลอดภัย** - ไม่แสดง OTP ใน UI
2. **User Experience** - ผู้ใช้ต้องตรวจสอบ email จริงๆ
3. **ความถูกต้อง** - อิง OTP จาก email เท่านั้น
4. **ความเรียบง่าย** - ไม่มี debug information
5. **Production Ready** - เหมาะสำหรับใช้งานจริง

## Backend Requirements

### **Send OTP Endpoint:**
```javascript
app.post('/api/auth/send-otp', async (req, res) => {
  const { email, referenceNumber, type, invalidatePrevious } = req.body;
  
  // สร้าง OTP 6 หลัก
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // เก็บ OTP ใน database หรือ memory
  otpStore[email] = {
    otp: otp,
    referenceNumber: referenceNumber,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    used: false
  };
  
  // ส่ง email
  await sendOtpEmail(email, otp, referenceNumber);
  
  res.json({ 
    message: 'OTP sent successfully',
    ref: referenceNumber
  });
});
```

### **Verify OTP Endpoint:**
```javascript
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp, referenceNumber, type } = req.body;
  
  const storedOtp = otpStore[email];
  
  if (!storedOtp || storedOtp.otp !== otp || storedOtp.referenceNumber !== referenceNumber) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }
  
  if (new Date() > new Date(storedOtp.expiresAt)) {
    return res.status(400).json({ message: 'OTP expired' });
  }
  
  storedOtp.used = true;
  
  res.json({ message: 'OTP verified successfully' });
});
```

### **Reset Password Endpoint:**
```javascript
app.put('/api/auth/reset-password', async (req, res) => {
  const { email, newPassword, referenceNumber } = req.body;
  
  const storedOtp = otpStore[email];
  
  if (!storedOtp || !storedOtp.used || storedOtp.referenceNumber !== referenceNumber) {
    return res.status(400).json({ message: 'Invalid or unused OTP' });
  }
  
  // Hash password และอัปเดตใน database
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db.query('UPDATE users SET user_password = $1 WHERE user_email = $2', [hashedPassword, email]);
  
  // ลบ OTP หลังจากใช้งาน
  delete otpStore[email];
  
  res.json({ message: 'Password reset successfully' });
});
```

## สรุป

การเปลี่ยนแปลงนี้ทำให้:
- **ระบบปลอดภัยขึ้น** - ไม่แสดง OTP ใน UI
- **อิง OTP จาก email เท่านั้น** - ไม่มีการสร้าง OTP ใน Frontend
- **User Experience ดีขึ้น** - ผู้ใช้ต้องตรวจสอบ email จริงๆ
- **Production Ready** - เหมาะสำหรับใช้งานจริง

**ตอนนี้ระบบพร้อมใช้งานแล้ว!** 🎉✨
