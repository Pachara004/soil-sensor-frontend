# Admin Registration - Complete System

## 🎯 ระบบสมัครแอดมินที่สมบูรณ์

หน้า `adregister` รองรับการสมัครแอดมิน 2 แบบ:
1. **สมัครแบบปกติ** (Email/Password) → สร้างข้อมูลใน PostgreSQL
2. **สมัครด้วย Google** → สร้างข้อมูลใน PostgreSQL

## 🔧 การทำงานของระบบ

### 1. สมัครแบบปกติ (Email/Password)

#### Frontend Flow:
```typescript
// src/app/components/adregister/adregister.component.ts
async register() {
  if (!this.validateForm()) return;

  this.isRegistering = true;
  try {
    // 1. สร้าง Firebase user
    const userCredential = await createUserWithEmailAndPassword(
      this.auth,
      this.email,
      this.password
    );
    const user = userCredential.user;

    // 2. ส่งอีเมลยืนยัน
    await sendEmailVerification(user);

    // 3. สร้างข้อมูลใน PostgreSQL ผ่าน backend API
    const token = await user.getIdToken();
    
    const userData = {
      firebase_uid: user.uid,
      user_email: this.email,
      user_name: this.username,
      user_phone: this.phoneNumber.replace(/\D/g, ''),
      role: 'admin', // admin role สำหรับ adregister
      emailVerified: false
    };

    // 4. ส่งข้อมูลไปยัง backend
    const response = await this.http
      .post(`${this.constants.API_ENDPOINT}/api/auth/register`, userData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      .toPromise();

    console.log('✅ Admin registration successful with PostgreSQL data:', response);

    // 5. แสดง notification และไปหน้า admin
    this.notificationService.showNotification('success', 'สมัครแอดมินสำเร็จ!', 'กรุณายืนยันอีเมลด้วยหากระบบกำหนด', true, 'ไปหน้า Admin', () => {
      this.router.navigate(['/adminmain']);
    });
  } catch (error: any) {
    // Error handling
  } finally {
    this.isRegistering = false;
  }
}
```

#### Backend API: `POST /api/auth/register`
```javascript
// Backend จะรับข้อมูลและสร้างใน PostgreSQL
app.post('/api/auth/register', verifyFirebaseToken, async (req, res) => {
  try {
    const { firebase_uid, user_email, user_name, user_phone, role, emailVerified } = req.body;
    
    // สร้างข้อมูลใน PostgreSQL
    const result = await db.query(
      'INSERT INTO users (firebase_uid, user_email, user_name, user_phone, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *',
      [firebase_uid, user_email, user_name, user_phone, role]
    );
    
    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register admin',
      error: error.message
    });
  }
});
```

### 2. สมัครด้วย Google

#### Frontend Flow:
```typescript
// src/app/components/adregister/adregister.component.ts
async registerWithGoogle() {
  try {
    // ใช้ AuthService เพื่อให้มีการสร้างข้อมูลใน PostgreSQL
    const result = await this.authService.loginWithGoogle();
    
    if (result) {
      console.log('✅ Google admin registration successful with PostgreSQL data:', result);
      this.notificationService.showNotification('success', 'สมัครแอดมินสำเร็จ!', 'ยินดีต้อนรับ! ข้อมูลแอดมินของคุณถูกสร้างในระบบแล้ว', true, 'ไปหน้า Admin', () => {
        this.router.navigate(['/adminmain']);
      });
    } else {
      throw new Error('No response from backend');
    }
  } catch (err: any) {
    console.error('Google sign-in error:', err);
    this.notificationService.showNotification('error', 'Google Sign-in ล้มเหลว', 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้');
  }
}
```

#### Backend API: `POST /api/auth/google-login`
```javascript
// Backend จะรับ Firebase ID token และสร้างข้อมูลใน PostgreSQL
app.post('/api/auth/google-login', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // สร้าง username จาก email
    const username = decodedToken.email.split('@')[0];
    
    // ตรวจสอบว่ามี user อยู่แล้วหรือไม่
    const existingUser = await db.query(
      'SELECT * FROM users WHERE firebase_uid = $1 OR user_email = $2',
      [decodedToken.uid, decodedToken.email]
    );
    
    if (existingUser.rows.length > 0) {
      // อัปเดตข้อมูลที่มีอยู่
      const result = await db.query(
        'UPDATE users SET updated_at = NOW() WHERE firebase_uid = $1 RETURNING *',
        [decodedToken.uid]
      );
      
      return res.json({
        success: true,
        message: 'User updated successfully',
        user: result.rows[0]
      });
    } else {
      // สร้าง user ใหม่
      const result = await db.query(
        'INSERT INTO users (user_name, user_email, user_phone, role, firebase_uid, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *',
        [username, decodedToken.email, null, 'admin', decodedToken.uid]
      );
      
      return res.json({
        success: true,
        message: 'User created successfully',
        user: result.rows[0]
      });
    }
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({
      success: false,
      message: 'Google login failed',
      error: error.message
    });
  }
});
```

## 📊 ข้อมูลที่จะถูกสร้างใน PostgreSQL

### สำหรับ Admin Registration (ทั้ง 2 แบบ):

| Field | Value | Description |
|-------|-------|-------------|
| `userid` | `SERIAL PRIMARY KEY` | ID หลัก (Auto Increment) |
| `user_name` | `username` หรือ `email.split('@')[0]` | Username |
| `user_email` | `email` | อีเมล |
| `user_phone` | `phoneNumber` หรือ `NULL` | เบอร์โทรศัพท์ |
| `role` | `'admin'` | บทบาทเป็น admin |
| `created_at` | `NOW()` | วันที่สร้าง |
| `updated_at` | `NOW()` | วันที่อัปเดต |
| `firebase_uid` | `user.uid` | Firebase User ID |

### ตัวอย่างข้อมูลที่สร้าง:

#### สมัครแบบปกติ:
```json
{
  "userid": 1,
  "user_name": "admin_user",
  "user_email": "admin@example.com",
  "user_phone": "0812345678",
  "role": "admin",
  "created_at": "2025-01-26T10:30:00.000Z",
  "updated_at": "2025-01-26T10:30:00.000Z",
  "firebase_uid": "abc123def456"
}
```

#### สมัครด้วย Google:
```json
{
  "userid": 2,
  "user_name": "admin",
  "user_email": "admin@gmail.com",
  "user_phone": null,
  "role": "admin",
  "created_at": "2025-01-26T10:30:00.000Z",
  "updated_at": "2025-01-26T10:30:00.000Z",
  "firebase_uid": "def456ghi789"
}
```

## 🔄 การทำงานของระบบ

### Flow การทำงาน:

#### สมัครแบบปกติ:
1. **กรอกข้อมูล** → Username, Email, Password, Phone
2. **สร้าง Firebase user** → createUserWithEmailAndPassword
3. **ส่งอีเมลยืนยัน** → sendEmailVerification
4. **ส่งข้อมูลไป backend** → POST /api/auth/register
5. **สร้างข้อมูลใน PostgreSQL** → role = 'admin'
6. **เข้าสู่ระบบสำเร็จ** → ไปยัง /adminmain

#### สมัครด้วย Google:
1. **กดปุ่ม "Register With Google"** → เปิด Google OAuth popup
2. **เลือกบัญชี Google** → อนุญาตการเข้าถึง
3. **Firebase ส่ง ID token** → กลับมา
4. **ส่ง token ไป backend** → POST /api/auth/google-login
5. **สร้างข้อมูลใน PostgreSQL** → role = 'admin'
6. **เข้าสู่ระบบสำเร็จ** → ไปยัง /adminmain

## 🎯 ข้อแตกต่าง

| Aspect | สมัครแบบปกติ | สมัครด้วย Google |
|--------|-------------|------------------|
| **ข้อมูลที่กรอก** | Username, Email, Password, Phone | ไม่ต้องกรอก |
| **Phone Number** | มีค่า | NULL |
| **Email Verification** | ต้องยืนยัน | ไม่ต้องยืนยัน |
| **Backend API** | `/api/auth/register` | `/api/auth/google-login` |
| **Username** | กำหนดเอง | จาก email (ลบ @gmail.com) |
| **Role** | `'admin'` | `'admin'` |
| **Redirect** | `/adminmain` | `/adminmain` |

## 🎉 ผลลัพธ์

**ตอนนี้ Admin Registration ทั้ง 2 แบบจะ:**
- ✅ **สร้างข้อมูลใน PostgreSQL** อัตโนมัติ
- ✅ **กำหนด role เป็น 'admin'** 
- ✅ **เข้าสู่ระบบสำเร็จ** และไปยังหน้า admin
- ✅ **รองรับทั้ง Email/Password และ Google**
- ✅ **ใช้ระบบ authentication เดียวกัน**

**ระบบ Admin Registration ที่สมบูรณ์พร้อมใช้งานแล้วครับ!** 🎉✨
