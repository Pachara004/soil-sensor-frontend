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
  constructor(private auth: AuthService, private router: Router) {}

  async loginuser(email: string, password: string, event: Event) {
    event.preventDefault();

    if (!email || !password) {
      alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }


    try {
      const user = await this.auth.login(email, password);

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
