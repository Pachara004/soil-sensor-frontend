import { Component, OnInit, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Constants } from '../../../config/constants';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { lastValueFrom } from 'rxjs';
import { NotificationService } from '../../../service/notification.service';
interface UserData {
  email: string;
  password: string;
  phoneNumber: string;
  type: string;
  userID: string;
  username: string;
  devices?: { [key: string]: boolean };
}
@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './edit-profile.component.html',
  styleUrl: './edit-profile.component.scss',
})
export class EditProfileComponent implements OnInit {
  userID: string | null = null;
  username: string = '';
  email: string = '';
  phoneNumber: string = '';
  password: string = '';
  confirmPassword: string = '';
  isLoading: boolean = true;
  showCardMenu = false;
  currentUser: any = null;
  // ✅ Phone number validation properties
  phoneNumberError: boolean = false;
  phoneNumberErrorMessage: string = '';
  private apiUrl: string;
  constructor(
    private router: Router,
    private location: Location,
    private http: HttpClient,
    private constants: Constants,
    private auth: Auth,
    private notificationService: NotificationService
  ) {
    this.apiUrl = this.constants.API_ENDPOINT;
  }
  ngOnInit(): void {
    // ✅ ใช้ Firebase Auth แทน localStorage
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.currentUser = user;
        this.username = user.displayName || user.email?.split('@')[0] || '';
        this.email = user.email || '';
        // ✅ ดึงข้อมูลเพิ่มเติมจาก backend
        await this.loadUserProfile();
      } else {
        this.router.navigate(['/']);
      }
    });
  }
  // ✅ ดึงข้อมูล user profile จาก backend
  async loadUserProfile() {
    if (!this.currentUser) return;
    try {
      const token = await this.currentUser.getIdToken();
      // ✅ ดึงข้อมูล user
      try {
        const userResponse = await lastValueFrom(
          this.http.get<any>(`${this.apiUrl}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );
        if (userResponse && userResponse.user) {
          const userData = userResponse.user;
          this.username = userData.user_name || userData.username || this.username;
          this.email = userData.user_email || userData.email || this.email;
          this.phoneNumber = userData.user_phone || userData.phone || '';
        } else {
        }
      } catch (userError) {
      }
      this.isLoading = false;
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
      this.isLoading = false;
    }
  }
  async saveProfile() {
    // ✅ ตรวจสอบ validation เบอร์โทรศัพท์ก่อนบันทึก
    this.validatePhoneNumber();
    if (this.phoneNumberError) {
      this.notificationService.showNotification('error', 'ข้อมูลไม่ถูกต้อง', this.phoneNumberErrorMessage);
      return;
    }

    if (this.password && this.password !== this.confirmPassword) {
      this.notificationService.showNotification('error', 'รหัสผ่านไม่ตรงกัน', 'รหัสผ่านไม่ตรงกัน');
      return;
    }
    if (!this.currentUser || !this.username) {
      this.notificationService.showNotification('error', 'ข้อมูลไม่ครบถ้วน', 'ไม่พบข้อมูลผู้ใช้หรือชื่อผู้ใช้');
      return;
    }
    try {
      // ✅ ดึง Firebase ID token
      const token = await this.currentUser.getIdToken();
      // ✅ เตรียมข้อมูลสำหรับอัปเดต
      const updateData: any = {
        user_name: this.username,
        user_email: this.email,
        user_phone: this.phoneNumber
      };
      // ✅ ถ้ามีรหัสผ่านใหม่ ให้เพิ่มเข้าไป
      if (this.password) {
        updateData.user_password = this.password;
      }
      console.log('📤 Sending update data:', updateData);
      // ✅ ใช้ endpoint ที่มีอยู่จริง - ต้องใช้ userid แทน username
      // ดึง userid จาก backend ก่อน
      let userid = null;
      try {
        const userResponse = await lastValueFrom(
          this.http.get<any>(`${this.apiUrl}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );
        userid = userResponse.user?.userid || userResponse.userid;
      } catch (userError) {
        console.error('❌ Could not get user ID:', userError);
        this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลผู้ใช้ได้');
        return;
      }
      if (!userid) {
        this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'ไม่พบรหัสผู้ใช้');
        return;
      }
      const response = await lastValueFrom(
        this.http.put<any>(`${this.apiUrl}/api/users/${userid}`, updateData, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );
      this.notificationService.showNotification('success', 'บันทึกข้อมูลสำเร็จ!', 'ข้อมูลของคุณได้รับการอัปเดตแล้ว', true, 'กลับ', () => {
        this.location.back();
      });
    } catch (error: any) {
      console.error('❌ Error saving profile:', error);
      let errorMessage = 'เกิดข้อผิดพลาดในการบันทึก';
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', errorMessage);
    }
  }
  goBack() {
    // ใช้ history.back() แทนการ navigate ไปหน้าเฉพาะ
    this.location.back();
  }
  goToContactAdmin() {
    this.router.navigate(['/reports']);
  }
  goToHistory() {
    this.router.navigate(['/history']);
  }
  toggleCardMenu() {
    this.showCardMenu = !this.showCardMenu;
  }
  closeCardMenu() {
    this.showCardMenu = false;
  }

  // ✅ จัดการ input เบอร์โทรศัพท์ - อนุญาตเฉพาะตัวเลข 0-9
  onPhoneNumberKeyPress(event: KeyboardEvent) {
    const charCode = event.which ? event.which : event.keyCode;
    // อนุญาตเฉพาะตัวเลข 0-9 (48-57) และปุ่มควบคุม (backspace, delete, tab, etc.)
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  // ✅ จัดการ input event เพื่อจำกัดความยาวและลบตัวอักษรที่ไม่ใช่ตัวเลข
  onPhoneNumberInput(event: any) {
    let value = event.target.value;
    // ลบตัวอักษรที่ไม่ใช่ตัวเลข
    value = value.replace(/[^0-9]/g, '');
    // จำกัดความยาวไม่เกิน 10 ตัว
    if (value.length > 10) {
      value = value.substring(0, 10);
    }
    // อัปเดตค่าใน model
    this.phoneNumber = value;
    // อัปเดตค่าใน input field
    event.target.value = value;
    // ✅ ตรวจสอบ validation แบบ real-time
    this.validatePhoneNumber();
  }

  // ✅ ฟังก์ชัน validate เบอร์โทรศัพท์
  validatePhoneNumber() {
    if (this.phoneNumber.length === 0) {
      // ถ้าไม่มีข้อมูล ไม่แสดง error
      this.phoneNumberError = false;
      this.phoneNumberErrorMessage = '';
    } else if (this.phoneNumber.length < 10) {
      // ถ้าน้อยกว่า 10 หลัก แสดง error
      this.phoneNumberError = true;
      this.phoneNumberErrorMessage = `กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก (ปัจจุบัน ${this.phoneNumber.length} หลัก)`;
    } else if (this.phoneNumber.length === 10) {
      // ถ้าครบ 10 หลัก ไม่แสดง error
      this.phoneNumberError = false;
      this.phoneNumberErrorMessage = '';
    }
  }

  // ปิด menu เมื่อคลิกข้างนอก
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (!(event.target as Element).closest('.card-menu')) {
      this.closeCardMenu();
    }
  }
}
