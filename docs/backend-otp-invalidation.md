# Backend OTP Invalidation System

## วัตถุประสงค์
เมื่อผู้ใช้กดส่ง OTP ใหม่ ระบบจะต้อง:
1. **ทำให้ OTP ก่อนหน้าหมดอายุ** - ไม่สามารถใช้ได้อีก
2. **ใช้ OTP ใหม่** - ที่ส่งไปยังเมลล่าสุด
3. **อัปเดต Reference Number** - ให้ตรงกับ OTP ใหม่

## การแก้ไข Backend

### 1. แก้ไข `/api/auth/send-otp` Endpoint

```javascript
// ในไฟล์ api/auth.js หรือ auth.js
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email, otp, referenceNumber, type, invalidatePrevious } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!email || !otp || !referenceNumber || !type) {
      return res.status(400).json({ 
        message: 'Email, OTP, reference number, and type are required' 
      });
    }

    // หาก invalidatePrevious = true ให้ลบ OTP ก่อนหน้าทั้งหมดของ email นี้
    if (invalidatePrevious) {
      console.log(`🔄 Invalidating previous OTPs for email: ${email}`);
      
      // ลบ OTP เก่าทั้งหมดของ email นี้
      if (otpStore[email]) {
        delete otpStore[email];
        console.log(`✅ Previous OTPs invalidated for: ${email}`);
      }
    }

    // ตรวจสอบว่า email มี OTP อยู่แล้วหรือไม่ (ถ้าไม่ใช่ invalidatePrevious)
    if (!invalidatePrevious && otpStore[email]) {
      const existingOtp = otpStore[email];
      const now = new Date();
      const expiresAt = new Date(existingOtp.expiresAt);
      
      if (now < expiresAt && !existingOtp.used) {
        return res.status(400).json({ 
          message: 'OTP already exists and is still valid. Please wait or use resend.',
          remainingTime: Math.ceil((expiresAt - now) / 1000)
        });
      }
    }

    // สร้าง OTP ใหม่
    const otpData = {
      otp: otp,
      referenceNumber: referenceNumber,
      type: type,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 นาที
      used: false,
      attempts: 0
    };

    // เก็บ OTP ใหม่
    otpStore[email] = otpData;

    console.log(`✅ NEW OTP stored for ${email}:`, {
      otp: otp,
      referenceNumber: referenceNumber,
      expiresAt: otpData.expiresAt,
      invalidatePrevious: invalidatePrevious
    });

    // ส่ง email (ใช้ nodemailer หรือ email service อื่น)
    await sendOtpEmail(email, otp, referenceNumber, type);

    res.json({ 
      message: 'OTP sent successfully',
      ref: referenceNumber,
      invalidated: invalidatePrevious || false
    });

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
```

### 2. แก้ไข `/api/auth/verify-otp` Endpoint

```javascript
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp, referenceNumber, type } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!email || !otp || !referenceNumber || !type) {
      return res.status(400).json({ 
        message: 'Email, OTP, reference number, and type are required' 
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
      storedOtp.attempts++;
      if (storedOtp.attempts >= 3) {
        delete otpStore[email]; // ลบ OTP หลังจากพยายาม 3 ครั้ง
        return res.status(400).json({ 
          message: 'Too many failed attempts. OTP has been invalidated. Please request a new OTP.' 
        });
      }
      return res.status(400).json({ 
        message: 'Invalid OTP. Please try again.',
        remainingAttempts: 3 - storedOtp.attempts
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

    // ตรวจสอบการใช้งาน
    if (storedOtp.used) {
      return res.status(400).json({ 
        message: 'OTP has already been used. Please request a new OTP.' 
      });
    }

    // Mark OTP as used
    storedOtp.used = true;
    storedOtp.verifiedAt = new Date();

    console.log(`✅ OTP verified successfully for ${email}:`, {
      referenceNumber: referenceNumber,
      verifiedAt: storedOtp.verifiedAt
    });

    res.json({ 
      message: 'OTP verified successfully',
      referenceNumber: referenceNumber
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
```

### 3. แก้ไข `/api/auth/reset-password` Endpoint

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

## การทำงานของระบบ

### 1. ส่ง OTP ครั้งแรก
```json
POST /api/auth/send-otp
{
  "email": "user@example.com",
  "otp": "123456",
  "referenceNumber": "ABC12345",
  "type": "password-reset",
  "invalidatePrevious": false
}
```

**Response:**
```json
{
  "message": "OTP sent successfully",
  "ref": "ABC12345",
  "invalidated": false
}
```

### 2. ส่ง OTP ใหม่ (Resend)
```json
POST /api/auth/send-otp
{
  "email": "user@example.com",
  "otp": "789012",
  "referenceNumber": "XYZ67890",
  "type": "password-reset",
  "invalidatePrevious": true
}
```

**Response:**
```json
{
  "message": "OTP sent successfully",
  "ref": "XYZ67890",
  "invalidated": true
}
```

**ผลลัพธ์:**
- OTP เก่า (123456) หมดอายุทันที
- OTP ใหม่ (789012) ใช้งานได้
- Reference Number เปลี่ยนเป็น XYZ67890

### 3. ตรวจสอบ OTP
```json
POST /api/auth/verify-otp
{
  "email": "user@example.com",
  "otp": "789012",
  "referenceNumber": "XYZ67890",
  "type": "password-reset"
}
```

**Response:**
```json
{
  "message": "OTP verified successfully",
  "referenceNumber": "XYZ67890"
}
```

### 4. Reset Password
```json
PUT /api/auth/reset-password
{
  "email": "user@example.com",
  "newPassword": "newpassword123",
  "otp": "789012",
  "referenceNumber": "XYZ67890"
}
```

**Response:**
```json
{
  "message": "Password reset successfully"
}
```

## Console Logs

### Backend Console:
```
🔄 Invalidating previous OTPs for email: user@example.com
✅ Previous OTPs invalidated for: user@example.com
✅ NEW OTP stored for user@example.com: {
  otp: '789012',
  referenceNumber: 'XYZ67890',
  expiresAt: '2025-01-26T10:40:00.000Z',
  invalidatePrevious: true
}
✅ OTP verified successfully for user@example.com: {
  referenceNumber: 'XYZ67890',
  verifiedAt: '2025-01-26T10:35:00.000Z'
}
✅ Password reset successfully for user@example.com
```

### Frontend Console:
```
🔄 Resending OTP - Generated NEW OTP: 789012
🔄 Resending OTP - Generated NEW Reference Number: XYZ67890
🔄 Previous OTP will be invalidated
✅ NEW OTP resent successfully: {message: "OTP sent successfully", ref: "XYZ67890", invalidated: true}
```

## ข้อดีของระบบ

1. **ความปลอดภัย** - OTP เก่าหมดอายุทันทีเมื่อส่งใหม่
2. **ความชัดเจน** - ผู้ใช้รู้ว่า OTP ไหนใช้งานได้
3. **ป้องกันการใช้งานซ้ำ** - OTP เก่าไม่สามารถใช้ได้อีก
4. **Debug ง่าย** - มี logging ที่ชัดเจน
5. **User Experience** - แจ้งเตือนที่เข้าใจง่าย

## สรุป

ระบบ OTP Invalidation จะทำให้:
- **OTP เก่าหมดอายุ** เมื่อส่งใหม่
- **ใช้ OTP ใหม่** ที่ส่งไปยังเมลล่าสุด
- **Reference Number ใหม่** ตรงกับ OTP ใหม่
- **ความปลอดภัยสูง** ป้องกันการใช้งาน OTP เก่า

**ตอนนี้ Backend ต้องรองรับ `invalidatePrevious` flag เพื่อให้ระบบทำงานได้อย่างสมบูรณ์!** 🔄✨
