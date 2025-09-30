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
      
      // ตรวจสอบ error code และแสดงข้อความที่เฉพาะเจาะจง
      let errorTitle = 'เข้าสู่ระบบไม่สำเร็จ';
      let errorMessage = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
      
      if (err?.code) {
        switch (err.code) {
          case 'auth/user-not-found':
            errorTitle = 'ไม่พบผู้ใช้';
            errorMessage = 'ไม่พบผู้ใช้ที่ใช้อีเมลนี้ กรุณาตรวจสอบอีเมลอีกครั้ง';
            break;
          case 'auth/wrong-password':
            errorTitle = 'รหัสผ่านผิด';
            errorMessage = 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านอีกครั้ง';
            break;
          case 'auth/invalid-email':
            errorTitle = 'อีเมลไม่ถูกต้อง';
            errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง กรุณากรอกอีเมลที่ถูกต้อง';
            break;
          case 'auth/user-disabled':
            errorTitle = 'บัญชีถูกปิดใช้งาน';
            errorMessage = 'บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
            break;
          case 'auth/too-many-requests':
            errorTitle = 'พยายามเข้าสู่ระบบมากเกินไป';
            errorMessage = 'คุณพยายามเข้าสู่ระบบมากเกินไป กรุณารอสักครู่แล้วลองใหม่';
            break;
          case 'auth/network-request-failed':
            errorTitle = 'เชื่อมต่ออินเทอร์เน็ตไม่ได้';
            errorMessage = 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อ';
            break;
          case 'auth/invalid-credential':
            errorTitle = 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง';
            errorMessage = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบข้อมูลอีกครั้ง';
            break;
          default:
            // ตรวจสอบ error message เพื่อหาข้อมูลเพิ่มเติม
            if (err?.message) {
              if (err.message.includes('password') || err.message.includes('รหัสผ่าน')) {
                errorTitle = 'รหัสผ่านผิด';
                errorMessage = 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านอีกครั้ง';
              } else if (err.message.includes('email') || err.message.includes('อีเมล')) {
                errorTitle = 'อีเมลไม่ถูกต้อง';
                errorMessage = 'อีเมลไม่ถูกต้อง กรุณาตรวจสอบอีเมลอีกครั้ง';
              } else if (err.message.includes('user') || err.message.includes('ผู้ใช้')) {
                errorTitle = 'ไม่พบผู้ใช้';
                errorMessage = 'ไม่พบผู้ใช้ที่ใช้อีเมลนี้ กรุณาตรวจสอบอีเมลอีกครั้ง';
              } else {
                errorMessage = err.message;
              }
            }
            break;
        }
      } else if (err?.message) {
        // ตรวจสอบ error message เพื่อหาข้อมูลเพิ่มเติม
        if (err.message.includes('password') || err.message.includes('รหัสผ่าน')) {
          errorTitle = 'รหัสผ่านผิด';
          errorMessage = 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านอีกครั้ง';
        } else if (err.message.includes('email') || err.message.includes('อีเมล')) {
          errorTitle = 'อีเมลไม่ถูกต้อง';
          errorMessage = 'อีเมลไม่ถูกต้อง กรุณาตรวจสอบอีเมลอีกครั้ง';
        } else if (err.message.includes('user') || err.message.includes('ผู้ใช้')) {
          errorTitle = 'ไม่พบผู้ใช้';
          errorMessage = 'ไม่พบผู้ใช้ที่ใช้อีเมลนี้ กรุณาตรวจสอบอีเมลอีกครั้ง';
        } else {
          errorMessage = err.message;
        }
      }
      
      this.notificationService.showNotification('error', errorTitle, errorMessage);
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
      
      // ตรวจสอบ error code และแสดงข้อความที่เฉพาะเจาะจง
      let errorTitle = 'Google Sign-in ล้มเหลว';
      let errorMessage = 'เข้าสู่ระบบด้วย Google ล้มเหลว';
      
      // ตรวจสอบ error code ที่เกี่ยวข้องกับการยกเลิกก่อน
      if (error?.code === 'auth/popup-closed-by-user' || 
          error?.code === 'auth/cancelled-popup-request') {
        errorTitle = 'ยกเลิกการเข้าสู่ระบบ';
        errorMessage = 'คุณได้ยกเลิกการเข้าสู่ระบบด้วย Google';
      } else if (error?.message && (
          error.message.includes('popup') ||
          error.message.includes('cancelled') ||
          error.message.includes('ยกเลิก') ||
          error.message.includes('closed') ||
          error.message.includes('ปิด')
        )) {
        errorTitle = 'ยกเลิกการเข้าสู่ระบบ';
        errorMessage = 'คุณได้ยกเลิกการเข้าสู่ระบบด้วย Google';
      } else if (error?.code) {
        switch (error.code) {
          case 'auth/popup-blocked':
            errorTitle = 'ป๊อปอัพถูกบล็อก';
            errorMessage = 'ป๊อปอัพถูกบล็อกโดยเบราว์เซอร์ กรุณาอนุญาตป๊อปอัพแล้วลองใหม่';
            break;
          case 'auth/account-exists-with-different-credential':
            errorTitle = 'บัญชีมีอยู่แล้ว';
            errorMessage = 'มีบัญชีอื่นที่ใช้อีเมลนี้อยู่แล้ว กรุณาใช้วิธีเข้าสู่ระบบอื่น';
            break;
          case 'auth/operation-not-allowed':
            errorTitle = 'ไม่สามารถเข้าสู่ระบบได้';
            errorMessage = 'การเข้าสู่ระบบด้วย Google ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
            break;
          case 'auth/network-request-failed':
            errorTitle = 'เชื่อมต่ออินเทอร์เน็ตไม่ได้';
            errorMessage = 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อ';
            break;
          default:
            if (error?.message) {
              errorMessage = error.message;
            }
            break;
        }
      } else if (error?.message) {
        if (error.message.includes('popup') || error.message.includes('ป๊อปอัพ')) {
          errorTitle = 'ป๊อปอัพถูกบล็อก';
          errorMessage = 'ป๊อปอัพถูกบล็อกโดยเบราว์เซอร์ กรุณาอนุญาตป๊อปอัพแล้วลองใหม่';
        } else {
          errorMessage = error.message;
        }
      }
      
      this.notificationService.showNotification('error', errorTitle, errorMessage);
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
