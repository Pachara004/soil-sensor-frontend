import { Injectable } from '@angular/core';
import { Database, ref, get, set, child } from '@angular/fire/database';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

interface UserData {
  email: string;
  name: string;
  password: string;
  phone: string;
  type: string;
  userID: string;
  username: string;
  emailVerified: boolean;
  devices?: { [key: string]: boolean };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  logout() {
    throw new Error('Method not implemented.');
  }
  constructor(private db: Database) {}

  /**
   * ✅ Login User
   * ดึงข้อมูลจาก path: users/{uid} โดยใช้ email และ password
   */
  async login(email: string, password: string): Promise<any> {
    const auth = getAuth();
    try {
      // ใช้ Firebase Authentication เพื่อตรวจสอบ email และ password
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const uid = user.uid;

      // ดึงข้อมูลจาก Realtime Database
      const dbRef = ref(this.db);
      const snapshot = await get(child(dbRef, `users/${uid}`));
      if (snapshot.exists()) {
        const data = snapshot.val();
        // ตรวจสอบ emailVerified
        if (data.emailVerified !== true) {
          throw new Error('กรุณายืนยันอีเมลก่อนล็อกอิน');
        }
        // เก็บข้อมูลใน localStorage
        localStorage.setItem('admin', JSON.stringify({ username: data.username, name: data.name || data.username }));
        localStorage.setItem('user', JSON.stringify({
          username: data.username,
          userID: data.userID || uid,
          name: data.name,
          email: data.email,
          phone: data.phone
        }));
        return data;
      } else {
        throw new Error('ไม่พบผู้ใช้');
      }
    } catch (err: any) {
      console.error('ข้อผิดพลาดในการล็อกอิน:', err);
      throw err;
    }
  }

  async loginWithGoogle() {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      const uid = googleUser.uid;

      const snapshot = await get(ref(this.db, `users/${uid}`));
      // สร้าง sanitizedUsername ก่อนใช้งาน
      const sanitizedUsername = this.sanitizePath(googleUser.displayName || googleUser.email?.split('@')[0] || `user_${Date.now()}`);
      if (!snapshot.exists()) {
        // สร้างข้อมูลผู้ใช้ใหม่หากยังไม่มี
        const userRef = ref(this.db, `users/${uid}`);
        await set(userRef, {
          userID: uid,
          username: sanitizedUsername,
          email: googleUser.email || '',
          name: googleUser.displayName || '',
          phone: '',
          type: 'user',
          emailVerified: true // ตั้งค่า emailVerified เป็น true สำหรับ Google Login
        });
        await set(ref(this.db, `usernames/${sanitizedUsername}`), true); // เก็บ username เพื่อตรวจสอบซ้ำ
      }

      const userData = {
        userID: uid,
        username: snapshot.exists() ? snapshot.val().username : sanitizedUsername,
        email: googleUser.email || '',
        type: 'user'
      };

      localStorage.setItem('user', JSON.stringify(userData));
      return userData;
    } catch (error: any) {
      console.error('ข้อผิดพลาดในการล็อกอินด้วย Google:', error);
      throw error;
    }
  }

  /**
   * ✅ Register User
   * เขียนข้อมูลใหม่ลง path: users/{uid}
   */
  async register(user: {
    name: string;
    username: string;
    password: string;
    email: string;
    phone?: string;
    type?: string;
  }): Promise<void> {
    const auth = getAuth();
    try {
      // สร้างผู้ใช้ใน Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
      const uid = userCredential.user.uid;

      // ตรวจสอบความซ้ำของ username
      const sanitizedUsername = this.sanitizePath(user.username);
      const dbRef = ref(this.db);
      const usernameSnapshot = await get(child(dbRef, `usernames/${sanitizedUsername}`));
      if (usernameSnapshot.exists()) {
        throw new Error('Username นี้มีอยู่แล้ว');
      }

      // บันทึกข้อมูลใน Realtime Database
      const userRef = ref(this.db, `users/${uid}`);
      const newUser: UserData = {
        userID: uid,
        name: user.name,
        username: sanitizedUsername,
        password: user.password,
        email: user.email,
        phone: user.phone || '',
        type: user.type || 'user',
        emailVerified: false // ตั้งค่าเริ่มต้นเป็น false รอการยืนยัน OTP
      };
      await set(userRef, newUser);
      await set(ref(this.db, `usernames/${sanitizedUsername}`), true); // เก็บ username เพื่อตรวจสอบซ้ำ

      return;
    } catch (err: any) {
      console.error('ข้อผิดพลาดในการสมัคร:', err);
      throw err;
    }
  }

  // ฟังก์ชันเพื่อทำให้ path ปลอดภัยโดยกำจัดตัวอักษรพิเศษ
  private sanitizePath(path: string): string {
    return path.replace(/[.#$[\]]/g, '_');
  }
}