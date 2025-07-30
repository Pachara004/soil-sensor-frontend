import { Component, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from '@angular/fire/auth';
import { Database, ref, set, get, child } from '@angular/fire/database';
import { sendEmailVerification } from 'firebase/auth';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef>;

  step = 1;
  email = '';
  otp = ['', '', '', '', '', ''];
  generatedOtp = '';
  password = '';
  confirmPassword = '';
  username = '';
  fullName = '';
  phoneNumber = '';
  
  passwordMismatch = false;
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  isRegistering = false;
  countdown = 0;
  
  usernameStatus: {class: string, message: string} | null = null;
  passwordStrength = {width: 0, class: '', text: ''};

  otpInputsArray = Array(6).fill('');

  constructor(
    private auth: Auth, 
    private router: Router,
    private database: Database,
    private http: HttpClient
  ) {}

  goBack() {
    if (this.step > 1) {
      this.step--;
    } else {
      this.router.navigate(['/']);
    }
  }

  async sendOtp() {
    if (!this.email || !this.isValidEmail(this.email)) {
      alert('กรุณากรอก Email ที่ถูกต้อง');
      return;
    }

    this.isLoading = true;
    this.generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      // ตัวเลือกการส่ง OTP
      const useRealEmail = true; // เปลี่ยนเป็น true เพื่อส่ง email จริง
      
      if (useRealEmail) {
        await this.sendOtpEmail(this.email, this.generatedOtp);
        alert('OTP ถูกส่งไปยังอีเมลของคุณแล้ว');
      } else {
        // ระบบจำลองสำหรับการทดสอบ
        console.log('OTP สำหรับ', this.email, ':', this.generatedOtp);
        alert(`OTP สำหรับการทดสอบ: ${this.generatedOtp}\n(ในการใช้งานจริงจะส่งไปยังอีเมล)`);
      }
      
      this.step = 2;
      this.startCountdown();
    } catch (error) {
      console.error('Error sending OTP:', error);
      alert('เกิดข้อผิดพลาดในการส่ง OTP กรุณาลองใหม่อีกครั้ง');
    } finally {
      this.isLoading = false;
    }
  }

  private async sendOtpEmail(email: string, otp: string): Promise<void> {
  // วิธีที่ 1: ใช้ EmailJS (แนะนำสำหรับการทดสอบ)
  const useEmailJS = true; // เปลี่ยนเป็น true และใส่ข้อมูล EmailJS
  
  if (useEmailJS) {
    const emailJSData = {
      service_id: 'service_y6enw8s', // Service ID ที่คุณสร้าง
      template_id: 'template_ztt7b87', // แทนที่ด้วย Template ID ที่สร้างใหม่
      user_id: '8ypHiGBky5C_KnLx8', // แทนที่ด้วย Public Key จาก Account > API Keys
      template_params: {
        to_email: email,
        to_name: 'ผู้สมัครใหม่',
        otp_code: otp,
        from_name: 'ระบบสมัครสมาชิก'
      }
    };

    try {
      // เพิ่ม responseType: 'text' เพื่อบอก Angular ว่าจะได้รับ response เป็น text
      const response = await firstValueFrom(
        this.http.post('https://api.emailjs.com/api/v1.0/email/send', emailJSData, {
          responseType: 'text' // <-- นี่คือส่วนที่สำคัญ
        })
      );
      
      console.log('EmailJS Response:', response);
      return; // สำเร็จ
      
    } catch (error: any) {
      console.error('EmailJS Error Details:', error);
      
      // ตรวจสอบว่าเป็น error จริงๆ หรือแค่ response format ผิด
      if (error.status === 200) {
        // ถ้า status เป็น 200 แสดงว่าส่งสำเร็จแล้ว
        console.log('Email sent successfully despite error format');
        return;
      }
      
      // ถ้าเป็น error จริงๆ ให้ throw ต่อไป
      throw new Error(`EmailJS failed: ${error.message || 'Unknown error'}`);
    }
  }

  // วิธีที่ 2: ใช้ Firebase Cloud Functions
  const useCloudFunction = false; // เปลี่ยนเป็น true และสร้าง Cloud Function
  
  if (useCloudFunction) {
    const cloudFunctionUrl = 'https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/sendOtpEmail';
    const response = await firstValueFrom(
      this.http.post(cloudFunctionUrl, {
        email: email,
        otp: otp
      })
    );
    return;
  }

  // วิธีที่ 3: ใช้ Backend API ของคุณเอง
  const useCustomAPI = false; // เปลี่ยนเป็น true และใส่ URL ของ API
  
  if (useCustomAPI) {
    const apiUrl = 'https://your-backend-api.com/send-otp';
    const response = await firstValueFrom(
      this.http.post(apiUrl, {
        email: email,
        otp: otp
      })
    );
    return;
  }

  // หากไม่ได้เปิดใช้งานวิธีใดเลย จะ throw error
  throw new Error('No email service configured');
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

  verifyOtp() {
    const enteredOtp = this.otp.join('');
    if (enteredOtp === this.generatedOtp) {
      this.step = 3;
    } else {
      alert('OTP ไม่ถูกต้อง');
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  checkPasswordStrength() {
    const password = this.password;
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
  }

  nextToPersonalInfo() {
    if (this.password !== this.confirmPassword) {
      this.passwordMismatch = true;
      return;
    }

    if (this.password.length < 6) {
      alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    this.passwordMismatch = false;
    this.step = 4;
  }

  async checkUsernameAvailability() {
    if (!this.username) {
      this.usernameStatus = null;
      return;
    }

    try {
      const dbRef = ref(this.database);
      const snapshot = await get(child(dbRef, `users/${this.username}`));
      
      if (snapshot.exists()) {
        this.usernameStatus = {
          class: 'error',
          message: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว'
        };
      } else {
        this.usernameStatus = {
          class: 'success',
          message: 'ชื่อผู้ใช้นี้ใช้ได้'
        };
      }
    } catch (error) {
      console.error('Error checking username:', error);
      this.usernameStatus = {
        class: 'error',
        message: 'เกิดข้อผิดพลาดในการตรวจสอบ'
      };
    }
  }

  formatPhoneNumber(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 10) {
      value = value.substring(0, 10);
    }
    
    if (value.length >= 3) {
      if (value.length >= 6) {
        value = value.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
      } else {
        value = value.replace(/(\d{3})(\d{3})/, '$1-$2');
      }
    }
    
    this.phoneNumber = value;
  }

  async register() {
    if (!this.validateForm()) {
      return;
    }

    this.isRegistering = true;

    try {
      // สร้างบัญชี Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(this.auth, this.email, this.password);
      const user = userCredential.user;

      // บันทึกข้อมูลใน Realtime Database
      await set(ref(this.database, `users/${this.username}`), {
        uid: user.uid,
        email: this.email,
        username: this.username,
        fullName: this.fullName,
        phoneNumber: this.phoneNumber.replace(/\D/g, ''),
        createdAt: Date.now(),
        emailVerified: false
      });

      // ส่งอีเมลยืนยัน
      await sendEmailVerification(user);

      alert('สมัครสำเร็จ! กรุณายืนยันอีเมลของคุณ');
      this.router.navigate(['/']);
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('อีเมลนี้ถูกใช้งานแล้ว');
      } else {
        alert('เกิดข้อผิดพลาด: ' + error.message);
      }
    } finally {
      this.isRegistering = false;
    }
  }

  private validateForm(): boolean {
    if (!this.username.trim()) {
      alert('กรุณากรอกชื่อผู้ใช้');
      return false;
    }

    if (!this.fullName.trim()) {
      alert('กรุณากรอกชื่อ-นามสกุล');
      return false;
    }

    if (!this.phoneNumber.replace(/\D/g, '')) {
      alert('กรุณากรอกเบอร์โทรศัพท์');
      return false;
    }

    if (this.usernameStatus?.class === 'error') {
      alert('กรุณาเลือกชื่อผู้ใช้อื่น');
      return false;
    }

    return true;
  }

  async registerWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);
      const user = result.user;

      // บันทึกข้อมูลพื้นฐานจาก Google
      const username = user.email?.split('@')[0] || 'user' + Date.now();
      
      await set(ref(this.database, `users/${username}`), {
        uid: user.uid,
        email: user.email,
        username: username,
        fullName: user.displayName || '',
        phoneNumber: '',
        createdAt: Date.now(),
        emailVerified: user.emailVerified,
        provider: 'google'
      });

      this.router.navigate(['/main']);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      alert('Google Sign-in ล้มเหลว');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}