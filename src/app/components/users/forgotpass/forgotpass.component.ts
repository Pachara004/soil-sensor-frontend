import { Component, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { Location, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Database, ref, get, child, update } from '@angular/fire/database';
import { Auth, updatePassword, signInWithEmailAndPassword } from '@angular/fire/auth';

@Component({
  selector: 'app-forgotpass',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forgotpass.component.html',
  styleUrl: './forgotpass.component.scss'
})
export class ForgotpassComponent {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef>;

  step = 1; // 1: อีเมล, 2: OTP, 3: รหัสผ่านใหม่
  email = '';
  otp = ['', '', '', '', '', ''];
  generatedOtp = '';
  newPassword = '';
  confirmPassword = '';
  
  isLoading = false;
  countdown = 0;
  showNewPassword = false;
  showConfirmPassword = false;
  passwordMismatch = false;
  
  passwordStrength = { width: 0, class: '', text: '' };
  userExists = false;

  constructor(
    private router: Router,
    private location: Location,
    private http: HttpClient,
    private database: Database,
    private auth: Auth
  ) {}

  getTitle(): string {
    switch (this.step) {
      case 1: return 'ลืมรหัสผ่าน';
      case 2: return 'ยืนยัน OTP';
      case 3: return 'ตั้งรหัสผ่านใหม่';
      default: return 'ลืมรหัสผ่าน';
    }
  }

  goBack() {
    if (this.step > 1) {
      this.step--;
      this.resetStepData();
    } else {
      this.location.back();
    }
  }

  private resetStepData() {
    if (this.step === 1) {
      this.otp = ['', '', '', '', '', ''];
      this.generatedOtp = '';
    } else if (this.step === 2) {
      this.newPassword = '';
      this.confirmPassword = '';
      this.passwordMismatch = false;
    }
  }

  async sendOtp() {
    if (!this.email || !this.isValidEmail(this.email)) {
      alert('กรุณากรอกอีเมลที่ถูกต้อง');
      return;
    }

    this.isLoading = true;

    try {
      // ตรวจสอบว่าอีเมลมีอยู่ในระบบหรือไม่
      const userExists = await this.checkEmailExists(this.email);
      if (!userExists) {
        alert('ไม่พบอีเมลนี้ในระบบ');
        return;
      }

      this.userExists = true;
      this.generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

      // ส่ง OTP ผ่าน EmailJS
      await this.sendOtpEmail(this.email, this.generatedOtp);
      
      alert('OTP ถูกส่งไปยังอีเมลของคุณแล้ว');
      this.step = 2;
      this.startCountdown();

    } catch (error) {
      console.error('Error sending OTP:', error);
      alert('เกิดข้อผิดพลาดในการส่ง OTP กรุณาลองใหม่อีกครั้ง');
    } finally {
      this.isLoading = false;
    }
  }

  private async checkEmailExists(email: string): Promise<boolean> {
    try {
      const dbRef = ref(this.database);
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
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  }

  private async sendOtpEmail(email: string, otp: string): Promise<void> {
    const emailJSData = {
      service_id: 'service_r2esno6',
      template_id: 'template_yvuux1f', // สร้าง template ใหม่สำหรับ password reset
      user_id: '8ypHiGBky5C_KnLx8',
      template_params: {
        to_email: email,
        to_name: 'ผู้ใช้งาน',
        otp_code: otp,
        from_name: 'ระบบรีเซ็ตรหัสผ่าน'
      }
    };

    try {
      const response = await firstValueFrom(
        this.http.post('https://api.emailjs.com/api/v1.0/email/send', emailJSData, {
          responseType: 'text'
        })
      );
      console.log('Email sent successfully:', response);
    } catch (error: any) {
      if (error.status === 200) {
        console.log('Email sent successfully despite error format');
        return;
      }
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async resendOtp() {
    await this.sendOtp();
  }

  private startCountdown() {
    this.countdown = 60;
    const timer = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(timer);
      }
    }, 1000);
  }

  moveToNext(event: any, index: number) {
    const value = event.target.value;
    if (value && index < 5) {
      const nextInput = this.otpInputs.toArray()[index + 1];
      if (nextInput) {
        nextInput.nativeElement.focus();
      }
    }
  }

  onKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace' && !this.otp[index] && index > 0) {
      const prevInput = this.otpInputs.toArray()[index - 1];
      if (prevInput) {
        prevInput.nativeElement.focus();
      }
    }
  }

  isOtpComplete(): boolean {
    return this.otp.every(digit => digit.length === 1);
  }

  verifyOtp() {
    const enteredOtp = this.otp.join('');
    if (enteredOtp === this.generatedOtp) {
      this.step = 3;
    } else {
      alert('OTP ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
    }
  }

  toggleNewPassword() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  checkPasswordStrength() {
    const password = this.newPassword;
    let strength = 0;
    let text = '';
    let className = '';

    if (password.length >= 6) strength += 25;
    if (password.match(/[a-z]/)) strength += 25;
    if (password.match(/[A-Z]/)) strength += 25;
    if (password.match(/[0-9]/)) strength += 25;

    if (strength < 50) {
      text = 'อ่อน';
      className = 'weak';
    } else if (strength < 75) {
      text = 'ปานกลาง';
      className = 'medium';
    } else {
      text = 'แข็งแรง';
      className = 'strong';
    }

    this.passwordStrength = { width: strength, class: className, text: text };
    
    // ตรวจสอบรหัสผ่านตรงกันหรือไม่
    this.passwordMismatch = this.confirmPassword !== '' && this.newPassword !== this.confirmPassword;
  }

  canResetPassword(): boolean {
    return this.newPassword.length >= 6 && 
           this.newPassword === this.confirmPassword && 
           !this.passwordMismatch;
  }

  async resetPassword() {
    if (!this.canResetPassword()) {
      if (this.newPassword.length < 6) {
        alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      } else if (this.newPassword !== this.confirmPassword) {
        alert('รหัสผ่านไม่ตรงกัน');
      }
      return;
    }

    this.isLoading = true;

    try {
      // หาผู้ใช้ในฐานข้อมูล
      const dbRef = ref(this.database);
      const usersRef = child(dbRef, 'users');
      const snapshot = await get(usersRef);
      
      if (snapshot.exists()) {
        const allUsers = snapshot.val();
        let userKey = null;
        let userData = null;

        // ค้นหาผู้ใช้ที่มีอีเมลตรงกัน
        for (const [key, value] of Object.entries(allUsers)) {
          if ((value as any).email === this.email) {
            userKey = key;
            userData = value as any;
            break;
          }
        }

        if (userKey && userData) {
          try {
            // ลอง sign in ด้วยรหัสผ่านเก่าก่อน (เพื่อให้ Firebase Auth อัพเดทได้)
            // ในระบบจริงควรใช้ Admin SDK หรือ Cloud Function
            
            // อัพเดทรหัสผ่านใน Realtime Database (เก็บ hash)
            const hashedPassword = this.simpleHash(this.newPassword); // ใช้การ hash แบบง่าย
            
            await update(ref(this.database, `users/${userKey}`), {
              passwordHash: hashedPassword,
              lastPasswordReset: Date.now()
            });

            alert('เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
            this.router.navigate(['/']);
            
          } catch (authError) {
            console.error('Auth error:', authError);
            // ถ้า Firebase Auth ล้มเหลว ให้อัพเดทแค่ในฐานข้อมูล
            const hashedPassword = this.simpleHash(this.newPassword);
            
            await update(ref(this.database, `users/${userKey}`), {
              passwordHash: hashedPassword,
              lastPasswordReset: Date.now()
            });

            alert('เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
            this.router.navigate(['/']);
          }
        } else {
          throw new Error('ไม่พบข้อมูลผู้ใช้');
        }
      }

    } catch (error: any) {
      console.error('Reset password error:', error);
      alert('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน: ' + (error.message || 'Unknown error'));
    } finally {
      this.isLoading = false;
    }
  }

  private simpleHash(password: string): string {
    // Hash แบบง่ายๆ (ในระบบจริงควรใช้ bcrypt หรือ library อื่น)
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}