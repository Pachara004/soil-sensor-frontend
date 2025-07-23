import { Injectable } from '@angular/core';
import { Database, ref, get, set, child } from '@angular/fire/database';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private db: Database) {}

  /**
   * ✅ Login User
   * ดึงข้อมูลจาก path: users/{username}
   */
  async login(username: string, password: string): Promise<any> {
    const dbRef = ref(this.db);
    const snapshot = await get(child(dbRef, `users/${username}`));
    if (snapshot.exists()) {
      const data = snapshot.val();
      if (data.password === password) {
        return data; // สำเร็จ → ส่งข้อมูล user กลับไป
      } else {
        throw new Error('รหัสผ่านไม่ถูกต้อง');
      }
    } else {
      throw new Error('ไม่พบผู้ใช้');
    }
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
