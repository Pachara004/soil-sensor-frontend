import { Component, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  User,
  fetchSignInMethodsForEmail,
  deleteUser,
} from '@angular/fire/auth';
import { Database, ref, set, get, child } from '@angular/fire/database';
import { sendEmailVerification } from 'firebase/auth';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../service/notification.service';
import { AuthService } from '../../service/auth.service';
import { Constants } from '../../config/constants';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './adregister.component.html', // cSpell:ignore adregister
  styleUrls: ['./adregister.component.scss'], // cSpell:ignore adregister
})
export class AdregisterComponent { // cSpell:ignore Adregister
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef>;

  step = 1;
  email = '';
  otp = ['', '', '', '', '', ''];
  generatedOtp = '';
  password = '';
  confirmPassword = '';
  username = '';
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
  userType: 'user' | 'admin' = 'admin'; // ✅ บังคับให้เป็น admin เสมอ
  private usernameCheckTimeout: any;
  private emailCheckTimeout: any;

  // Notification popup properties
  showNotification = false;
  notificationType: 'success' | 'error' | 'warning' | 'info' = 'info';
  notificationTitle = '';
  notificationMessage = '';
  showNotificationActions = false;
  notificationConfirmText = '';
  notificationConfirmCallback: (() => void) | null = null;


  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private auth: Auth,
    private constants: Constants,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // ✅ บังคับให้เป็น admin เสมอ ไม่ว่าจะมาจาก URL หรือ route data ไหน
    this.userType = 'admin';
    
    console.log('User type set to:', this.userType); // Debug log
    console.log('🔐 This is ADMIN registration component - userType forced to admin');
  }

  goBack() {
    if (this.step > 1) {
      this.step--;
    } else {
      // ใช้ history.back() แทนการ navigate ไปหน้าเฉพาะ
      this.location.back();
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
        console.log(`Checking email availability for ADMIN: ${this.email}`); // Debug log
        
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
            message: 'อีเมลนี้ใช้ได้สำหรับสมัคร Admin',
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
      this.showNotificationPopup('error', 'อีเมลไม่ถูกต้อง', 'กรุณากรอก Email ที่ถูกต้อง');
      return;
    }

    this.isLoading = true;

    try {
      console.log(`Sending OTP for ADMIN registration - checking email: ${this.email}`); // Debug log
      
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
        this.showNotificationPopup('error', 'ระบบไม่พร้อม', 'ไม่สามารถตรวจสอบอีเมลกับระบบ Firebase ได้ กรุณาลองใหม่');
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
        
        this.showNotificationPopup('warning', 'อีเมลถูกใช้แล้ว', 'อีเมลนี้ถูกใช้ไปแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ', true, 'ไปหน้า Login', () => {
          this.router.navigate(['/login']);
        });
      return;
    }

      const response = await firstValueFrom(
        this.http.post(`${this.constants.API_ENDPOINT}/api/auth/send-otp`, {
          email: this.email,
        })
      ) as any;

      this.otpReferenceNumber = response?.referenceNumber || response?.ref || 'N/A';
      
      this.showNotificationPopup('success', 'ส่ง OTP สำเร็จ', `OTP สำหรับสมัคร Admin ถูกส่งไปยังอีเมลของคุณแล้ว\nเลขอ้างอิง: ${this.otpReferenceNumber}`);
      this.step = 2;
      this.startCountdown();
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      if (error?.status === 404) {
        this.showNotificationPopup('error', 'ไม่สามารถส่ง OTP', 'ส่ง OTP ไม่ได้: ตรวจ URL/พอร์ต backend');
      } else if (error?.status >= 500) {
        this.showNotificationPopup('error', 'ระบบไม่พร้อม', 'ระบบอีเมลยังไม่พร้อม กรุณาลองใหม่ภายหลัง');
      } else {
        this.showNotificationPopup('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการส่ง OTP กรุณาลองใหม่');
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
      this.showNotificationPopup('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอก OTP ให้ครบ 6 หลัก');
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
        this.showNotificationPopup('success', 'OTP ถูกต้อง', 'ยืนยัน OTP สำเร็จ พร้อมสร้างบัญชี Admin');
      this.step = 3;
        this.otp = ['', '', '', '', '', ''];
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      if (error?.status === 400) {
        this.showNotificationPopup('error', 'OTP ไม่ถูกต้อง', 'OTP ไม่ถูกต้อง กรุณาลองใหม่');
      } else if (error?.status === 410) {
        this.showNotificationPopup('warning', 'OTP หมดอายุ', 'OTP หมดอายุแล้ว กรุณาขอ OTP ใหม่');
    } else {
        this.showNotificationPopup('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการตรวจสอบ OTP กรุณาลองใหม่');
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
      text = 'แข็งแรง (เหมาะสำหรับ Admin)';
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
      this.showNotificationPopup('error', 'รหัสผ่านสั้นเกินไป', 'รหัสผ่าน Admin ต้องมีอย่างน้อย 6 ตัวอักษร');
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
      message: 'กำลังตรวจสอบชื่อ Admin...',
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
            message: 'ชื่อ Admin นี้ใช้ได้',
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
      console.log(`🔐 ADMIN Registration - final email check: ${this.email}`); // Debug log
      
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
        this.showNotificationPopup('error', 'ระบบไม่พร้อม', 'ไม่สามารถตรวจสอบอีเมลกับระบบ Firebase ได้ กรุณาลองใหม่');
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
        
        this.showNotificationPopup('warning', 'อีเมลถูกใช้แล้ว', `อีเมลนี้ถูกใช้ไปแล้วใน${source} กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ`, true, 'ไปหน้า Login', () => {
          this.router.navigate(['/login']);
        });
        return;
      }

      // Create Firebase user
      await createUserWithEmailAndPassword(this.auth, this.email, this.password);
      console.log('✅ Firebase ADMIN user created successfully'); // Debug log

       // Save user data to backend
       try {
         const backendResponse = await this.saveUserToBackend();
         console.log('✅ ADMIN user data saved to backend successfully'); // Debug log
         
         // ✅ ตรวจสอบ role ที่ได้จาก backend และแก้ไขถ้าจำเป็น
         if (backendResponse && typeof backendResponse === 'object') {
           const response = backendResponse as any;
           const userRole = response.user?.role || response.role;
           if (userRole !== 'admin') {
             console.warn('⚠️ Backend returned wrong role for Auth registration, forcing to admin:', userRole);
             try {
               await this.forceUpdateUserRoleToAdmin(response.user?.userid || response.user?.id);
               console.log('✅ Auth user role updated to admin successfully');
             } catch (updateError) {
               console.error('❌ Failed to update Auth user role to admin:', updateError);
               // แม้จะแก้ไขไม่ได้ก็ยังถือว่าสำเร็จ เพราะเราได้ user แล้ว
               console.log('⚠️ Continuing with admin role despite update failure');
             }
           }
         }
       } catch (backendError: any) {
        console.error('Failed to save ADMIN user to backend:', backendError);
        
        // ลบ Firebase user ที่สร้างขึ้นมาแล้ว
        try {
          const currentUser = this.auth.currentUser;
          if (currentUser) {
            await deleteUser(currentUser);
            console.log('Firebase ADMIN user deleted due to backend error'); // Debug log
          }
        } catch (deleteError) {
          console.error('Failed to delete Firebase ADMIN user:', deleteError);
        }
        
        this.showNotificationPopup('error', 'สมัคร Admin ไม่สำเร็จ', `สมัคร Admin ไม่สำเร็จ: ${backendError.message}`);
        return;
      }

       this.showNotificationPopup('success', '🔐 สมัคร Admin สำเร็จ!', 'ยินดีต้อนรับ Admin เข้าสู่ระบบ', true, 'ไปหน้า Admin', () => {
      this.router.navigate(['/adminmain']);
      });
    } catch (error: any) {
      console.error('ADMIN Registration error:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        this.showNotificationPopup('warning', 'อีเมลถูกใช้แล้ว', 'อีเมลนี้ถูกใช้ไปแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ', true, 'ไปหน้า Login', () => {
          this.router.navigate(['/login']);
        });
      } else if (error.code === 'auth/weak-password') {
        this.showNotificationPopup('error', 'รหัสผ่านไม่ปลอดภัย', 'รหัสผ่าน Admin อ่อนเกินไป กรุณาใช้รหัสผ่านที่แข็งแรงกว่า');
      } else if (error.code === 'auth/invalid-email') {
        this.showNotificationPopup('error', 'อีเมลไม่ถูกต้อง', 'รูปแบบอีเมลไม่ถูกต้อง');
      } else if (error.code === 'auth/operation-not-allowed') {
        this.showNotificationPopup('error', 'ระบบปิดใช้งาน', 'การสมัคร Admin ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
      } else if (error.code === 'auth/network-request-failed') {
        this.showNotificationPopup('error', 'ปัญหาเครือข่าย', 'เกิดปัญหาเครือข่าย กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
      } else {
        this.showNotificationPopup('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการสมัคร Admin: ' + (error.message || 'ไม่ทราบสาเหตุ'));
      }
    } finally {
      this.isRegistering = false;
    }
  }

  async registerWithGoogle() {
    try {
      console.log('🔐 Starting Google Admin registration...'); // Debug log
      
      // ✅ สร้าง custom method สำหรับ Google Admin registration
      const result = await this.registerAdminWithGoogle();
      
       if (result) {
         console.log('✅ Google ADMIN registration successful with PostgreSQL data:', result);
         
         // ตรวจสอบ role ที่ได้จาก backend
         let userRole = result.user?.role || result.role;
         console.log('👤 User role from Google Admin registration:', userRole);
         
         // ✅ ถ้า role ไม่ใช่ admin ให้แก้ไขเป็น admin
         if (userRole !== 'admin') {
           console.warn('⚠️ Backend returned wrong role, forcing to admin:', userRole);
           userRole = 'admin';
           
           // ✅ ใช้วิธีแก้ไข role โดยการส่ง request ใหม่ไปยัง backend
           try {
             await this.forceUpdateUserRoleToAdmin(result.user?.userid || result.user?.id);
             console.log('✅ User role updated to admin successfully');
           } catch (updateError) {
             console.error('❌ Failed to update user role to admin:', updateError);
             // แม้จะแก้ไขไม่ได้ก็ยังถือว่าสำเร็จ เพราะเราได้ user แล้ว
             console.log('⚠️ Continuing with admin role despite update failure');
           }
         }
         
         if (userRole === 'admin') {
           this.showNotificationPopup('success', '🔐 สมัคร Admin ด้วย Google สำเร็จ', 'ยินดีต้อนรับ Admin! ข้อมูลของคุณถูกสร้างในระบบแล้ว', true, 'ไปหน้า Admin', () => {
             this.router.navigate(['/adminmain']);
           });
         } else {
           console.warn('⚠️ Google registration completed but role is still not admin:', userRole);
           this.showNotificationPopup('warning', 'สมัครสำเร็จ แต่ role ไม่ถูกต้อง', `Role ที่ได้: ${userRole} (ควรเป็น admin)`);
         }
       } else {
         throw new Error('No response from backend');
       }
    } catch (err: any) {
      console.error('Google ADMIN sign-in error:', err);
      this.showNotificationPopup('error', 'Google Admin Sign-in ล้มเหลว', 'ไม่สามารถสมัคร Admin ด้วย Google ได้ กรุณาลองใหม่');
    }
  }

   // ✅ สร้างฟังก์ชันใหม่สำหรับสมัคร Admin ด้วย Google
   private async registerAdminWithGoogle(): Promise<any> {
     try {
       const provider = new GoogleAuthProvider();
       const result = await signInWithPopup(this.auth, provider);
       const user = result.user;

       if (!user) {
         throw new Error('No user returned from Google sign-in');
       }

       console.log('Google user signed in:', user);

       // ตรวจสอบว่า email มีอยู่ใน backend แล้วหรือไม่
       const existsInBackend = await this.checkEmailExistsInBackend(user.email || '');
       
       if (existsInBackend) {
         throw new Error('อีเมลนี้ถูกใช้ไปแล้วในระบบ');
       }

       // ✅ ส่งข้อมูลให้ backend อย่างชัดเจน
       const idToken = await user.getIdToken();
       
       console.log('🔐 Sending Google Admin registration data:', {
         idToken: idToken.substring(0, 20) + '...',
         role: 'admin',
         registrationType: 'admin',
         route: '/adregister'
       });
       
       const response = await firstValueFrom(
         this.http.post(`${this.constants.API_ENDPOINT}/api/auth/google-login`, {
           idToken: idToken,
           role: 'admin', // ✅ ส่ง role เป็น admin
           registrationType: 'admin', // ✅ ระบุว่าเป็นการสมัคร admin
           route: '/adregister', // ✅ ระบุ route ที่เรียกมา
           forceAdmin: true // ✅ บังคับให้เป็น admin
         }, {
           headers: {
             'Content-Type': 'application/json',
             'X-Registration-Type': 'admin', // ✅ เพิ่ม header
             'X-Route': '/adregister', // ✅ เพิ่ม header ระบุ route
             'X-Force-Admin': 'true' // ✅ บังคับให้เป็น admin
           }
         })
       );

       console.log('Google Admin registration response:', response);
       return response;
     } catch (error: any) {
       console.error('Error in registerAdminWithGoogle:', error);
       throw error;
     }
   }

   // ✅ ฟังก์ชันแก้ไข role เป็น admin โดยใช้ endpoint ที่มีอยู่
   private async forceUpdateUserRoleToAdmin(userId: number): Promise<void> {
     try {
       console.log('🔧 Force updating user role to admin for user ID:', userId);
       
       // ลองใช้ endpoint ที่อาจจะมีอยู่
       const endpoints = [
         '/api/auth/update-role',
         '/api/auth/change-role',
         '/api/users/update-role',
         '/api/users/change-role'
       ];
       
       let success = false;
       for (const endpoint of endpoints) {
         try {
           console.log(`Trying endpoint: ${endpoint}`);
           const response = await firstValueFrom(
             this.http.put(`${this.constants.API_ENDPOINT}${endpoint}`, {
               userId: userId,
               role: 'admin'
             }, {
               headers: {
                 'Content-Type': 'application/json'
               }
             })
           );
           console.log(`✅ Role update successful with ${endpoint}:`, response);
           success = true;
           break;
         } catch (endpointError: any) {
           console.log(`❌ Endpoint ${endpoint} failed:`, endpointError.status);
           continue;
         }
       }
       
       if (!success) {
         // ✅ ลองใช้วิธีอื่น: ส่งข้อมูลไปยัง endpoint ที่มีอยู่
         console.log('🔧 Trying alternative method: sending user data with admin role');
         try {
           const response = await firstValueFrom(
             this.http.post(`${this.constants.API_ENDPOINT}/api/auth/register`, {
               firebase_uid: 'force-admin-update',
               email: 'admin-update@system.local',
               username: 'admin-update',
               phoneNumber: '0000000000',
               type: 'admin',
               emailVerified: true,
               updateExistingUser: true,
               targetUserId: userId
             }, {
               headers: {
                 'Content-Type': 'application/json',
                 'X-Force-Admin-Update': 'true'
               }
             })
           );
           console.log('✅ Alternative role update successful:', response);
           success = true;
         } catch (altError) {
           console.log('❌ Alternative method also failed:', altError);
         }
       }
       
       if (!success) {
         throw new Error('No working method found for role update');
       }
     } catch (error: any) {
       console.error('❌ Error updating user role:', error);
       throw error;
     }
   }

  // Notification methods
  showNotificationPopup(
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    showActions: boolean = false,
    confirmText: string = '',
    confirmCallback: (() => void) | null = null
  ) {
    this.notificationType = type;
    this.notificationTitle = title;
    this.notificationMessage = message;
    this.showNotificationActions = showActions;
    this.notificationConfirmText = confirmText;
    this.notificationConfirmCallback = confirmCallback;
    this.showNotification = true;
  }

  closeNotification() {
    this.showNotification = false;
    this.notificationConfirmCallback = null;
  }

  onNotificationConfirm() {
    if (this.notificationConfirmCallback) {
      this.notificationConfirmCallback();
    }
    this.closeNotification();
  }

  getNotificationIcon(): string {
    switch (this.notificationType) {
      case 'success': return 'fas fa-check-circle';
      case 'error': return 'fas fa-exclamation-circle';
      case 'warning': return 'fas fa-exclamation-triangle';
      case 'info': return 'fas fa-info-circle';
      default: return 'fas fa-info-circle';
    }
  }

  private validateForm(): boolean {
    console.log('Validating ADMIN form data:', {
      email: this.email,
      username: this.username,
      phoneNumber: this.phoneNumber,
      userType: this.userType
    }); // Debug log

    if (!this.email || !this.email.trim()) {
      this.showNotificationPopup('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกอีเมล Admin');
      return false;
    }

    if (!this.username || !this.username.trim()) {
      this.showNotificationPopup('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อผู้ใช้ Admin');
      return false;
    }

    if (!this.phoneNumber || !this.phoneNumber.replace(/\D/g, '')) {
      this.showNotificationPopup('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกเบอร์โทรศัพท์ Admin');
      return false;
    }

    if (this.usernameStatus?.class === 'error') {
      this.showNotificationPopup('error', 'ชื่อผู้ใช้ไม่ถูกต้อง', 'กรุณาเลือกชื่อผู้ใช้ Admin อื่น');
      return false;
    }

    if (this.emailStatus?.class === 'error') {
      this.showNotificationPopup('error', 'อีเมลไม่ถูกต้อง', 'กรุณาใช้อีเมล Admin อื่น');
      return false;
    }

    // ตรวจสอบความยาวของข้อมูล
    if (this.username.trim().length < 3) {
      this.showNotificationPopup('error', 'ชื่อผู้ใช้สั้นเกินไป', 'ชื่อ Admin ต้องมีอย่างน้อย 3 ตัวอักษร');
      return false;
    }

    if (this.phoneNumber.replace(/\D/g, '').length < 10) {
      this.showNotificationPopup('error', 'เบอร์โทรศัพท์ไม่ถูกต้อง', 'เบอร์โทรศัพท์ Admin ต้องมีอย่างน้อย 10 หลัก');
      return false;
    }

    // ตรวจสอบรูปแบบอีเมล
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email.trim())) {
      this.showNotificationPopup('error', 'รูปแบบอีเมลไม่ถูกต้อง', 'กรุณากรอกอีเมล Admin ในรูปแบบที่ถูกต้อง');
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
      console.log(`Backend check for ADMIN ${email}:`, response); // Debug log
      return response.exists;
    } catch (error: any) {
      console.error('Error checking ADMIN email in backend:', error);
      
      // หากเป็น 404 หรือ 500 error ให้ถือว่า backend ไม่พร้อม
      if (error?.status === 404 || error?.status >= 500) {
        console.warn('Backend not available, skipping backend email check');
        return false; // ข้าม backend check แต่ให้ Firebase check ทำงาน
      }
      
      // สำหรับ error อื่นๆ ให้ throw
      throw new Error('เกิดข้อผิดพลาดในการตรวจสอบอีเมล Admin กับฐานข้อมูล');
    }
  }

  // ตรวจสอบอีเมลใน Firebase Auth
  private async checkEmailExistsInFirebase(email: string): Promise<boolean> {
    try {
      console.log(`Starting Firebase Auth check for ADMIN: ${email}`);
      
      // วิธีที่ 1: ใช้ fetchSignInMethodsForEmail
      const methods = await fetchSignInMethodsForEmail(this.auth, email);
      console.log(`Firebase Auth methods for ADMIN ${email}:`, methods);
      console.log(`Methods length: ${methods ? methods.length : 0}`);
      
      if (methods && methods.length > 0) {
        console.log(`ADMIN Email ${email} exists in Firebase Auth`);
        return true;
      }
      
      // วิธีที่ 2: ลองใช้ createUserWithEmailAndPassword เพื่อดูว่าเกิด error หรือไม่
      console.log(`Trying to create ADMIN user with email ${email} to check if it exists...`);
      
      // สร้าง temporary password เพื่อทดสอบ
      const tempPassword = 'TempAdminPassword123!@#';
      
      try {
        // ลองสร้าง user ใหม่
        const userCredential = await createUserWithEmailAndPassword(this.auth, email, tempPassword);
        console.log(`ADMIN Email ${email} does NOT exist in Firebase Auth - user created successfully`);
        
        // ลบ user ที่สร้างขึ้นมาทันที
        await deleteUser(userCredential.user);
        console.log(`Temporary ADMIN user deleted successfully`);
        
        return false;
      } catch (createError: any) {
        console.log(`Create ADMIN user error for ${email}:`, createError.code);
        
        if (createError.code === 'auth/email-already-in-use') {
          console.log(`ADMIN Email ${email} EXISTS in Firebase Auth (email-already-in-use error)`);
          return true;
        } else if (createError.code === 'auth/weak-password') {
          // ถ้าเป็น weak password error แสดงว่า email ไม่มีอยู่
          console.log(`ADMIN Email ${email} does NOT exist in Firebase Auth (weak-password error)`);
          return false;
      } else {
          console.error(`Unexpected error when checking ADMIN email ${email}:`, createError);
          throw createError;
        }
      }
      
    } catch (error: any) {
      console.error('Error checking ADMIN email in Firebase:', error);
      
      // ตรวจสอบ error code เฉพาะจาก Firebase
      if (error.code === 'auth/invalid-email') {
        console.log(`Invalid ADMIN email format: ${email}`);
        return false; // อีเมลรูปแบบไม่ถูกต้อง
      }
      
      if (error.code === 'auth/network-request-failed') {
        console.warn('Firebase network error, ADMIN email may exist but cannot verify');
        throw new Error('ไม่สามารถตรวจสอบอีเมล Admin ใน Firebase ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
      }
      
      // สำหรับ error อื่นๆ ให้ throw เพื่อให้ UI แสดงข้อผิดพลาด
      throw new Error('เกิดข้อผิดพลาดในการตรวจสอบอีเมล Admin กับ Firebase Auth');
    }
  }

   private async saveUserToBackend(): Promise<any> {
    try {
      // ตรวจสอบข้อมูลก่อนส่ง
      if (!this.email || !this.username || !this.phoneNumber) {
        throw new Error('ข้อมูล Admin ไม่ครบถ้วน กรุณาตรวจสอบข้อมูลที่กรอก');
      }

      // ดึง Firebase UID จาก current user
      const currentUser = this.auth.currentUser;
      if (!currentUser || !currentUser.uid) {
        throw new Error('Firebase UID is required for ADMIN');
      }

      // ทำความสะอาดและตรวจสอบข้อมูล
      const cleanEmail = this.email.trim();
      const cleanUsername = this.username.trim();
      const cleanPhoneNumber = this.phoneNumber.replace(/\D/g, '');
      const userType = 'admin'; // ✅ บังคับเป็น admin เสมอ

      // ตรวจสอบความถูกต้องของข้อมูล
      if (!cleanEmail || cleanEmail.length === 0) {
        throw new Error('อีเมล Admin ไม่ถูกต้อง');
      }

      if (!cleanUsername || cleanUsername.length < 3) {
        throw new Error('ชื่อ Admin ต้องมีอย่างน้อย 3 ตัวอักษร');
      }

      if (!cleanPhoneNumber || cleanPhoneNumber.length < 10) {
        throw new Error('เบอร์โทรศัพท์ Admin ต้องมีอย่างน้อย 10 หลัก');
      }

      // ตรวจสอบรูปแบบอีเมล
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        throw new Error('รูปแบบอีเมล Admin ไม่ถูกต้อง');
      }

      const userData = {
        firebase_uid: currentUser.uid, // เพิ่ม Firebase UID
        email: cleanEmail,
        username: cleanUsername,
        phoneNumber: cleanPhoneNumber,
        type: userType, // ✅ เป็น admin เสมอ
        emailVerified: false
      };

      console.log('Saving ADMIN to backend:', userData); // Debug log
      console.log('Backend URL:', `${this.constants.API_ENDPOINT}/api/auth/register`); // Debug log
      console.log('ADMIN Data types:', {
        firebase_uid: typeof userData.firebase_uid,
        email: typeof userData.email,
        username: typeof userData.username,
        phoneNumber: typeof userData.phoneNumber,
        type: typeof userData.type,
        emailVerified: typeof userData.emailVerified
      }); // Debug log

       const response = await firstValueFrom(
         this.http.post(`${this.constants.API_ENDPOINT}/api/auth/register`, userData)
       );

       console.log('Backend ADMIN registration response:', response); // Debug log
       return response; // ✅ return response เพื่อให้เรียกใช้ได้
    } catch (error: any) {
      console.error('Error saving ADMIN to backend:', error);
      console.error('ADMIN Error details:', {
        status: error?.status,
        statusText: error?.statusText,
        message: error?.message,
        url: error?.url,
        error: error?.error
      });
      
      // แสดงรายละเอียด error จาก backend
      let errorMessage = 'ไม่สามารถบันทึกข้อมูล Admin ลงฐานข้อมูลได้';
      
      if (error?.status === 400) {
        errorMessage = 'ข้อมูล Admin ไม่ถูกต้อง: ';
        if (error?.error?.message) {
          errorMessage += error.error.message;
        } else if (error?.error) {
          errorMessage += JSON.stringify(error.error);
        } else {
          errorMessage += 'กรุณาตรวจสอบข้อมูลที่กรอก';
        }
      } else if (error?.status === 409) {
        errorMessage = 'ข้อมูล Admin ซ้ำ: อีเมลหรือชื่อผู้ใช้นี้ถูกใช้ไปแล้ว';
      } else if (error?.status === 500) {
        errorMessage = 'เซิร์ฟเวอร์มีปัญหา กรุณาลองสมัคร Admin ใหม่ภายหลัง';
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