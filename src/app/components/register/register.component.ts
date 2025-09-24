import { Component, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Auth, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, fetchSignInMethodsForEmail, deleteUser } from '@angular/fire/auth';
import { Constants } from '../../config/constants';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
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
  otpReferenceNumber = '';

  passwordMismatch = false;
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  isRegistering = false;
  countdown = 0;
  isCheckingEmail = false;

  usernameStatus: { class: string; message: string } | null = null;
  passwordStrength = { width: 0, class: '', text: '' };
  emailStatus: { class: string; message: string } | null = null;

  otpInputsArray = Array(6).fill('');
  userType: 'user' | 'admin' = 'user';
  private usernameCheckTimeout: any;
  private emailCheckTimeout: any;

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private auth: Auth,
    private constants: Constants
  ) {}

  ngOnInit() {
    this.userType =
      (this.route.snapshot.data['type'] as 'user' | 'admin') ||
      (this.router.url.includes('adregister') ? 'admin' : 'user');
    
    // ตรวจสอบให้แน่ใจว่า userType มีค่า
    if (!this.userType) {
      this.userType = 'user';
    }
    
    console.log('User type set to:', this.userType); // Debug log
  }

  goBack() {
    if (this.step > 1) {
      this.step--;
    } else {
      this.router.navigate(['/']);
    }
  }

  // ปรับปรุงฟังก์ชันตรวจสอบอีเมลให้ครอบคลุมทั้ง Firebase และ Backend
  async checkEmailAvailability() {
    if (!this.email || !this.isValidEmail(this.email)) {
      this.emailStatus = null;
      return;
    }

    // Clear previous timeout
    if (this.emailCheckTimeout) {
      clearTimeout(this.emailCheckTimeout);
    }

    // Set loading state
    this.emailStatus = {
      class: 'loading',
      message: 'กำลังตรวจสอบอีเมล...',
    };

    this.isCheckingEmail = true;

    // Debounce the API call
    this.emailCheckTimeout = setTimeout(async () => {
      try {
        console.log(`Checking email availability for: ${this.email}`); // Debug log
        
        // ตรวจสอบทั้ง Firebase Auth และ Backend PostgreSQL พร้อมกัน
        const emailChecks = await Promise.allSettled([
          this.checkEmailExistsInFirebase(this.email),
          this.checkEmailExistsInBackend(this.email)
        ]);

        const firebaseResult = emailChecks[0];
        const backendResult = emailChecks[1];

        console.log('Firebase result:', firebaseResult); // Debug log
        console.log('Backend result:', backendResult); // Debug log

        let firebaseExists = false;
        let backendExists = false;
        let errors = [];

        // ประมวลผล Firebase result
        if (firebaseResult.status === 'fulfilled') {
          firebaseExists = firebaseResult.value;
        } else {
          console.error('Firebase check failed:', firebaseResult.reason);
          errors.push(`Firebase: ${firebaseResult.reason.message}`);
        }

        // ประมวลผล Backend result
        if (backendResult.status === 'fulfilled') {
          backendExists = backendResult.value;
        } else {
          console.error('Backend check failed:', backendResult.reason);
          errors.push(`Backend: ${backendResult.reason.message}`);
        }

        // หากมี error ที่สำคัญ ให้แสดงข้อผิดพลาด
        if (errors.length > 0 && (firebaseResult.status === 'rejected' && backendResult.status === 'rejected')) {
          this.emailStatus = {
            class: 'error',
            message: 'ไม่สามารถตรวจสอบอีเมลได้ กรุณาลองใหม่',
          };
          return;
        }
        
        if (firebaseExists || backendExists) {
          let source = '';
          if (firebaseExists && backendExists) {
            source = 'ระบบ Firebase และฐานข้อมูล';
          } else if (firebaseExists) {
            source = 'ระบบ Firebase Auth';
          } else {
            source = 'ฐานข้อมูล';
          }

          this.emailStatus = {
            class: 'error',
            message: `อีเมลนี้ถูกใช้ไปแล้ว กรุณาใช้อีเมลอื่น`,
          };
        } else {
          this.emailStatus = {
            class: 'success',
            message: 'อีเมลนี้ใช้ได้',
          };
        }
      } catch (error: any) {
        console.error('Unexpected error checking email:', error);
        
        this.emailStatus = {
          class: 'error',
          message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่',
        };
      } finally {
        this.isCheckingEmail = false;
      }
    }, 800);
  }

  async sendOtp() {
    // ตรวจสอบความถูกต้องของอีเมลก่อน
    if (!this.email || !this.isValidEmail(this.email)) {
      alert('กรุณากรอก Email ที่ถูกต้อง');
      return;
    }

    this.isLoading = true;

    try {
      console.log(`Sending OTP - checking email: ${this.email}`); // Debug log
      
      // ตรวจสอบอีเมลทั้ง Firebase Auth และ Backend พร้อมกัน
      const emailChecks = await Promise.allSettled([
        this.checkEmailExistsInFirebase(this.email),
        this.checkEmailExistsInBackend(this.email)
      ]);

      const firebaseResult = emailChecks[0];
      const backendResult = emailChecks[1];

      console.log('OTP Send - Firebase result:', firebaseResult); // Debug log
      console.log('OTP Send - Backend result:', backendResult); // Debug log

      let firebaseExists = false;
      let backendExists = false;

      // ประมวลผล Firebase result
      if (firebaseResult.status === 'fulfilled') {
        firebaseExists = firebaseResult.value;
      } else {
        console.error('Firebase check failed during OTP send:', firebaseResult.reason);
        // หาก Firebase check ล้มเหลว ให้แสดงข้อผิดพลาด
        alert('ไม่สามารถตรวจสอบอีเมลกับระบบ Firebase ได้ กรุณาลองใหม่');
        return;
      }

      // ประมวลผล Backend result (อนุญาตให้ล้มเหลวได้)
      if (backendResult.status === 'fulfilled') {
        backendExists = backendResult.value;
      } else {
        console.warn('Backend check failed during OTP send, continuing with Firebase only');
        backendExists = false;
      }

      if (firebaseExists || backendExists) {
        let source = '';
        if (firebaseExists && backendExists) {
          source = 'ระบบ Firebase และฐานข้อมูล';
        } else if (firebaseExists) {
          source = 'ระบบ Firebase Auth';
        } else {
          source = 'ฐานข้อมูล';
        }
        
        alert(`อีเมลนี้ถูกใช้ไปแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ`);
        this.router.navigate(['/login']);
        return;
      }

      const response = await firstValueFrom(
        this.http.post(`${this.constants.API_ENDPOINT}/api/auth/send-otp`, {
          email: this.email,
        })
      ) as any;

      this.otpReferenceNumber = response?.referenceNumber || response?.ref || 'N/A';
      
      alert(`OTP ถูกส่งไปยังอีเมลของคุณแล้ว\nเลขอ้างอิง: ${this.otpReferenceNumber}`);
      this.step = 2;
      this.startCountdown();
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      if (error?.status === 404) {
        alert('ส่ง OTP ไม่ได้: ตรวจ URL/พอร์ต backend');
      } else if (error?.status >= 500) {
        alert('ระบบอีเมลยังไม่พร้อม กรุณาลองใหม่ภายหลัง');
      } else {
        alert('เกิดข้อผิดพลาดในการส่ง OTP กรุณาลองใหม่');
      }
    } finally {
      this.isLoading = false;
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

  async verifyOtp() {
    const enteredOtp = this.otp.join('');
    
    if (enteredOtp.length !== 6) {
      alert('กรุณากรอก OTP ให้ครบ 6 หลัก');
      return;
    }

    this.isLoading = true;

    try {
      const response = await firstValueFrom(
        this.http.post(`${this.constants.API_ENDPOINT}/api/auth/verify-otp`, {
          email: this.email,
          otp: enteredOtp
        })
      );

      if (response) {
        alert('OTP ถูกต้อง');
      this.step = 3;
        this.otp = ['', '', '', '', '', ''];
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      if (error?.status === 400) {
        alert('OTP ไม่ถูกต้อง กรุณาลองใหม่');
      } else if (error?.status === 410) {
        alert('OTP หมดอายุแล้ว กรุณาขอ OTP ใหม่');
    } else {
        alert('เกิดข้อผิดพลาดในการตรวจสอบ OTP กรุณาลองใหม่');
      }
    } finally {
      this.isLoading = false;
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

    if (this.usernameCheckTimeout) {
      clearTimeout(this.usernameCheckTimeout);
    }

    this.usernameStatus = {
      class: 'loading',
      message: 'กำลังตรวจสอบ...',
    };

    this.usernameCheckTimeout = setTimeout(async () => {
    try {
      const response = (await firstValueFrom(
          this.http.get(`${this.constants.API_ENDPOINT}/api/auth/check-username/${this.username}`)
      )) as { exists: boolean };

      if (response.exists) {
        this.usernameStatus = {
          class: 'error',
          message: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว',
        };
      } else {
        this.usernameStatus = {
          class: 'success',
          message: 'ชื่อผู้ใช้นี้ใช้ได้',
        };
      }
      } catch (error: any) {
      console.error('Error checking username:', error);
        
        if (error?.status === 404) {
          this.usernameStatus = {
            class: 'error',
            message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
          };
        } else if (error?.status >= 500) {
          this.usernameStatus = {
            class: 'error',
            message: 'เซิร์ฟเวอร์มีปัญหา กรุณาลองใหม่ภายหลัง',
          };
        } else {
      this.usernameStatus = {
        class: 'error',
        message: 'เกิดข้อผิดพลาดในการตรวจสอบ',
      };
    }
      }
    }, 500);
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
      console.log(`Register - final email check: ${this.email}`); // Debug log
      
      // ตรวจสอบอีเมลอีกครั้งก่อนสมัคร เพื่อความแน่ใจ
      const emailChecks = await Promise.allSettled([
        this.checkEmailExistsInFirebase(this.email),
        this.checkEmailExistsInBackend(this.email)
      ]);

      const firebaseResult = emailChecks[0];
      const backendResult = emailChecks[1];

      console.log('Register - Firebase result:', firebaseResult); // Debug log
      console.log('Register - Backend result:', backendResult); // Debug log

      let firebaseExists = false;
      let backendExists = false;

      // ประมวลผล Firebase result
      if (firebaseResult.status === 'fulfilled') {
        firebaseExists = firebaseResult.value;
      } else {
        console.error('Firebase check failed during registration:', firebaseResult.reason);
        alert('ไม่สามารถตรวจสอบอีเมลกับระบบ Firebase ได้ กรุณาลองใหม่');
        return;
      }

      // ประมวลผล Backend result (อนุญาตให้ล้มเหลวได้)
      if (backendResult.status === 'fulfilled') {
        backendExists = backendResult.value;
      } else {
        console.warn('Backend check failed during registration, continuing with Firebase only');
        backendExists = false;
      }

      if (firebaseExists || backendExists) {
        let source = '';
        if (firebaseExists && backendExists) {
          source = 'ระบบ Firebase และฐานข้อมูล';
        } else if (firebaseExists) {
          source = 'ระบบ Firebase Auth';
        } else {
          source = 'ฐานข้อมูล';
        }
        
        alert(`อีเมลนี้ถูกใช้ไปแล้วใน${source} กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ`);
        this.router.navigate(['/login']);
        return;
      }

      // Create Firebase user
      await createUserWithEmailAndPassword(this.auth, this.email, this.password);
      console.log('Firebase user created successfully'); // Debug log

      // Save user data to backend
      try {
        await this.saveUserToBackend();
        console.log('User data saved to backend successfully'); // Debug log
      } catch (backendError: any) {
        console.error('Failed to save user to backend:', backendError);
        
        // ลบ Firebase user ที่สร้างขึ้นมาแล้ว
        try {
          const currentUser = this.auth.currentUser;
          if (currentUser) {
            await deleteUser(currentUser);
            console.log('Firebase user deleted due to backend error'); // Debug log
          }
        } catch (deleteError) {
          console.error('Failed to delete Firebase user:', deleteError);
        }
        
        alert(`สมัครไม่สำเร็จ: ${backendError.message}`);
        return;
      }

      alert('สมัครสำเร็จ!');
      this.router.navigate(['/']);
    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        alert('อีเมลนี้ถูกใช้ไปแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ');
        this.router.navigate(['/login']);
      } else if (error.code === 'auth/weak-password') {
        alert('รหัสผ่านอ่อนเกินไป กรุณาใช้รหัสผ่านที่แข็งแรงกว่า');
      } else if (error.code === 'auth/invalid-email') {
        alert('รูปแบบอีเมลไม่ถูกต้อง');
      } else if (error.code === 'auth/operation-not-allowed') {
        alert('การสมัครสมาชิกถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
      } else if (error.code === 'auth/network-request-failed') {
        alert('เกิดปัญหาเครือข่าย กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
      } else {
      alert('เกิดข้อผิดพลาด: ' + (error.message || 'ไม่ทราบสาเหตุ'));
      }
    } finally {
      this.isRegistering = false;
    }
  }

  async registerWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(this.auth, provider);
      this.router.navigate(['/main']);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      alert('Google Sign-in ล้มเหลว');
    }
  }

  private validateForm(): boolean {
    console.log('Validating form data:', {
      email: this.email,
      username: this.username,
      fullName: this.fullName,
      phoneNumber: this.phoneNumber,
      userType: this.userType
    }); // Debug log

    if (!this.email || !this.email.trim()) {
      alert('กรุณากรอกอีเมล');
      return false;
    }

    if (!this.username || !this.username.trim()) {
      alert('กรุณากรอกชื่อผู้ใช้');
      return false;
    }

    if (!this.fullName || !this.fullName.trim()) {
      alert('กรุณากรอกชื่อ-นามสกุล');
      return false;
    }

    if (!this.phoneNumber || !this.phoneNumber.replace(/\D/g, '')) {
      alert('กรุณากรอกเบอร์โทรศัพท์');
      return false;
    }

    if (this.usernameStatus?.class === 'error') {
      alert('กรุณาเลือกชื่อผู้ใช้อื่น');
      return false;
    }

    if (this.emailStatus?.class === 'error') {
      alert('กรุณาใช้อีเมลอื่น');
      return false;
    }

    // ตรวจสอบความยาวของข้อมูล
    if (this.username.trim().length < 3) {
      alert('ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
      return false;
    }

    if (this.phoneNumber.replace(/\D/g, '').length < 10) {
      alert('เบอร์โทรศัพท์ต้องมีอย่างน้อย 10 หลัก');
      return false;
    }

    // ตรวจสอบรูปแบบอีเมล
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email.trim())) {
      alert('รูปแบบอีเมลไม่ถูกต้อง');
      return false;
    }

    return true;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // ตรวจสอบอีเมลใน Backend PostgreSQL
  private async checkEmailExistsInBackend(email: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.constants.API_ENDPOINT}/api/auth/check-email/${email}`)
      ) as { exists: boolean };
      console.log(`Backend check for ${email}:`, response); // Debug log
      return response.exists;
    } catch (error: any) {
      console.error('Error checking email in backend:', error);
      
      // หากเป็น 404 หรือ 500 error ให้ถือว่า backend ไม่พร้อม
      if (error?.status === 404 || error?.status >= 500) {
        console.warn('Backend not available, skipping backend email check');
        return false; // ข้าม backend check แต่ให้ Firebase check ทำงาน
      }
      
      // สำหรับ error อื่นๆ ให้ throw
      throw new Error('เกิดข้อผิดพลาดในการตรวจสอบอีเมลกับฐานข้อมูล');
    }
  }

  // ตรวจสอบอีเมลใน Firebase Auth
  private async checkEmailExistsInFirebase(email: string): Promise<boolean> {
    try {
      console.log(`Starting Firebase Auth check for: ${email}`);
      
      // วิธีที่ 1: ใช้ fetchSignInMethodsForEmail
      const methods = await fetchSignInMethodsForEmail(this.auth, email);
      console.log(`Firebase Auth methods for ${email}:`, methods);
      console.log(`Methods length: ${methods.length}`);
      
      if (methods.length > 0) {
        console.log(`Email ${email} exists in Firebase Auth`);
        return true;
      }
      
      // วิธีที่ 2: ลองใช้ createUserWithEmailAndPassword เพื่อดูว่าเกิด error หรือไม่
      console.log(`Trying to create user with email ${email} to check if it exists...`);
      
      // สร้าง temporary password เพื่อทดสอบ
      const tempPassword = 'TempPassword123!@#';
      
      try {
        // ลองสร้าง user ใหม่
        const userCredential = await createUserWithEmailAndPassword(this.auth, email, tempPassword);
        console.log(`Email ${email} does NOT exist in Firebase Auth - user created successfully`);
        
        // ลบ user ที่สร้างขึ้นมาทันที
        await deleteUser(userCredential.user);
        console.log(`Temporary user deleted successfully`);
        
        return false;
      } catch (createError: any) {
        console.log(`Create user error for ${email}:`, createError.code);
        
        if (createError.code === 'auth/email-already-in-use') {
          console.log(`Email ${email} EXISTS in Firebase Auth (email-already-in-use error)`);
          return true;
        } else if (createError.code === 'auth/weak-password') {
          // ถ้าเป็น weak password error แสดงว่า email ไม่มีอยู่
          console.log(`Email ${email} does NOT exist in Firebase Auth (weak-password error)`);
          return false;
        } else {
          console.error(`Unexpected error when checking email ${email}:`, createError);
          throw createError;
        }
      }
      
    } catch (error: any) {
      console.error('Error checking email in Firebase:', error);
      
      // ตรวจสอบ error code เฉพาะจาก Firebase
      if (error.code === 'auth/invalid-email') {
        console.log(`Invalid email format: ${email}`);
        return false; // อีเมลรูปแบบไม่ถูกต้อง
      }
      
      if (error.code === 'auth/network-request-failed') {
        console.warn('Firebase network error, email may exist but cannot verify');
        throw new Error('ไม่สามารถตรวจสอบอีเมลใน Firebase ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
      }
      
      // สำหรับ error อื่นๆ ให้ throw เพื่อให้ UI แสดงข้อผิดพลาด
      throw new Error('เกิดข้อผิดพลาดในการตรวจสอบอีเมลกับ Firebase Auth');
    }
  }

  private async saveUserToBackend(): Promise<void> {
    try {
      // ตรวจสอบข้อมูลก่อนส่ง
      if (!this.email || !this.username || !this.fullName || !this.phoneNumber) {
        throw new Error('ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบข้อมูลที่กรอก');
      }

      // ดึง Firebase UID จาก current user
      const currentUser = this.auth.currentUser;
      if (!currentUser || !currentUser.uid) {
        throw new Error('Firebase UID is required');
      }

      // ทำความสะอาดและตรวจสอบข้อมูล
      const cleanEmail = this.email.trim();
      const cleanUsername = this.username.trim();
      const cleanFullName = this.fullName.trim();
      const cleanPhoneNumber = this.phoneNumber.replace(/\D/g, '');
      const userType = this.userType || 'user'; // กำหนดค่า default

      // ตรวจสอบความถูกต้องของข้อมูล
      if (!cleanEmail || cleanEmail.length === 0) {
        throw new Error('อีเมลไม่ถูกต้อง');
      }

      if (!cleanUsername || cleanUsername.length < 3) {
        throw new Error('ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
      }

      if (!cleanFullName || cleanFullName.length === 0) {
        throw new Error('ชื่อ-นามสกุลไม่ถูกต้อง');
      }

      if (!cleanPhoneNumber || cleanPhoneNumber.length < 10) {
        throw new Error('เบอร์โทรศัพท์ต้องมีอย่างน้อย 10 หลัก');
      }

      // ตรวจสอบรูปแบบอีเมล
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
      }

      const userData = {
        firebase_uid: currentUser.uid, // เพิ่ม Firebase UID
        email: cleanEmail,
        username: cleanUsername,
        fullName: cleanFullName,
        phoneNumber: cleanPhoneNumber,
        type: userType,
        emailVerified: false
      };

      console.log('Saving user to backend:', userData); // Debug log
      console.log('Backend URL:', `${this.constants.API_ENDPOINT}/api/auth/register`); // Debug log
      console.log('Data types:', {
        firebase_uid: typeof userData.firebase_uid,
        email: typeof userData.email,
        username: typeof userData.username,
        fullName: typeof userData.fullName,
        phoneNumber: typeof userData.phoneNumber,
        type: typeof userData.type,
        emailVerified: typeof userData.emailVerified
      }); // Debug log

      const response = await firstValueFrom(
        this.http.post(`${this.constants.API_ENDPOINT}/api/auth/register`, userData)
      );

      console.log('Backend registration response:', response); // Debug log
    } catch (error: any) {
      console.error('Error saving user to backend:', error);
      console.error('Error details:', {
        status: error?.status,
        statusText: error?.statusText,
        message: error?.message,
        url: error?.url,
        error: error?.error
      });
      
      // แสดงรายละเอียด error จาก backend
      let errorMessage = 'ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้';
      
      if (error?.status === 400) {
        errorMessage = 'ข้อมูลไม่ถูกต้อง: ';
        if (error?.error?.message) {
          errorMessage += error.error.message;
        } else if (error?.error) {
          errorMessage += JSON.stringify(error.error);
        } else {
          errorMessage += 'กรุณาตรวจสอบข้อมูลที่กรอก';
        }
      } else if (error?.status === 409) {
        errorMessage = 'ข้อมูลซ้ำ: อีเมลหรือชื่อผู้ใช้นี้ถูกใช้ไปแล้ว';
      } else if (error?.status === 500) {
        errorMessage = 'เซิร์ฟเวอร์มีปัญหา กรุณาลองใหม่ภายหลัง';
      } else if (error?.status === 404) {
        errorMessage = 'ไม่พบ API endpoint กรุณาติดต่อผู้ดูแลระบบ';
      } else {
        errorMessage += `: ${error?.message || 'ไม่ทราบสาเหตุ'}`;
      }
      
      // Throw error เพื่อให้ register function จัดการ
      throw new Error(errorMessage);
    }
  }
}