import { Component, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { Location, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Constants } from '../../../config/constants';
import { NotificationService } from '../../../service/notification.service';

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
  referenceNumber = '';
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
    private constants: Constants,
    private notificationService: NotificationService
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
      // ใช้ history.back() แทนการ navigate ไปหน้าเฉพาะ
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
  }

  private clearNewPassword() {
    this.newPassword = '';
    this.confirmPassword = '';
    this.passwordStrength = { width: 0, class: '', text: '' };
    this.passwordMismatch = false;
  }

  async sendOtp() {
    if (!this.isValidEmail(this.email)) {
      this.notificationService.showNotification('error', 'อีเมลไม่ถูกต้อง', 'กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }

    this.isLoading = true;
    try {
      // สร้างเลขอ้างอิงใหม่
      this.referenceNumber = this.generateReferenceNumber();
      
      // Debug: ดูข้อมูลที่สร้าง
      console.log('🔍 Generated NEW Reference Number:', this.referenceNumber);
      console.log('🔍 Email:', this.email);
      console.log('🔄 Previous OTP will be invalidated');
      
      const sendData = {
        email: this.email,
        referenceNumber: this.referenceNumber,
        type: 'password-reset',
        invalidatePrevious: true // บังคับให้ OTP ก่อนหน้าหมดอายุ
      };
      
      console.log('🔍 Sending OTP data:', sendData);
      
      // ส่ง OTP ไปยัง backend เพื่อส่ง email
      const response = await firstValueFrom(
        this.http.post(`${this.apiUrl}/api/auth/send-otp`, sendData)
      );

      console.log('✅ NEW OTP sent successfully:', response);
      
      // อัปเดตข้อมูลจาก Backend response
      if (response && (response as any).ref) {
        this.referenceNumber = (response as any).ref;
        console.log('🔄 Updated Reference Number from Backend:', this.referenceNumber);
      }
      
      this.step = 2;
      this.startCountdown();
      this.notificationService.showNotification('success', 'ส่ง OTP สำเร็จ', `กรุณาตรวจสอบอีเมลของคุณ เลขอ้างอิง: ${this.referenceNumber}`);
    } catch (error: any) {
      console.error('เกิดข้อผิดพลาด:', error);
      console.error('Error details:', {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        url: error.url
      });
      this.notificationService.showNotification('error', 'ไม่สามารถส่ง OTP ได้', 'ไม่สามารถส่ง OTP ได้: ' + (error.message || 'Unknown error'));
    } finally {
      this.isLoading = false;
    }
  }


  generateReferenceNumber(): string {
    // สร้างเลขอ้างอิง 8 หลัก (ตัวอักษรและตัวเลข)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async verifyOtp() {
    const enteredOtp = this.otp.join('');
    
    if (enteredOtp.length !== 6) {
      this.notificationService.showNotification('error', 'OTP ไม่ครบถ้วน', 'กรุณากรอก OTP ให้ครบ 6 หลัก');
      return;
    }

    this.isLoading = true;
    try {
      // ส่ง OTP ไปตรวจสอบที่ backend (อิง OTP จาก email เท่านั้น)
      const verifyData = {
        email: this.email,
        otp: enteredOtp,
        referenceNumber: this.referenceNumber,
        type: 'password-reset'
      };
      
      console.log('🔍 Sending OTP verification data:', verifyData);
      console.log('🔍 Entered OTP:', enteredOtp);
      console.log('🔍 Reference Number:', this.referenceNumber);
      console.log('🔍 Email:', this.email);

      // ส่ง OTP ไปตรวจสอบที่ backend
      const response = await firstValueFrom(
        this.http.post(`${this.apiUrl}/api/auth/verify-otp`, verifyData)
      );

      console.log('✅ OTP verification successful:', response);
      this.step = 3;
      this.notificationService.showNotification('success', 'OTP ถูกต้อง', 'กรุณาตั้งรหัสผ่านใหม่');
    } catch (error: any) {
      console.error('OTP verification error:', error);
      console.error('Error details:', {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        url: error.url
      });
      this.notificationService.showNotification('error', 'OTP ไม่ถูกต้อง', 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบอีเมลของคุณ');
    } finally {
      this.isLoading = false;
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
      this.notificationService.showNotification('error', 'รหัสผ่านไม่ถูกต้อง', 'รหัสผ่านไม่ตรงกัน หรือไม่ตรงตามเกณฑ์');
      return;
    }

    this.isLoading = true;

    try {
      // ใช้ OTP ที่ผู้ใช้กรอก (ที่ผ่านการ verify แล้ว)
      const enteredOtp = this.otp.join('');
      
      // ส่งข้อมูลไปยัง backend เพื่อ reset password
      const resetData = {
        email: this.email,
        newPassword: this.newPassword,
        otp: enteredOtp,
        referenceNumber: this.referenceNumber
      };
      
      console.log('🔍 Sending reset password data:', resetData);
      console.log('🔍 Entered OTP (verified):', enteredOtp);
      console.log('🔍 Reference Number:', this.referenceNumber);
      console.log('🔍 Email:', this.email);

      // ส่งข้อมูลไปยัง backend เพื่อ reset password
      const response = await firstValueFrom(
        this.http.put(`${this.apiUrl}/api/auth/reset-password`, resetData)
      );

      console.log('✅ Password reset successfully:', response);
      this.notificationService.showNotification('success', 'เปลี่ยนรหัสผ่านสำเร็จ', 'กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่', true, 'ไปหน้า Login', () => {
        this.router.navigate(['/']);
      });
    } catch (error: any) {
      console.error('เกิดข้อผิดพลาด:', error);
      console.error('Error details:', {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        url: error.url
      });
      
      // แสดง error message ที่ชัดเจนขึ้น
      let errorMessage = 'ไม่สามารถเปลี่ยนรหัสผ่านได้';
      if (error.status === 400) {
        errorMessage = 'OTP ไม่ถูกต้องหรือหมดอายุ กรุณาขอ OTP ใหม่';
      } else if (error.status === 404) {
        errorMessage = 'ไม่พบผู้ใช้ในระบบ';
      } else if (error.status === 500) {
        errorMessage = 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่';
      }
      
      this.notificationService.showNotification('error', 'ไม่สามารถเปลี่ยนรหัสผ่านได้', errorMessage);
    } finally {
      this.isLoading = false;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isOtpComplete(): boolean {
    return this.otp.every(digit => digit !== '');
  }

  moveToNext(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    if (input.value.length === 1 && index < 5) {
      const nextInput = this.otpInputs.toArray()[index + 1];
      if (nextInput) {
        nextInput.nativeElement.focus();
      }
    }
  }

  onKeyDown(event: KeyboardEvent, index: number) {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Backspace' && input.value === '' && index > 0) {
      const prevInput = this.otpInputs.toArray()[index - 1];
      if (prevInput) {
        prevInput.nativeElement.focus();
      }
    }
  }

  async resendOtp() {
    if (this.countdown > 0) {
      this.notificationService.showNotification('warning', 'กรุณารอสักครู่', `กรุณารอ ${this.countdown} วินาที ก่อนส่ง OTP ใหม่`);
      return;
    }
    
    this.isLoading = true;
    try {
      // สร้างเลขอ้างอิงใหม่
      this.referenceNumber = this.generateReferenceNumber();
      
      // Debug: ดูข้อมูลที่สร้างใหม่
      console.log('🔄 Resending OTP - Generated NEW Reference Number:', this.referenceNumber);
      console.log('🔄 Previous OTP will be invalidated');
      
      // ส่ง OTP ใหม่ (จะทำให้ OTP ก่อนหน้าหมดอายุ)
      const response = await firstValueFrom(
        this.http.post(`${this.apiUrl}/api/auth/send-otp`, {
          email: this.email,
          referenceNumber: this.referenceNumber,
          type: 'password-reset',
          invalidatePrevious: true // บังคับให้ OTP ก่อนหน้าหมดอายุ
        })
      );

      console.log('✅ NEW OTP resent successfully:', response);
      
      // อัปเดตข้อมูลจาก Backend response
      if (response && (response as any).ref) {
        this.referenceNumber = (response as any).ref;
        console.log('🔄 Updated Reference Number from Backend (Resend):', this.referenceNumber);
      }
      
      this.startCountdown();
      this.notificationService.showNotification('success', 'ส่ง OTP ใหม่สำเร็จ', `กรุณาตรวจสอบอีเมลของคุณ เลขอ้างอิง: ${this.referenceNumber}`);
    } catch (error: any) {
      console.error('เกิดข้อผิดพลาด:', error);
      console.error('Error details:', {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        url: error.url
      });
      this.notificationService.showNotification('error', 'ไม่สามารถส่ง OTP ใหม่ได้', 'ไม่สามารถส่ง OTP ใหม่ได้: ' + (error.message || 'Unknown error'));
    } finally {
      this.isLoading = false;
    }
  }

  checkPasswordStrength() {
    const password = this.newPassword;
    if (!password) {
      this.passwordStrength = { width: 0, class: '', text: '' };
      return;
    }

    let score = 0;
    let feedback = [];

    // Length check
    if (password.length >= 8) score += 1;
    else feedback.push('อย่างน้อย 8 ตัวอักษร');

    // Lowercase check
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('มีตัวอักษรพิมพ์เล็ก');

    // Uppercase check
    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('มีตัวอักษรพิมพ์ใหญ่');

    // Number check
    if (/\d/.test(password)) score += 1;
    else feedback.push('มีตัวเลข');

    // Special character check
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
    else feedback.push('มีอักขระพิเศษ');

    // Calculate strength
    const percentage = (score / 5) * 100;
    let strengthClass = '';
    let strengthText = '';

    if (percentage < 40) {
      strengthClass = 'weak';
      strengthText = 'อ่อน';
    } else if (percentage < 70) {
      strengthClass = 'medium';
      strengthText = 'ปานกลาง';
    } else {
      strengthClass = 'strong';
      strengthText = 'แข็งแรง';
    }

    this.passwordStrength = {
      width: percentage,
      class: strengthClass,
      text: strengthText
    };

    // Check password match
    this.passwordMismatch = this.newPassword !== this.confirmPassword && this.confirmPassword !== '';
  }

  toggleNewPassword() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
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
