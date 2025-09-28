# Backend Reset Password Fix

## ปัญหา

Frontend ส่งข้อมูลไป Backend:
```json
{
  "email": "mrtgamer76@gmail.com",
  "newPassword": "123456",
  "otp": "782618",
  "referenceNumber": "552228"
}
```

แต่ Backend ยังคืน 400 Bad Request กลับมา

## การแก้ไข Backend

### 1. แก้ไข `/api/auth/reset-password` Endpoint

```javascript
// ในไฟล์ api/auth.js หรือ auth.js
app.put('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, newPassword, otp, referenceNumber } = req.body;

    console.log('Reset password request:', { email, newPassword, otp, referenceNumber });

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!email || !newPassword || !otp || !referenceNumber) {
      console.log('Missing required fields:', { email: !!email, newPassword: !!newPassword, otp: !!otp, referenceNumber: !!referenceNumber });
      return res.status(400).json({ 
        message: 'Email, new password, OTP, and reference number are required' 
      });
    }

    // ตรวจสอบ OTP ใน store
    const storedOtp = otpStore[email];
    
    if (!storedOtp) {
      console.log('OTP not found in store for email:', email);
      console.log('Current OTP store:', otpStore);
      return res.status(400).json({ 
        message: 'OTP not found or expired. Please request a new OTP.' 
      });
    }

    // ตรวจสอบ Reference Number
    if (storedOtp.referenceNumber !== referenceNumber) {
      console.log('Reference number mismatch:', {
        stored: storedOtp.referenceNumber,
        provided: referenceNumber
      });
      return res.status(400).json({ 
        message: 'Invalid reference number. Please use the latest OTP.' 
      });
    }

    // ตรวจสอบ OTP
    if (storedOtp.otp !== otp) {
      console.log('OTP mismatch:', {
        stored: storedOtp.otp,
        provided: otp
      });
      return res.status(400).json({ 
        message: 'Invalid OTP. Please use the latest OTP.' 
      });
    }

    // ตรวจสอบการใช้งาน
    if (!storedOtp.used) {
      console.log('OTP not verified yet');
      return res.status(400).json({ 
        message: 'OTP not verified. Please verify OTP first.' 
      });
    }

    // ตรวจสอบการหมดอายุ
    const now = new Date();
    const expiresAt = new Date(storedOtp.expiresAt);
    
    if (now > expiresAt) {
      console.log('OTP expired:', {
        now: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      });
      delete otpStore[email];
      return res.status(400).json({ 
        message: 'OTP has expired. Please request a new OTP.' 
      });
    }

    // หา user ในฐานข้อมูล
    const user = await db.query('SELECT * FROM users WHERE user_email = $1', [email]);
    
    if (user.rows.length === 0) {
      console.log('User not found in database:', email);
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

### 2. ตรวจสอบ OTP Store Structure

```javascript
// ตรวจสอบว่า otpStore มีโครงสร้างที่ถูกต้อง
console.log('OTP Store structure:', {
  keys: Object.keys(otpStore),
  sampleEntry: otpStore[Object.keys(otpStore)[0]]
});
```

### 3. ตรวจสอบ Database Connection

```javascript
// ตรวจสอบการเชื่อมต่อฐานข้อมูล
try {
  const testQuery = await db.query('SELECT NOW()');
  console.log('Database connection OK:', testQuery.rows[0]);
} catch (error) {
  console.error('Database connection error:', error);
}
```

## การ Debug

### 1. เพิ่ม Logging ใน Backend

```javascript
// เพิ่ม logging ในทุกขั้นตอน
console.log('=== RESET PASSWORD DEBUG ===');
console.log('Request body:', req.body);
console.log('OTP Store:', otpStore);
console.log('Current time:', new Date().toISOString());
```

### 2. ตรวจสอบ OTP Store

```javascript
// ตรวจสอบว่า OTP ถูกเก็บไว้หรือไม่
if (otpStore[email]) {
  console.log('Found OTP for email:', {
    email: email,
    otp: storedOtp.otp,
    referenceNumber: storedOtp.referenceNumber,
    expiresAt: storedOtp.expiresAt,
    used: storedOtp.used
  });
} else {
  console.log('No OTP found for email:', email);
  console.log('Available emails in store:', Object.keys(otpStore));
}
```

### 3. ตรวจสอบ Database Query

```javascript
// ตรวจสอบการ query ฐานข้อมูล
try {
  const user = await db.query('SELECT * FROM users WHERE user_email = $1', [email]);
  console.log('User query result:', {
    found: user.rows.length > 0,
    user: user.rows[0] || null
  });
} catch (error) {
  console.error('Database query error:', error);
}
```

## สาเหตุที่เป็นไปได้

### 1. OTP Store ไม่มีข้อมูล
- OTP หมดอายุ
- OTP ถูกลบไปแล้ว
- Email ไม่ตรงกัน

### 2. Reference Number ไม่ตรงกัน
- Frontend ส่ง Reference Number ผิด
- Backend เก็บ Reference Number ผิด

### 3. OTP ไม่ตรงกัน
- Frontend ส่ง OTP ผิด
- Backend เก็บ OTP ผิด

### 4. Database Error
- การเชื่อมต่อฐานข้อมูล
- การ query ฐานข้อมูล
- การอัปเดตฐานข้อมูล

## การทดสอบ

### 1. ทดสอบ Send OTP
```bash
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "referenceNumber": "TEST123",
    "type": "password-reset",
    "invalidatePrevious": true
  }'
```

### 2. ทดสอบ Verify OTP
```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp": "123456",
    "referenceNumber": "TEST123",
    "type": "password-reset"
  }'
```

### 3. ทดสอบ Reset Password
```bash
curl -X PUT http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "newPassword": "newpassword123",
    "otp": "123456",
    "referenceNumber": "TEST123"
  }'
```

## สรุป

การแก้ไขนี้จะทำให้:
- **Backend รับ OTP** - ใน reset password request
- **ตรวจสอบ OTP** - อย่างถูกต้อง
- **Debug ง่าย** - มี logging ที่ชัดเจน
- **Error Handling** - จัดการ error ได้ดีขึ้น

**ตอนนี้ Backend ต้องได้รับการแก้ไขตามเอกสารนี้เพื่อให้ระบบทำงานได้ถูกต้อง!** 🔧✨
