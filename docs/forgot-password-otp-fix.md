# Forgot Password OTP Fix

## ปัญหาที่พบ

จาก Console Log จะเห็นว่า:
```
✅ OTP verification successful: {message: 'OTP verified'}
🔍 Sending reset password data: {email: 'mrtgamer76@gmail.com', newPassword: '123456', referenceNumber: '500248'}
PUT http://localhost:3000/api/auth/reset-password 400 (Bad Request)
```

**ปัญหา:**
- **OTP verification สำเร็จ** ✅
- **Reset password ล้มเหลว** ❌ - 400 Bad Request

**สาเหตุ:** Backend ต้องการ OTP ใน reset password request แต่ Frontend ไม่ได้ส่งไป!

## การแก้ไข

### 1. เพิ่ม OTP ใน Reset Password Request

```typescript
async resetPassword() {
  // ใช้ OTP ที่ผู้ใช้กรอก (ที่ผ่านการ verify แล้ว)
  const enteredOtp = this.otp.join('');
  
  // ส่งข้อมูลไปยัง backend เพื่อ reset password
  const resetData = {
    email: this.email,
    newPassword: this.newPassword,
    otp: enteredOtp, // เพิ่ม OTP กลับเข้าไป
    referenceNumber: this.referenceNumber
  };
  
  console.log('🔍 Sending reset password data:', resetData);
  console.log('🔍 Entered OTP (verified):', enteredOtp);
  
  // ส่งข้อมูลไปยัง backend เพื่อ reset password
  const response = await firstValueFrom(
    this.http.put(`${this.apiUrl}/api/auth/reset-password`, resetData)
  );
}
```

## การทำงานของระบบ

### 1. ส่ง OTP
```
Frontend สร้าง: Reference Number = LC7Y5WDG
Backend ส่งกลับ: {message: 'OTP sent', ref: '500248'}
Frontend อัปเดต: referenceNumber = '500248'
```

### 2. ตรวจสอบ OTP
```
ผู้ใช้กรอก: 382595
Frontend ส่ง: {email: 'mrtgamer76@gmail.com', otp: '382595', referenceNumber: '500248', type: 'password-reset'}
Backend ตรวจสอบ: ✅
Frontend ไป Step 3
```

### 3. Reset Password (ใหม่)
```
Frontend ส่ง: {email: 'mrtgamer76@gmail.com', newPassword: '123456', otp: '382595', referenceNumber: '500248'}
Backend ตรวจสอบ: OTP=382595, Ref=500248 ✅
Backend อัปเดตรหัสผ่าน: ✅
```

## ข้อมูลที่ส่งไป Backend

### **Reset Password Request:**
```json
{
  "email": "mrtgamer76@gmail.com",
  "newPassword": "123456",
  "otp": "382595",
  "referenceNumber": "500248"
}
```

## Console Logs ที่คาดหวัง

### **หลังจากแก้ไข:**
```
🔍 Generated NEW Reference Number: LC7Y5WDG
🔍 Email: mrtgamer76@gmail.com
🔄 Previous OTP will be invalidated
🔍 Sending OTP data: {email: 'mrtgamer76@gmail.com', referenceNumber: 'LC7Y5WDG', type: 'password-reset', invalidatePrevious: true}
✅ NEW OTP sent successfully: {message: 'OTP sent', ref: '500248'}
🔄 Updated Reference Number from Backend: 500248

🔍 Sending OTP verification data: {email: 'mrtgamer76@gmail.com', otp: '382595', referenceNumber: '500248', type: 'password-reset'}
🔍 Entered OTP: 382595
🔍 Reference Number: 500248
🔍 Email: mrtgamer76@gmail.com
✅ OTP verification successful: {message: 'OTP verified'}

🔍 Sending reset password data: {email: 'mrtgamer76@gmail.com', newPassword: '123456', otp: '382595', referenceNumber: '500248'}
🔍 Entered OTP (verified): 382595
🔍 Reference Number: 500248
🔍 Email: mrtgamer76@gmail.com
✅ Password reset successfully: {message: 'Password reset successfully'}
```

## Backend Requirements

### **Reset Password Endpoint:**
```javascript
app.put('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, newPassword, otp, referenceNumber } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!email || !newPassword || !otp || !referenceNumber) {
      return res.status(400).json({ 
        message: 'Email, new password, OTP, and reference number are required' 
      });
    }

    // ตรวจสอบ OTP ใน store
    const storedOtp = otpStore[email];
    
    if (!storedOtp) {
      return res.status(400).json({ 
        message: 'OTP not found or expired. Please request a new OTP.' 
      });
    }

    // ตรวจสอบ Reference Number
    if (storedOtp.referenceNumber !== referenceNumber) {
      return res.status(400).json({ 
        message: 'Invalid reference number. Please use the latest OTP.' 
      });
    }

    // ตรวจสอบ OTP
    if (storedOtp.otp !== otp) {
      return res.status(400).json({ 
        message: 'Invalid OTP. Please use the latest OTP.' 
      });
    }

    // ตรวจสอบการใช้งาน
    if (!storedOtp.used) {
      return res.status(400).json({ 
        message: 'OTP not verified. Please verify OTP first.' 
      });
    }

    // ตรวจสอบการหมดอายุ
    const now = new Date();
    const expiresAt = new Date(storedOtp.expiresAt);
    
    if (now > expiresAt) {
      delete otpStore[email];
      return res.status(400).json({ 
        message: 'OTP has expired. Please request a new OTP.' 
      });
    }

    // หา user ในฐานข้อมูล
    const user = await db.query('SELECT * FROM users WHERE user_email = $1', [email]);
    
    if (user.rows.length === 0) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    // Hash รหัสผ่านใหม่
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // อัปเดตรหัสผ่านในฐานข้อมูล
    await db.query(
      'UPDATE users SET user_password = $1, updated_at = NOW() WHERE user_email = $2',
      [hashedPassword, email]
    );

    // ลบ OTP หลังจากใช้งานเสร็จ
    delete otpStore[email];

    console.log(`✅ Password reset successfully for ${email}`);

    res.json({ 
      message: 'Password reset successfully' 
    });

  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
```

## ข้อดีของการแก้ไข

1. **ความถูกต้อง** - ส่ง OTP ที่ถูกต้องไป Backend
2. **ความปลอดภัย** - Backend ตรวจสอบ OTP อีกครั้ง
3. **ความสมบูรณ์** - ข้อมูลครบถ้วนตามที่ Backend ต้องการ
4. **Error Prevention** - ป้องกัน 400 Bad Request

## สรุป

การแก้ไขนี้จะทำให้:
- **ส่ง OTP ไป Backend** - ใน reset password request
- **Backend ตรวจสอบ OTP** - อีกครั้งเพื่อความปลอดภัย
- **ระบบทำงานได้ถูกต้อง** - ไม่มี 400 Bad Request

**ตอนนี้ระบบควรทำงานได้ถูกต้องแล้ว!** 🎉✨
