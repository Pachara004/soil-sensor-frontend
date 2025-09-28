# Forgot Password OTP System

## 🎯 ระบบลืมรหัสผ่านด้วย OTP

ระบบลืมรหัสผ่านที่สมบูรณ์พร้อมการส่ง OTP ผ่าน email โดยไม่ใช้ EmailJS

## 🔧 ฟีเจอร์ที่รองรับ

### ✅ **Frontend Features:**
- **3-Step Process** - Email → OTP → New Password
- **OTP Generation** - สร้าง OTP 6 หลักแบบสุ่ม
- **Email Validation** - ตรวจสอบรูปแบบอีเมล
- **Password Strength** - ตรวจสอบความแข็งแรงของรหัสผ่าน
- **Countdown Timer** - นับถอยหลังสำหรับการส่ง OTP ใหม่
- **Responsive Design** - รองรับทุกขนาดหน้าจอ

### ✅ **Backend Integration:**
- **Send OTP API** - ส่ง OTP ผ่าน email
- **Reset Password API** - เปลี่ยนรหัสผ่านด้วย OTP
- **Email Service** - ส่งอีเมลโดยไม่ใช้ EmailJS

## 📁 ไฟล์ที่แก้ไข

### 1. **Forgot Password Component**
```
src/app/components/users/forgotpass/
├── forgotpass.component.ts (✅ อัปเดต)
├── forgotpass.component.html (✅ อัปเดต)
└── forgotpass.component.scss (✅ อัปเดต)
```

### 2. **Navigation Flow**
```typescript
// src/app/components/users/forgotpass/forgotpass.component.ts
goBack() {
  if (this.step > 1) {
    this.step--;
    this.resetStepData();
  } else {
    this.router.navigate(['/']); // ✅ กลับไป login
  }
}
```

## 🔄 การทำงานของระบบ

### **Step 1: กรอกอีเมล**
```typescript
async sendOtp() {
  if (!this.isValidEmail(this.email)) {
    this.notificationService.showNotification('error', 'อีเมลไม่ถูกต้อง', 'กรุณากรอกอีเมลให้ถูกต้อง');
    return;
  }

  this.isLoading = true;
  try {
    // สร้าง OTP 6 หลักและเลขอ้างอิง
    this.generatedOtp = this.generateOtp();
    this.referenceNumber = this.generateReferenceNumber();
    
    // ส่ง OTP ไปยัง backend เพื่อส่ง email
    const response = await firstValueFrom(
      this.http.post(`${this.apiUrl}/api/auth/send-otp`, {
        email: this.email,
        otp: this.generatedOtp,
        referenceNumber: this.referenceNumber,
        type: 'password-reset'
      })
    );

    console.log('✅ OTP sent successfully:', response);
    this.step = 2;
    this.startCountdown();
    this.notificationService.showNotification('success', 'ส่ง OTP สำเร็จ', `กรุณาตรวจสอบอีเมลของคุณ เลขอ้างอิง: ${this.referenceNumber}`);
  } catch (error: any) {
    console.error('เกิดข้อผิดพลาด:', error);
    this.notificationService.showNotification('error', 'ไม่สามารถส่ง OTP ได้', 'ไม่สามารถส่ง OTP ได้: ' + (error.message || 'Unknown error'));
  } finally {
    this.isLoading = false;
  }
}

generateOtp(): string {
  // สร้าง OTP 6 หลัก
  return Math.floor(100000 + Math.random() * 900000).toString();
}

generateReferenceNumber(): string {
  // สร้างเลขอ้างอิง 8 หลัก (ตัวอักษรและตัวเลข)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
```

### **Step 2: ตรวจสอบ OTP**
```typescript
async verifyOtp() {
  const enteredOtp = this.otp.join('');
  
  if (enteredOtp.length !== 6) {
    this.notificationService.showNotification('error', 'OTP ไม่ครบถ้วน', 'กรุณากรอก OTP ให้ครบ 6 หลัก');
    return;
  }

  this.isLoading = true;
  try {
    // ส่ง OTP ไปตรวจสอบที่ backend
    const response = await firstValueFrom(
      this.http.post(`${this.apiUrl}/api/auth/verify-otp`, {
        email: this.email,
        otp: enteredOtp,
        referenceNumber: this.referenceNumber,
        type: 'password-reset'
      })
    );

    console.log('✅ OTP verification successful:', response);
    this.step = 3;
    this.notificationService.showNotification('success', 'OTP ถูกต้อง', 'กรุณาตั้งรหัสผ่านใหม่');
  } catch (error: any) {
    console.error('OTP verification error:', error);
    this.notificationService.showNotification('error', 'OTP ไม่ถูกต้อง', 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ');
  } finally {
    this.isLoading = false;
  }
}
```

### **Step 3: ตั้งรหัสผ่านใหม่**
```typescript
async resetPassword() {
  if (!this.canResetPassword()) {
    this.notificationService.showNotification('error', 'รหัสผ่านไม่ถูกต้อง', 'รหัสผ่านไม่ตรงกัน หรือไม่ตรงตามเกณฑ์');
    return;
  }

  this.isLoading = true;

  try {
    // ส่งข้อมูลไปยัง backend เพื่อ reset password
    const response = await firstValueFrom(
      this.http.put(`${this.apiUrl}/api/auth/reset-password`, {
        email: this.email,
        newPassword: this.newPassword,
        otp: this.generatedOtp,
        referenceNumber: this.referenceNumber
      })
    );

    console.log('✅ Password reset successfully:', response);
    this.notificationService.showNotification('success', 'เปลี่ยนรหัสผ่านสำเร็จ', 'กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่', true, 'ไปหน้า Login', () => {
      this.router.navigate(['/']);
    });
  } catch (error: any) {
    console.error('เกิดข้อผิดพลาด:', error);
    this.notificationService.showNotification('error', 'ไม่สามารถเปลี่ยนรหัสผ่านได้', 'ไม่สามารถเปลี่ยนรหัสผ่านได้: ' + (error.message || 'Unknown error'));
  } finally {
    this.isLoading = false;
  }
}
```

## 🛠️ Backend API Endpoints

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
    
    // บันทึก OTP ในฐานข้อมูล (optional)
    await db.query(
      'INSERT INTO otp_codes (email, otp, reference_number, type, expires_at) VALUES ($1, $2, $3, $4, NOW() + INTERVAL \'10 minutes\')',
      [email, otp, referenceNumber, type]
    );
    
    res.json({
      success: true,
      message: 'OTP ส่งสำเร็จ'
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
    
    // Mark OTP as used (optional - หรือจะลบออกเลยก็ได้)
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

### **3. Reset Password API**
```javascript
// PUT /api/auth/reset-password
app.put('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, newPassword, otp, referenceNumber } = req.body;
    
    // ตรวจสอบ OTP และเลขอ้างอิง
    const otpRecord = await db.query(
      'SELECT * FROM otp_codes WHERE email = $1 AND otp = $2 AND reference_number = $3 AND type = $4 AND expires_at > NOW()',
      [email, otp, referenceNumber, 'password-reset']
    );
    
    if (otpRecord.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'OTP ไม่ถูกต้องหรือหมดอายุ'
      });
    }
    
    // Hash รหัสผ่านใหม่
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // อัปเดตรหัสผ่านในฐานข้อมูล
    await db.query(
      'UPDATE users SET user_password = $1, updated_at = NOW() WHERE user_email = $2',
      [hashedPassword, email]
    );
    
    // ลบ OTP ที่ใช้แล้ว
    await db.query('DELETE FROM otp_codes WHERE email = $1 AND otp = $2 AND reference_number = $3', [email, otp, referenceNumber]);
    
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

### **OTP Codes Table**
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

-- Index for faster lookups
CREATE INDEX idx_otp_codes_email_otp ON otp_codes(email, otp);
CREATE INDEX idx_otp_codes_reference ON otp_codes(reference_number);
CREATE INDEX idx_otp_codes_expires ON otp_codes(expires_at);
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

## 🎨 UI/UX Features

### **Back Arrow Outside Card:**
```html
<div class="container">
  <!-- Back arrow อยู่นอก card -->
  <button class="back" (click)="goBack()">
    <i class="fas fa-arrow-left"></i>
  </button>

  <div class="card">
    <!-- Content -->
  </div>
</div>
```

### **OTP Input Fields:**
```html
<div class="otp-boxes">
  <input 
    *ngFor="let input of otpInputsArray; let i = index"
    #otpInput
    type="text" 
    maxlength="1" 
    [(ngModel)]="otp[i]"
    (input)="onOtpInput($event, i)"
    (keydown)="onOtpKeydown($event, i)"
    class="otp-box"
  />
</div>
```

### **Password Strength Indicator:**
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

## 🔄 Flow Diagram

```
1. User enters email
   ↓
2. Frontend generates OTP + Reference Number
   ↓
3. Send OTP to backend (/api/auth/send-otp)
   ↓
4. Backend sends email with OTP + Reference
   ↓
5. User enters OTP
   ↓
6. Verify OTP via backend (/api/auth/verify-otp)
   ↓
7. User enters new password
   ↓
8. Reset password via backend (/api/auth/reset-password)
   ↓
9. Success → Login page
```

## 🎉 ผลลัพธ์

**ระบบลืมรหัสผ่านที่สมบูรณ์:**
- ✅ **OTP Generation** - สร้าง OTP 6 หลักแบบสุ่ม
- ✅ **Email Service** - ส่งอีเมลโดยไม่ใช้ EmailJS
- ✅ **Backend Integration** - API endpoints สำหรับ OTP และ reset password
- ✅ **Security** - OTP หมดอายุใน 10 นาที
- ✅ **UI/UX** - Back arrow นอก card, responsive design
- ✅ **Navigation** - Flow ที่ชัดเจน

**พร้อมใช้งานแล้ว!** 🚀✨
