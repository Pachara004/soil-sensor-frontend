# Backend Reset Password Endpoint

## 🎯 สร้าง API Endpoint สำหรับ Reset Password

Backend endpoint ที่จำเป็นสำหรับระบบลืมรหัสผ่าน

## 🛠️ API Endpoints ที่ต้องสร้าง

### **1. Send OTP API**
```javascript
// POST /api/auth/send-otp
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email, otp, referenceNumber, type } = req.body;
    
    // ตรวจสอบว่าอีเมลมีอยู่ในระบบหรือไม่
    const user = await db.query('SELECT * FROM users WHERE user_email = $1', [email]);
    
    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบอีเมลในระบบ'
      });
    }
    
    // ส่ง OTP ผ่าน email service
    await sendEmail({
      to: email,
      subject: 'รหัส OTP สำหรับรีเซ็ตรหัสผ่าน',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2E7D32;">รหัส OTP สำหรับรีเซ็ตรหัสผ่าน</h2>
          <p>รหัส OTP ของคุณคือ:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; color: #2E7D32; letter-spacing: 5px;">
            ${otp}
          </div>
          <div style="background: #e8f5e8; padding: 15px; margin: 20px 0; border-radius: 8px; text-align: center;">
            <p style="margin: 0; color: #2E7D32; font-weight: 600;">เลขอ้างอิง: <span style="font-family: monospace; font-size: 18px;">${referenceNumber}</span></p>
          </div>
          <p>รหัสนี้จะหมดอายุใน 10 นาที</p>
          <p>หากคุณไม่ได้ขอรหัสนี้ กรุณาเพิกเฉยต่ออีเมลนี้</p>
        </div>
      `
    });
    
    // บันทึก OTP ในฐานข้อมูล
    await db.query(
      'INSERT INTO otp_codes (email, otp, reference_number, type, expires_at) VALUES ($1, $2, $3, $4, NOW() + INTERVAL \'10 minutes\')',
      [email, otp, referenceNumber, type]
    );
    
    res.json({
      success: true,
      message: 'OTP ส่งสำเร็จ',
      ref: referenceNumber
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถส่ง OTP ได้'
    });
  }
});
```

### **2. Verify OTP API**
```javascript
// POST /api/auth/verify-otp
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp, referenceNumber, type } = req.body;
    
    // ตรวจสอบ OTP และเลขอ้างอิง
    const otpRecord = await db.query(
      'SELECT * FROM otp_codes WHERE email = $1 AND otp = $2 AND reference_number = $3 AND type = $4 AND expires_at > NOW() AND used = FALSE',
      [email, otp, referenceNumber, type]
    );
    
    if (otpRecord.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'OTP ไม่ถูกต้องหรือหมดอายุ'
      });
    }
    
    // Mark OTP as used
    await db.query(
      'UPDATE otp_codes SET used = TRUE WHERE email = $1 AND otp = $2 AND reference_number = $3',
      [email, otp, referenceNumber]
    );
    
    res.json({
      success: true,
      message: 'OTP ถูกต้อง'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถตรวจสอบ OTP ได้'
    });
  }
});
```

### **3. Reset Password API** ⭐
```javascript
// PUT /api/auth/reset-password
app.put('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, newPassword, otp, referenceNumber } = req.body;
    
    // ตรวจสอบ OTP และเลขอ้างอิง
    const otpRecord = await db.query(
      'SELECT * FROM otp_codes WHERE email = $1 AND otp = $2 AND reference_number = $3 AND type = $4 AND expires_at > NOW() AND used = TRUE',
      [email, otp, referenceNumber, 'password-reset']
    );
    
    if (otpRecord.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'OTP ไม่ถูกต้องหรือหมดอายุ กรุณาขอ OTP ใหม่'
      });
    }
    
    // ตรวจสอบว่าผู้ใช้มีอยู่ในระบบหรือไม่
    const user = await db.query('SELECT * FROM users WHERE user_email = $1', [email]);
    
    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบผู้ใช้ในระบบ'
      });
    }
    
    // Hash รหัสผ่านใหม่
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // อัปเดตรหัสผ่านในฐานข้อมูล
    await db.query(
      'UPDATE users SET user_password = $1, updated_at = NOW() WHERE user_email = $2',
      [hashedPassword, email]
    );
    
    // ลบ OTP ที่ใช้แล้ว
    await db.query(
      'DELETE FROM otp_codes WHERE email = $1 AND otp = $2 AND reference_number = $3',
      [email, otp, referenceNumber]
    );
    
    res.json({
      success: true,
      message: 'รีเซ็ตรหัสผ่านสำเร็จ'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถรีเซ็ตรหัสผ่านได้'
    });
  }
});
```

## 📊 Database Schema

### **Users Table (ต้องมีอยู่แล้ว)**
```sql
CREATE TABLE users (
  userid SERIAL PRIMARY KEY,
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255) UNIQUE NOT NULL,
  user_password VARCHAR(255), -- สำหรับ password-based users
  user_phone VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  firebase_uid VARCHAR(255), -- สำหรับ Firebase users
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **OTP Codes Table (ต้องสร้างใหม่)**
```sql
CREATE TABLE otp_codes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  reference_number VARCHAR(8) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'password-reset', 'email-verification', etc.
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  used BOOLEAN DEFAULT FALSE
);

-- Indexes for better performance
CREATE INDEX idx_otp_codes_email_otp ON otp_codes(email, otp);
CREATE INDEX idx_otp_codes_reference ON otp_codes(reference_number);
CREATE INDEX idx_otp_codes_expires ON otp_codes(expires_at);
CREATE INDEX idx_otp_codes_used ON otp_codes(used);
```

## 📧 Email Service Setup

### **Nodemailer Configuration**
```javascript
// emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransporter({
  service: 'gmail', // หรือ service อื่น
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

async function sendEmail({ to, subject, html }) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html
    });
    
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}

module.exports = { sendEmail };
```

### **Environment Variables**
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

## 🔧 Server Setup

### **1. Install Dependencies**
```bash
npm install bcrypt nodemailer
```

### **2. Import in server.js**
```javascript
const bcrypt = require('bcrypt');
const { sendEmail } = require('./emailService');

// Add routes
app.use('/api/auth', require('./routes/auth'));
```

### **3. Create auth.js route file**
```javascript
// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { sendEmail } = require('../emailService');
const db = require('../database'); // your database connection

// Send OTP endpoint
router.post('/send-otp', async (req, res) => {
  // ... implementation above
});

// Verify OTP endpoint
router.post('/verify-otp', async (req, res) => {
  // ... implementation above
});

// Reset Password endpoint
router.put('/reset-password', async (req, res) => {
  // ... implementation above
});

module.exports = router;
```

## 🧪 Testing

### **Test Send OTP**
```bash
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp": "123456",
    "referenceNumber": "ABC12345",
    "type": "password-reset"
  }'
```

### **Test Verify OTP**
```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp": "123456",
    "referenceNumber": "ABC12345",
    "type": "password-reset"
  }'
```

### **Test Reset Password**
```bash
curl -X PUT http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "newPassword": "newpassword123",
    "otp": "123456",
    "referenceNumber": "ABC12345"
  }'
```

## 🔒 Security Considerations

### **1. Password Hashing**
- ใช้ bcrypt ในการ hash รหัสผ่าน
- Salt rounds อย่างน้อย 10

### **2. OTP Security**
- OTP หมดอายุใน 10 นาที
- ใช้ได้ครั้งเดียว (mark as used)
- ตรวจสอบ reference number

### **3. Rate Limiting**
```javascript
const rateLimit = require('express-rate-limit');

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // limit each IP to 3 requests per windowMs
  message: 'Too many OTP requests, please try again later'
});

app.use('/api/auth/send-otp', otpLimiter);
```

### **4. Input Validation**
```javascript
const { body, validationResult } = require('express-validator');

const validateResetPassword = [
  body('email').isEmail().normalizeEmail(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
  body('referenceNumber').isLength({ min: 8, max: 8 }).isAlphanumeric()
];
```

## 🎉 ผลลัพธ์

**Backend API ที่สมบูรณ์:**
- ✅ **Send OTP** - ส่ง OTP ผ่าน email
- ✅ **Verify OTP** - ตรวจสอบ OTP
- ✅ **Reset Password** - รีเซ็ตรหัสผ่าน
- ✅ **Database Integration** - เชื่อมต่อฐานข้อมูล
- ✅ **Email Service** - ส่งอีเมล
- ✅ **Security** - ปลอดภัยและเชื่อถือได้

**พร้อมใช้งานแล้ว!** 🚀✨
