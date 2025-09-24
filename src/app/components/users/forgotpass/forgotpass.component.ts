import { Component, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { Location, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Constants } from '../../../config/constants';

@Component({
  selector: 'app-forgotpass',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forgotpass.component.html',
  styleUrl: './forgotpass.component.scss',
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
  private apiUrl: string;

  constructor(
    private router: Router,
    private location: Location,
    private http: HttpClient,
    private constants: Constants
  ) {
    this.apiUrl = this.constants.API_ENDPOINT;
  }

  getTitle(): string {
    switch (this.step) {
      case 1:
        return 'ลืมรหัสผ่าน';
      case 2:
        return 'ยืนยัน OTP';
      case 3:
        return 'ตั้งรหัสผ่านใหม่';
      default:
        return 'ลืมรหัสผ่าน';
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
    } else if (this.step === 2) {
      this.clearNewPassword();
    }
  }

  private clearOtp() {
    this.otp = ['', '', '', '', '', ''];
    this.otpInputsArray = Array(6).fill('');
    this.generatedOtp = '';
  }

  private clearNewPassword() {
    this.newPassword = '';
    this.confirmPassword = '';
    this.passwordStrength = { width: 0, class: '', text: '' };
    this.passwordMismatch = false;
  }

  async sendOtp() {
    if (!this.isValidEmail(this.email)) {
      alert('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }

    this.isLoading = true;
    try {
      const response = await firstValueFrom(
        this.http.post<{ otp?: string }>(`${this.apiUrl}/api/forgot-password`, {
          email: this.email,
        })
      );
      this.generatedOtp = response?.otp || '';
      this.step = 2;
      this.startCountdown();
    } catch (error) {
      console.error('Error sending OTP:', error);
      alert('ไม่สามารถส่ง OTP ได้');
    } finally {
      this.isLoading = false;
    }
  }

  async verifyOtp() {
    const enteredOtp = this.otp.join('');
    if (enteredOtp === this.generatedOtp) {
      this.step = 3;
    } else {
      alert('รหัส OTP ไม่ถูกต้อง');
    }
  }

  updatePasswordStrength() {
    let strength = 0;
    let className = 'weak';
    let text = 'อ่อนแอ';

    if (this.newPassword.length >= 6) strength += 33;
    if (/[A-Z]/.test(this.newPassword)) strength += 33;
    if (/[0-9]/.test(this.newPassword)) strength += 34;

    if (strength >= 66) {
      className = 'strong';
      text = 'แข็งแรง';
    } else if (strength >= 33) {
      className = 'medium';
      text = 'ปานกลาง';
    }

    this.passwordStrength = { width: strength, class: className, text: text };
    this.passwordMismatch =
      this.confirmPassword !== '' && this.newPassword !== this.confirmPassword;
  }

  canResetPassword(): boolean {
    return (
      this.newPassword.length >= 6 &&
      this.newPassword === this.confirmPassword &&
      !this.passwordMismatch
    );
  }

  async resetPassword() {
    if (!this.canResetPassword()) {
      alert('รหัสผ่านไม่ตรงกัน หรือไม่ตรงตามเกณฑ์');
      return;
    }

    this.isLoading = true;

    try {
      await firstValueFrom(
        this.http.put(`${this.apiUrl}/api/users/reset-password`, {
          email: this.email,
          newPassword: this.newPassword,
        })
      );
      alert('เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
      this.router.navigate(['/']);
    } catch (error: any) {
      console.error('เกิดข้อผิดพลาด:', error);
      alert(
        'ไม่สามารถเปลี่ยนรหัสผ่านได้: ' + (error.message || 'Unknown error')
      );
    } finally {
      this.isLoading = false;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private startCountdown() {
    this.countdown = 60;
    const interval = setInterval(() => {
      if (this.countdown > 0) {
        this.countdown--;
      } else {
        clearInterval(interval);
      }
    }, 1000);
  }

  onOtpInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    if (input.value.length === 1 && index < 5) {
      this.otpInputs.toArray()[index + 1].nativeElement.focus();
    }
    this.otp[index] = input.value;
  }
}
