import { Injectable } from '@angular/core';
import { Database, ref, get, set, child } from '@angular/fire/database';
import {
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from '@angular/fire/auth';

interface UserData {
  uid: string;
  email: string;
  username: string;
  fullName: string;
  phoneNumber: string;
  createdAt: number;
  emailVerified: boolean;
  type?: string;
  provider?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private db: Database, private auth: Auth) {}

  async login(email: string, password: string): Promise<any> {
    try {
      // 1. Authenticate กับ Firebase Auth
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
      const uid = user.uid;

      // 2. ค้นหาข้อมูลผู้ใช้ใน Realtime Database
      const dbRef = ref(this.db);
      const usersRef = child(dbRef, 'users');
      const snapshot = await get(usersRef);
      
      if (snapshot.exists()) {
        const allUsers = snapshot.val();
        let userData = null;
        let username = null;

        // ค้นหาผู้ใช้ที่มี uid ตรงกัน
        for (const [key, value] of Object.entries(allUsers)) {
          if ((value as any).uid === uid) {
            userData = value as any;
            username = key;
            break;
          }
        }

        if (!userData) {
          throw new Error('ไม่พบข้อมูลผู้ใช้ในระบบ');
        }

        // ตรวจสอบการยืนยันอีเมล
        if (userData.emailVerified !== true) {
          throw new Error('กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
        }

        // กำหนด type ถ้าไม่มี (default เป็น user)
        const userType = userData.type || 'user';

        const returnData = {
          uid: userData.uid,
          username: userData.username || username,
          email: userData.email,
          fullName: userData.fullName,
          phoneNumber: userData.phoneNumber,
          type: userType,
          emailVerified: userData.emailVerified
        };

        return returnData;
      } else {
        throw new Error('ไม่พบข้อมูลผู้ใช้ในระบบ');
      }
    } catch (err: any) {
      console.error('ข้อผิดพลาดในการล็อกอิน:', err);
      
      // แปลง Firebase Auth errors เป็นภาษาไทย
      if (err.code === 'auth/user-not-found') {
        throw new Error('ไม่พบผู้ใช้นี้ในระบบ');
      } else if (err.code === 'auth/wrong-password') {
        throw new Error('รหัสผ่านไม่ถูกต้อง');
      } else if (err.code === 'auth/invalid-email') {
        throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
      } else if (err.code === 'auth/too-many-requests') {
        throw new Error('มีการพยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ภายหลัง');
      }
      
      throw err;
    }
  }

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(this.auth, provider);
      const googleUser = result.user;
      const uid = googleUser.uid;

      // ตรวจสอบว่ามีผู้ใช้อยู่แล้วหรือไม่
      const dbRef = ref(this.db);
      const usersRef = child(dbRef, 'users');
      const snapshot = await get(usersRef);

      let userData = null;
      let username = null;

      if (snapshot.exists()) {
        const allUsers = snapshot.val();
        
        // ค้นหาผู้ใช้ที่มี uid ตรงกัน
        for (const [key, value] of Object.entries(allUsers)) {
          if ((value as any).uid === uid) {
            userData = value as any;
            username = key;
            break;
          }
        }
      }

      if (!userData) {
        // สร้างผู้ใช้ใหม่
        username = this.sanitizeUsername(
          googleUser.displayName || googleUser.email?.split('@')[0] || `user${Date.now()}`
        );

        // ตรวจสอบว่า username ซ้ำหรือไม่
        const finalUsername = await this.getUniqueUsername(username);

        userData = {
          uid: uid,
          email: googleUser.email || '',
          username: finalUsername,
          fullName: googleUser.displayName || '',
          phoneNumber: '',
          createdAt: Date.now(),
          emailVerified: true,
          type: 'user',
          provider: 'google'
        };

        // บันทึกข้อมูลผู้ใช้ใหม่
        await set(ref(this.db, `users/${finalUsername}`), userData);
        username = finalUsername;
      }

      return {
        uid: userData.uid,
        username: userData.username || username,
        email: userData.email,
        fullName: userData.fullName,
        type: userData.type || 'user'
      };
    } catch (error: any) {
      console.error('ข้อผิดพลาดในการล็อกอินด้วย Google:', error);
      throw new Error('เข้าสู่ระบบด้วย Google ล้มเหลว');
    }
  }

  private sanitizeUsername(username: string): string {
    return username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);
  }

  private async getUniqueUsername(baseUsername: string): Promise<string> {
    let username = baseUsername;
    let counter = 1;

    while (true) {
      const snapshot = await get(ref(this.db, `users/${username}`));
      if (!snapshot.exists()) {
        return username;
      }
      username = `${baseUsername}${counter}`;
      counter++;
    }
  }

  // ฟังก์ชันเสริม
  async checkEmailExists(email: string): Promise<boolean> {
    const dbRef = ref(this.db);
    const usersRef = child(dbRef, 'users');
    const snapshot = await get(usersRef);
    
    if (snapshot.exists()) {
      const allUsers = snapshot.val();
      for (const userData of Object.values(allUsers)) {
        if ((userData as any).email === email) {
          return true;
        }
      }
    }
    return false;
  }

  async checkUsernameExists(username: string): Promise<boolean> {
    const snapshot = await get(ref(this.db, `users/${username}`));
    return snapshot.exists();
  }

  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('admin');
    return this.auth.signOut();
  }
}