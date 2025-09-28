import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Auth, onAuthStateChanged, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from '@angular/fire/auth';
import { NotificationService } from '../../../service/notification.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss'
})
export class ChangePasswordComponent implements OnInit {
  currentPassword: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  isLoading: boolean = false;
  showCurrentPassword: boolean = false;
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  currentUser: any = null;
  passwordStrength = { width: 0, class: '', text: '' };
  passwordMismatch: boolean = false;

  constructor(
    private auth: Auth,
    private router: Router,
    private location: Location,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      if (!user) {
        this.router.navigate(['/']);
      }
    });
  }

  toggleCurrentPassword() {
    this.showCurrentPassword = !this.showCurrentPassword;
  }

  toggleNewPassword() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
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

  canChangePassword(): boolean {
    return (
      this.currentPassword.trim() !== '' &&
      this.newPassword.trim() !== '' &&
      this.confirmPassword.trim() !== '' &&
      this.newPassword === this.confirmPassword &&
      this.passwordStrength.width >= 40 && // อย่างน้อย medium strength
      !this.passwordMismatch
    );
  }

  async changePassword() {
    if (!this.canChangePassword()) {
      this.notificationService.showNotification('error', 'ข้อมูลไม่ถูกต้อง', 'กรุณาตรวจสอบข้อมูลให้ครบถ้วน');
      return;
    }

    if (!this.currentUser) {
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'ไม่พบผู้ใช้ปัจจุบัน');
      return;
    }

    this.isLoading = true;

    try {
      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(
        this.currentUser.email,
        this.currentPassword
      );

      await reauthenticateWithCredential(this.currentUser, credential);

      // Update password
      await updatePassword(this.currentUser, this.newPassword);

      this.notificationService.showNotification('success', 'เปลี่ยนรหัสผ่านสำเร็จ', 'รหัสผ่านของคุณได้รับการอัปเดตแล้ว', true, 'กลับ', () => {
        this.router.navigate(['/profile']);
      });

      // Clear form
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
      this.passwordStrength = { width: 0, class: '', text: '' };
      this.passwordMismatch = false;

    } catch (error: any) {
      console.error('Error changing password:', error);
      
      let errorMessage = 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'รหัสผ่านปัจจุบันไม่ถูกต้อง';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'รหัสผ่านใหม่ไม่แข็งแรงพอ';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'กรุณาเข้าสู่ระบบใหม่ก่อนเปลี่ยนรหัสผ่าน';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'มีการพยายามเปลี่ยนรหัสผ่านบ่อยเกินไป กรุณารอสักครู่';
      }

      this.notificationService.showNotification('error', 'ไม่สามารถเปลี่ยนรหัสผ่านได้', errorMessage);
    } finally {
      this.isLoading = false;
    }
  }

  goBack() {
    // ใช้ history.back() แทนการ navigate ไปหน้าเฉพาะ
    this.location.back();
  }
}
