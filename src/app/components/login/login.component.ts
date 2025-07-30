import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../service/auth.service';
import { Database, ref, get } from '@angular/fire/database'; // เพิ่มการใช้ Database

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatProgressSpinnerModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  email = '';
  password = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private database: Database // เพิ่ม Database
  ) {}

  async loginuser(email: string, password: string, event: Event) {
    event.preventDefault();

    if (!email || !password) {
      alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    try {
      const userCredential = await this.auth.login(email, password); // สมมติว่า login คืน userCredential
      const user = userCredential.user; // ใช้ user จาก Firebase Auth

      // ตรวจสอบ emailVerified จาก Realtime Database
      const dbRef = ref(this.database, `users/${user.uid}/emailVerified`);
      const snapshot = await get(dbRef);
      const isEmailVerified = snapshot.exists() && snapshot.val() === true;

      if (isEmailVerified) {
        if (userCredential.type === 'user') {
          localStorage.setItem('user', JSON.stringify(userCredential));
          this.router.navigate(['main']);
        } else if (userCredential.type === 'admin') {
          localStorage.setItem('admin', JSON.stringify(userCredential));
          this.router.navigate(['adminmain']);
        } else {
          alert('ไม่พบสิทธิ์ผู้ใช้');
        }
      } else {
        alert('กรุณายืนยันอีเมลก่อนล็อกอิน');
        // await this.auth.logout(); // สมมติมีฟังก์ชัน logout
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      this.email = '';
      this.password = '';
    }
  }

  async loginWithGoogle() {
    try {
      const user = await this.auth.loginWithGoogle();
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
        this.router.navigate(['main']);
      }
    } catch (error: any) {
      console.error(error);
      alert('Login with Google failed.');
    }
  }

  register() {
    this.router.navigate(['/register']);
  }

  goToForgotPassword() {
    this.router.navigate(['/forgotpass']);
  }
}