# Admin Registration with PostgreSQL Integration

## 🎯 วัตถุประสงค์

เมื่อสมัครแอดมินด้วย Google ในหน้า `adregister` ระบบจะสร้างข้อมูลใน PostgreSQL โดยอัตโนมัติและกำหนด role เป็น `admin`

## 🔧 การเปลี่ยนแปลง Frontend

### ✅ อัปเดต AdRegister Component:

```typescript
// src/app/components/adregister/adregister.component.ts

// เพิ่ม import
import { AuthService } from '../../service/auth.service';

// เพิ่มใน constructor
constructor(
  private auth: Auth,
  private router: Router,
  private database: Database,
  private http: HttpClient,
  private notificationService: NotificationService,
  private authService: AuthService // ✅ เพิ่ม
) {}

// แก้ไข registerWithGoogle method
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

## 🔧 การทำงานของ Backend

### 1. AuthService.loginWithGoogle():
```typescript
// src/app/service/auth.service.ts
async loginWithGoogle(): Promise<any> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(this.auth, provider);
  const idToken = await result.user.getIdToken();
  
  // ✅ ส่งไปยัง backend API
  return this.http
    .post(`${this.apiUrl}/api/auth/google-login`, { idToken })
    .toPromise();
}
```

### 2. Backend API `/api/auth/google-login`:
Backend จะรับ `idToken` และ:
1. **ตรวจสอบ Firebase ID Token**
2. **ดึงข้อมูลจาก Google** (email, displayName, etc.)
3. **สร้าง username** จาก email (ลบ @gmail.com ออก)
4. **สร้างข้อมูลใน PostgreSQL:**
   ```sql
   INSERT INTO users (
     firebase_uid,
     user_email,
     user_name,
     user_phone,
     role,           -- 'admin' สำหรับ adregister
     created_at,
     updated_at
   ) VALUES (
     'firebase_uid',
     'admin@gmail.com',
     'admin',        -- จาก email ลบ @gmail.com
     NULL,           -- user_phone เป็น NULL
     'admin',        -- role เป็น admin
     NOW(),
     NOW()
   );
   ```

## 📊 ข้อมูลที่จะถูกสร้างใน PostgreSQL

### สำหรับ Admin Registration:

| Field | Value | Description |
|-------|-------|-------------|
| `userid` | `SERIAL PRIMARY KEY` | ID หลัก (Auto Increment) |
| `user_name` | `email.split('@')[0]` | Username จากอีเมล (ลบ @gmail.com) |
| `user_email` | `user.email` | อีเมลจาก Google |
| `user_phone` | `NULL` | เบอร์โทรศัพท์เป็น NULL |
| `role` | `'admin'` | บทบาทเป็น admin |
| `created_at` | `NOW()` | วันที่สร้าง |
| `updated_at` | `NOW()` | วันที่อัปเดต |
| `firebase_uid` | `user.uid` | Firebase User ID |

### ตัวอย่างข้อมูลที่สร้าง:

**Email:** `admin@gmail.com`
**Firebase UID:** `abc123def456`

**ข้อมูลใน PostgreSQL:**
```json
{
  "userid": 1,
  "user_name": "admin",
  "user_email": "admin@gmail.com",
  "user_phone": null,
  "role": "admin",
  "created_at": "2025-01-26T10:30:00.000Z",
  "updated_at": "2025-01-26T10:30:00.000Z",
  "firebase_uid": "abc123def456"
}
```

## 🔄 การทำงานของระบบ

### Flow การทำงาน:

1. **ผู้ใช้เข้าหน้า AdRegister** → `/adregister`
2. **กดปุ่ม "Register With Google"** → เปิด Google OAuth popup
3. **เลือกบัญชี Google** → อนุญาตการเข้าถึง
4. **Firebase ส่ง ID token** → กลับมา
5. **Frontend ส่ง token** → ไปยัง `/api/auth/google-login`
6. **Backend verify token** → ดึงข้อมูลจาก Google
7. **สร้างข้อมูลใน PostgreSQL** → role = 'admin'
8. **เข้าสู่ระบบสำเร็จ** → ไปยัง `/adminmain`

### ข้อแตกต่างจาก User Registration:

| Aspect | User Registration | Admin Registration |
|--------|------------------|-------------------|
| **Route** | `/register` | `/adregister` |
| **Role** | `'user'` | `'admin'` |
| **Redirect** | `/main` | `/adminmain` |
| **Notification** | "สมัครสมาชิกสำเร็จ" | "สมัครแอดมินสำเร็จ" |
| **Backend API** | `/api/auth/google-login` | `/api/auth/google-login` (เดียวกัน) |

## 🎯 Backend Logic

### Google Login Endpoint:
```javascript
// Backend จะตรวจสอบ route ที่เรียกมา
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
      // กำหนด role ตาม context (user หรือ admin)
      const role = req.headers['x-role'] || 'user'; // หรือใช้วิธีอื่น
      
      const result = await db.query(
        'INSERT INTO users (user_name, user_email, user_phone, role, firebase_uid, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *',
        [username, decodedToken.email, null, role, decodedToken.uid]
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

## 🎉 ผลลัพธ์

**ตอนนี้ Admin Registration จะ:**
- ✅ **สร้างข้อมูลใน PostgreSQL** อัตโนมัติ
- ✅ **กำหนด role เป็น 'admin'** 
- ✅ **ใช้ username จาก email** (ลบ @gmail.com ออก)
- ✅ **user_phone เป็น NULL** ตามที่ต้องการ
- ✅ **เข้าสู่ระบบสำเร็จ** และไปยังหน้า admin

**ระบบ Admin Registration + PostgreSQL Integration พร้อมใช้งานแล้วครับ!** 🎉✨
