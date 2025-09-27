import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Auth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { NotificationService } from '../../service/notification.service';
import { AuthService } from '../../service/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatProgressSpinnerModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  isLoading = false;
  showPassword = false;

  constructor(
    private http: HttpClient, 
    private router: Router, 
    private auth: Auth,
    private notificationService: NotificationService,
    private authService: AuthService
  ) {}

  async loginuser(email: string, password: string, event: Event) {
    event.preventDefault();

    if (!email || !password) {
      this.notificationService.showNotification('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.notificationService.showNotification('error', 'อีเมลไม่ถูกต้อง', 'กรุณากรอกอีเมลที่ถูกต้อง');
      return;
    }

    this.isLoading = true;

    try {
      await signInWithEmailAndPassword(this.auth, email, password);
      const user = this.auth.currentUser;
      if (!user) throw new Error('ไม่พบผู้ใช้หลังล็อกอิน');

      // Store minimal client session marker if needed
      localStorage.setItem('user', JSON.stringify({ email: user.email }));

      // Route: if backend provides role later, this can be refined. For now, default to /main
      this.router.navigate(['/main']);
    } catch (err: any) {
      console.error('❌ Login error:', err);
      const msg = err?.message || 'เข้าสู่ระบบล้มเหลว';
      this.notificationService.showNotification('error', 'เข้าสู่ระบบไม่สำเร็จ', msg);
    } finally {
      this.isLoading = false;
      if (this.isLoading === false) {
        this.password = '';
      }
    }
  }

  async loginWithGoogle() {
    this.isLoading = true;

    try {
      // ใช้ AuthService เพื่อให้มีการสร้างข้อมูลใน PostgreSQL
      const result = await this.authService.loginWithGoogle();
      
      if (result) {
        console.log('✅ Google login successful with PostgreSQL data:', result);
        this.notificationService.showNotification('success', 'เข้าสู่ระบบสำเร็จ', 'ยินดีต้อนรับ!');
        this.router.navigate(['/main']);
      } else {
        throw new Error('No response from backend');
      }
    } catch (error: any) {
      console.error('❌ Google login error:', error);
      this.notificationService.showNotification('error', 'Google Sign-in ล้มเหลว', 'เข้าสู่ระบบด้วย Google ล้มเหลว');
    } finally {
      this.isLoading = false;
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  register() {
    this.router.navigate(['/register']);
  }

  goToForgotPassword() {
    this.router.navigate(['/forgotpass']);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
