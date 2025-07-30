import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../service/auth.service';

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
  isLoading = false;
  showPassword = false;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  async loginuser(email: string, password: string, event: Event) {
    event.preventDefault();

    if (!email || !password) {
      alert('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    if (!this.isValidEmail(email)) {
      alert('กรุณากรอกอีเมลที่ถูกต้อง');
      return;
    }

    this.isLoading = true;

    try {
      const userData = await this.auth.login(email, password);
      
      console.log('✅ Login successful:', userData);

      // เก็บข้อมูลใน localStorage ตาม type
      if (userData.type === 'admin') {
        localStorage.setItem('admin', JSON.stringify(userData));
        this.router.navigate(['/adminmain']);
      } else {
        localStorage.setItem('user', JSON.stringify(userData));
        this.router.navigate(['/main']);
      }

    } catch (err: any) {
      console.error('❌ Login error:', err);
      alert(err.message || 'เข้าสู่ระบบล้มเหลว');
    } finally {
      this.isLoading = false;
      // ล้างฟอร์มเมื่อมี error
      if (this.isLoading === false) {
        this.password = '';
      }
    }
  }

  async loginWithGoogle() {
    this.isLoading = true;
    
    try {
      const userData = await this.auth.loginWithGoogle();
      
      if (userData.type === 'user') {
        console.log('✅ Google login successful:', userData);
        localStorage.setItem('user', JSON.stringify(userData));
        this.router.navigate(['/main']);
      } else {
        localStorage.setItem('admin', JSON.stringify(userData));
        this.router.navigate(['/adminmain']);
      }
    } catch (error: any) {
      console.error('❌ Google login error:', error);
      alert('เข้าสู่ระบบด้วย Google ล้มเหลว');
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