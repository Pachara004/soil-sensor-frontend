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

  constructor(private auth: AuthService, private router: Router) {}

  async loginuser(username: string, password: string, event: Event) {
    event.preventDefault();

    if (!username || !password) {
      alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }


    try {
      const user = await this.auth.login(username, password);

      if (user.type === 'user') {
        localStorage.setItem('user', JSON.stringify(user));
        this.router.navigate(['main']);
      } else if (user.type === 'admin') {
        localStorage.setItem('admin', JSON.stringify(user));
        this.router.navigate(['adminmain']);
      } else {
        alert('ไม่พบสิทธิ์ผู้ใช้');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      (event.target as HTMLFormElement).reset(); // รีเซ็ตฟอร์มหลังจากล็อกอิน 
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
