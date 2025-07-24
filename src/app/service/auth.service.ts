import { Injectable } from '@angular/core';
import { Database, ref, get, set, child } from '@angular/fire/database';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

interface UserData {
  email: string;
  name: string;
  password: string;
  phone: string;
  type: string;
  userID: string;
  username: string;
  devices?: { [key: string]: boolean };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private db: Database) {}

  /**
   * ✅ Login User
   * ดึงข้อมูลจาก path: users/{username}
   */
  async login(username: string, password: string): Promise<any> {
    const dbRef = ref(this.db);
    try {
      const snapshot = await get(child(dbRef, `users/${username}`)); // เปลี่ยนเป็น users
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.password === password) {
          localStorage.setItem('admin', JSON.stringify({ username, name: data.name || username }));
          localStorage.setItem('user', JSON.stringify({
            username,
            userID: data.userID,
            name: data.name, // เพิ่ม name
            email: data.email,
            phone: data.phone
          }));
          return data;
        } else {
          throw new Error('รหัสผ่านไม่ถูกต้อง');
        }
      } else {
        throw new Error('ไม่พบผู้ใช้');
      }
    } catch (err) {
      console.error('ข้อผิดพลาดในการล็อกอิน:', err);
      throw err;
    }
  }
  async loginWithGoogle() {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();

    const result = await signInWithPopup(auth, provider);
    const googleUser = result.user;

    // ตรวจว่ามีใน DB ไหม
    const snapshot = await get(ref(this.db, `users/${googleUser.uid}`));
    if (!snapshot.exists()) {
      // ถ้ายังไม่มี ให้สร้างใน DB ด้วย
      const userRef = ref(this.db, `users/${googleUser.uid}`);
      await set(userRef, {
        userID: googleUser.uid,
        username: googleUser.displayName || '',
        email: googleUser.email || '',
        type: 'user'
      });
    }

    return {
      userID: googleUser.uid,
      username: googleUser.displayName || '',
      email: googleUser.email || '',
      type: 'user'
    };
  }
  /**
   * ✅ Register User
   * เขียนข้อมูลใหม่ลง path: users/{username}
   */
  async register(user: {
    name: string;
    username: string;
    password: string;
    email: string;
    phone?: string;
    type?: string;
  }): Promise<void> {
    const userRef = ref(this.db, `users/${user.username}`);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      throw new Error('Username นี้มีอยู่แล้ว');
    }

    const newUser = {
      userID: `U-${Date.now()}`,
      name: user.name,
      username: user.username,
      password: user.password,
      email: user.email,
      phone: user.phone || '',
      type: user.type || 'user',
    };

    return set(userRef, newUser);
  }
}
