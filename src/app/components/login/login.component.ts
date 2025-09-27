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
import { Constants } from '../../config/constants';

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
    private authService: AuthService,
    private constants: Constants
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

      // ✅ ตรวจสอบ role ของผู้ใช้จาก backend
      const userRole = await this.getUserRoleFromBackend(user.uid);
      console.log('👤 User role from login:', userRole);

      // ✅ เก็บข้อมูลผู้ใช้ใน localStorage
      localStorage.setItem('user', JSON.stringify({ 
        email: user.email, 
        uid: user.uid,
        role: userRole 
      }));

      // ✅ Redirect ตาม role
      if (userRole === 'admin') {
        localStorage.setItem('admin', JSON.stringify({ 
          email: user.email, 
          uid: user.uid,
          role: userRole 
        }));
        this.router.navigate(['/adminmain']);
      } else {
        this.router.navigate(['/main']);
      }
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
        
        // ✅ ตรวจสอบ role จาก response
        const userRole = result.user?.role || result.role || 'user';
        console.log('👤 User role from Google login:', userRole);
        
        // ✅ เก็บข้อมูลผู้ใช้ใน localStorage
        localStorage.setItem('user', JSON.stringify({ 
          email: result.user?.user_email || result.user?.email,
          uid: result.user?.firebase_uid || result.user?.uid,
          role: userRole 
        }));
        
        // ✅ Redirect ตาม role
        if (userRole === 'admin') {
          localStorage.setItem('admin', JSON.stringify({ 
            email: result.user?.user_email || result.user?.email,
            uid: result.user?.firebase_uid || result.user?.uid,
            role: userRole 
          }));
          this.notificationService.showNotification('success', 'เข้าสู่ระบบสำเร็จ', 'ยินดีต้อนรับ Admin!');
          this.router.navigate(['/adminmain']);
        } else {
          this.notificationService.showNotification('success', 'เข้าสู่ระบบสำเร็จ', 'ยินดีต้อนรับ!');
          this.router.navigate(['/main']);
        }
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

  // ✅ ฟังก์ชันดึง role ของผู้ใช้จาก backend
  private async getUserRoleFromBackend(firebaseUid: string): Promise<string> {
    try {
      console.log('🔍 Getting user role from backend for UID:', firebaseUid);
      
      const response = await firstValueFrom(
        this.http.get(`${this.constants.API_ENDPOINT}/api/auth/user-role/${firebaseUid}`)
      ) as any;
      
      console.log('📊 Backend role response:', response);
      
      // ตรวจสอบ response และคืนค่า role
      if (response && response.role) {
        return response.role;
      } else if (response && response.user && response.user.role) {
        return response.user.role;
      } else {
        console.warn('⚠️ No role found in response, defaulting to user');
        return 'user';
      }
    } catch (error: any) {
      console.error('❌ Error getting user role from backend:', error);
      
      // ถ้าไม่สามารถดึง role ได้ ให้ default เป็น user
      console.warn('⚠️ Failed to get role from backend, defaulting to user');
      return 'user';
    }
  }
}
