import { Component, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { Location, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Database, ref, get, child, update } from '@angular/fire/database';
import { Auth, signInWithEmailAndPassword, sendPasswordResetEmail } from '@angular/fire/auth';

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
  otpInputsArray = Array(6).fill('');
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
      this.clearOtp();
      this.generatedOtp = '';
    } else if (this.step === 2) {
      this.newPassword = '';
      this.confirmPassword = '';
      this.passwordMismatch = false;
      this.passwordStrength = { width: 0, class: '', text: '' };
    }
  }
private focusNextInput(index: number) {
  if (index < this.otp.length) {
    setTimeout(() => {
      const nextInput = this.otpInputs.toArray()[index];
      if (nextInput) {
        nextInput.nativeElement.focus();
      }
    }, 10);
  }
}
private focusPrevInput(index: number) {
  if (index >= 0) {
    setTimeout(() => {
      const prevInput = this.otpInputs.toArray()[index];
      if (prevInput) {
        prevInput.nativeElement.value = '';
        prevInput.nativeElement.focus();
      }
    }, 10);
  }
}
async sendResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(this.auth, email);
  alert('ระบบได้ส่งอีเมลรีเซ็ตรหัสผ่านให้แล้ว');
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
  onOtpInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    let value = input.value;

    // ลบทุกอย่างที่ไม่ใช่ตัวเลข
    value = value.replace(/[^0-9]/g, '');
    
    // ถ้ามีมากกว่า 1 ตัว เอาแค่ตัวสุดท้าย
    if (value.length > 1) {
      value = value.slice(-1);
    }

    // อัพเดทค่าใน array
    this.otp[index] = value;
    
    // บังคับให้ input แสดงค่าที่ถูกต้อง
    input.value = value;

    // ถ้ากรอกตัวเลขแล้ว ให้ไปช่องถัดไป
    if (value && index < this.otp.length - 1) {
      this.focusNextInput(index + 1);
    }
  }
  onFocus(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    // เลือกข้อความทั้งหมดเมื่อ focus (เพื่อให้แทนที่ได้ง่าย)
    setTimeout(() => {
      input.select();
    }, 10);
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
  onPaste(event: ClipboardEvent, index: number) {
    event.preventDefault();
    
    const pastedData = event.clipboardData?.getData('text') || '';
    const numbers = pastedData.replace(/[^0-9]/g, '');
    
    if (numbers.length > 0) {
      // กรอกตัวเลขที่ paste มาตามลำดับ
      for (let i = 0; i < Math.min(numbers.length, this.otp.length - index); i++) {
        this.otp[index + i] = numbers[i];
        
        // อัพเดท input value
        const targetInput = this.otpInputs.toArray()[index + i];
        if (targetInput) {
          targetInput.nativeElement.value = numbers[i];
        }
      }
      
      // ย้าย focus ไปช่องถัดไปหลังจาก paste
      const nextIndex = Math.min(index + numbers.length, this.otp.length - 1);
      this.focusNextInput(nextIndex);
    }
  }

  isOtpComplete(): boolean {
    return this.otp.every(digit => digit !== '' && /^[0-9]$/.test(digit));
  }
  verifyOtp() {
    if (!this.isOtpComplete()) {
      alert('กรุณากรอก OTP ให้ครบทุกช่อง');
      return;
    }

    const enteredOtp = this.otp.join('');
    console.log('Generated OTP:', this.generatedOtp);
    console.log('Entered OTP:', enteredOtp);
    
    if (enteredOtp === this.generatedOtp) {
      this.step = 3;
    } else {
      alert('OTP ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      this.clearOtp();
    }
  }
  clearOtp() {
    this.otp = ['', '', '', '', '', ''];
    
    // เคลียร์ input elements ด้วย
    this.otpInputs.forEach((input, index) => {
      input.nativeElement.value = '';
    });
    
    setTimeout(() => {
      const firstInput = this.otpInputs.toArray()[0];
      if (firstInput) {
        firstInput.nativeElement.focus();
      }
    }, 10);
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
      alert('รหัสผ่านไม่ตรงกัน หรือไม่ตรงตามเกณฑ์');
      return;
    }

    this.isLoading = true;

    try {
      const dbRef = ref(this.database);
      const usersSnapshot = await get(child(dbRef, 'users'));

      let userKey = null;
      if (usersSnapshot.exists()) {
        const allUsers = usersSnapshot.val();
        for (const [key, value] of Object.entries(allUsers)) {
          if ((value as any).email === this.email) {
            userKey = key;
            break;
          }
        }
      }

      if (!userKey) throw new Error('ไม่พบข้อมูลผู้ใช้');

      // อัปเดตรหัสผ่านใหม่ใน database
      const newPassword = this.newPassword;
      await update(ref(this.database, `users/${userKey}`), {
        password: newPassword, // หรือใช้ this.simpleHash(newPassword)
        lastPasswordReset: Date.now()
      });

      alert('เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
      this.router.navigate(['/']);
    } catch (error: any) {
      console.error('เกิดข้อผิดพลาด:', error);
      alert('ไม่สามารถเปลี่ยนรหัสผ่านได้: ' + (error.message || 'Unknown error'));
    } finally {
      this.isLoading = false;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
}