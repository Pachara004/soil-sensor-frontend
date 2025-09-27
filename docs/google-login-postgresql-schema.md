# Google Login PostgreSQL Schema

## 📋 โครงสร้างข้อมูลที่จะถูกสร้างใน PostgreSQL

เมื่อผู้ใช้ login หรือ register ด้วย Google ระบบจะสร้างข้อมูลในตาราง `users` ด้วยโครงสร้างดังนี้:

### 🗃️ ตาราง `users`

| Field | Type | Description | Example Value |
|-------|------|-------------|---------------|
| `userid` | `SERIAL PRIMARY KEY` | ID หลักของตาราง (Auto Increment) | `1, 2, 3, ...` |
| `user_name` | `VARCHAR(255)` | ชื่อผู้ใช้ (จาก email ลบ @gmail.com) | `john.doe` |
| `user_email` | `VARCHAR(255) UNIQUE` | อีเมลจาก Google | `john.doe@gmail.com` |
| `user_phone` | `VARCHAR(20) NULL` | เบอร์โทรศัพท์ (NULL สำหรับ Google login) | `NULL` |
| `role` | `VARCHAR(50)` | บทบาทผู้ใช้ | `'user'` หรือ `'admin'` |
| `created_at` | `TIMESTAMP` | วันที่สร้าง | `2024-01-15 10:30:00` |
| `updated_at` | `TIMESTAMP` | วันที่อัปเดตล่าสุด | `2024-01-15 10:30:00` |
| `firebase_uid` | `VARCHAR(255) UNIQUE` | Firebase User ID | `abc123def456...` |

### 🔧 SQL Schema

```sql
CREATE TABLE users (
    userid SERIAL PRIMARY KEY,
    user_name VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) UNIQUE NOT NULL,
    user_phone VARCHAR(20) NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    firebase_uid VARCHAR(255) UNIQUE NOT NULL
);

-- Index สำหรับการค้นหา
CREATE INDEX idx_users_email ON users(user_email);
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_role ON users(role);
```

### 📝 ตัวอย่างข้อมูลที่ถูกสร้าง

เมื่อผู้ใช้ login ด้วย Google account: `john.doe@gmail.com`

```sql
INSERT INTO users (
    user_name,
    user_email,
    user_phone,
    role,
    created_at,
    updated_at,
    firebase_uid
) VALUES (
    'john.doe',                    -- จาก email ลบ @gmail.com
    'john.doe@gmail.com',          -- อีเมลจาก Google
    NULL,                          -- เบอร์โทรศัพท์เป็น NULL
    'user',                        -- บทบาทเป็น user
    CURRENT_TIMESTAMP,             -- วันที่สร้าง
    CURRENT_TIMESTAMP,             -- วันที่อัปเดต
    'abc123def456ghi789jkl012'     -- Firebase UID
);
```

### 🔄 Backend API Endpoint

**POST** `/api/auth/google-login`

**Request Body:**
```json
{
  "idToken": "firebase_id_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created/updated successfully",
  "user": {
    "userid": 1,
    "user_name": "john.doe",
    "user_email": "john.doe@gmail.com",
    "user_phone": null,
    "role": "user",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "firebase_uid": "abc123def456ghi789jkl012"
  }
}
```

### 🎯 Logic การทำงาน

1. **รับ Firebase ID Token** จาก frontend
2. **ตรวจสอบ Token** กับ Firebase Admin SDK
3. **ดึงข้อมูลผู้ใช้** จาก Google (email, displayName, etc.)
4. **สร้าง username** จาก email: `email.split('@')[0]`
5. **ตรวจสอบว่ามีผู้ใช้อยู่แล้วหรือไม่** ด้วย `firebase_uid`
6. **ถ้าไม่มี** → สร้างใหม่
7. **ถ้ามีแล้ว** → อัปเดต `updated_at`
8. **คืนข้อมูลผู้ใช้** กลับไปยัง frontend

### ⚠️ หมายเหตุ

- `user_phone` จะเป็น `NULL` เสมอสำหรับ Google login
- `user_name` จะถูกสร้างจาก email โดยลบ domain ออก
- `role` จะเป็น `'user'` สำหรับการ register ปกติ
- `role` จะเป็น `'admin'` สำหรับการ register admin
- `firebase_uid` จะเป็น unique key สำหรับเชื่อมโยงกับ Firebase
