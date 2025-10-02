import { Component, OnInit, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Constants } from '../../../config/constants';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { lastValueFrom } from 'rxjs';
import { NotificationService } from '../../../service/notification.service';
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  userID: string | null = null;
  name: string = '';
  username: string = '';
  email: string = '';
  phoneNumber: string = '';
  userType: string = '';
  emailVerified: boolean = false;
  isLoading: boolean = true;
  showCardMenu = false;
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
    // ตรวจสอบ Firebase auth state
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.loadUserProfile(user);
      } else {
        this.router.navigate(['/']);
      }
    });
  }
  async loadUserProfile(firebaseUser: any) {
    try {
      this.isLoading = true;
      // ใช้ข้อมูลจาก Firebase เป็นหลัก
      this.userID = firebaseUser.uid;
      this.email = firebaseUser.email || '';
      this.emailVerified = firebaseUser.emailVerified || false;
      this.name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '';
      this.username = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '';
      // ลองดึงข้อมูลเพิ่มเติมจาก backend
      try {
        const token = await firebaseUser.getIdToken();
        // ลองใช้ API endpoints หลายตัว
        const endpoints = [
          '/api/auth/me',
          '/api/user/profile',
          '/api/user/me'
        ];
        for (const endpoint of endpoints) {
          try {
            const response = await lastValueFrom(
              this.http.get<any>(`${this.apiUrl}${endpoint}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              })
            );
            // อัปเดตข้อมูลจาก backend ถ้ามี
            let userData = response;
            if (response.user) {
              userData = response.user;
            }
            console.log('📋 User data from backend:', userData);
            if (userData.user_name || userData.username || userData.name) {
              this.username = userData.user_name || userData.username || userData.name || this.username;
              this.name = userData.user_name || userData.username || userData.name || this.name;
            }
            if (userData.email) {
              this.email = userData.email;
            }
            // ลองหาเบอร์โทรศัพท์จาก field names หลายแบบ
            const phoneValue = userData.user_phone ||  // ✅ เพิ่ม user_phone
                              userData.phone || 
                              userData.phoneNumber || 
                              userData.phone_number || 
                              userData.mobile || 
                              userData.tel || 
                              userData.contact || 
                              userData.phone_no ||
                              userData.phoneNo ||
                              '';
            if (phoneValue) {
              this.phoneNumber = phoneValue;
              console.log('📞 Phone number found:', phoneValue);
            } else {
            }
            // ตรวจสอบ role field จาก PostgreSQL
            if (userData.role || userData.type || userData.userType) {
              this.userType = userData.role || userData.type || userData.userType || 'user';
              console.log('👥 User role/type found:', this.userType);
            } else {
              this.userType = 'user';
            }
            break; // หยุดเมื่อเจอ endpoint ที่ทำงานได้
          } catch (endpointError: any) {
            console.log(`❌ Endpoint ${endpoint} failed:`, endpointError.status);
            continue; // ลอง endpoint ถัดไป
          }
        }
      } catch (tokenError) {
      }
    } catch (error: any) {
      console.error('❌ Error loading user profile:', error);
    } finally {
      this.isLoading = false;
    }
  }
  goBack() {
    // ใช้ history.back() แทนการ navigate ไปหน้าเฉพาะ
    this.location.back();
  }
  goToEditProfile() {
    this.router.navigate(['/edit-profile']);
  }
  goToChangePassword() {
    this.router.navigate(['/change-password']);
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
  // ปิด menu เมื่อคลิกข้างนอก
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (!(event.target as Element).closest('.card-menu')) {
      this.closeCardMenu();
    }
  }
  async deleteAccount() {
    // แสดง confirmation dialog แบบเข้มงวด
    this.notificationService.showNotification(
      'warning', 
      '⚠️ ยืนยันการลบบัญชี', 
      `คุณแน่ใจหรือไม่ว่าต้องการลบบัญชี "${this.username || this.email}"?\n\n⚠️ คำเตือน:\n• การกระทำนี้ไม่สามารถย้อนกลับได้\n• ข้อมูลทั้งหมดของคุณจะถูกลบถาวร\n• ประวัติการวัดและอุปกรณ์จะถูกลบ\n• คุณจะไม่สามารถเข้าสู่ระบบด้วยบัญชีนี้อีก`, 
      true, 
      '🗑️ ลบบัญชีถาวร', 
      async () => {
        // การยืนยันขั้นที่สอง - ป้องกันการกดผิด
        this.notificationService.showNotification(
          'error', 
          '🚨 การยืนยันขั้นสุดท้าย', 
          `กรุณายืนยันอีกครั้ง!\n\nคุณกำลังจะลบบัญชี "${this.username || this.email}" อย่างถาวร\n\nหากคุณแน่ใจ กรุณากด "ยืนยันการลบ"`, 
          true, 
          '💀 ยืนยันการลบ', 
          async () => {
            try {
              const currentUser = this.auth.currentUser;
              if (!currentUser) {
                this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'ไม่พบข้อมูลผู้ใช้');
                return;
              }
              const token = await currentUser.getIdToken();
              const response = await lastValueFrom(
                this.http.delete(`${this.apiUrl}/api/auth/delete-account`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                })
              );
              // แสดงข้อความสำเร็จ
              this.notificationService.showNotification(
                'success', 
                '✅ ลบบัญชีสำเร็จ', 
                'บัญชีของคุณถูกลบเรียบร้อยแล้ว กำลังนำคุณไปหน้าเข้าสู่ระบบ...'
              );
              // รอ 3 วินาทีแล้ว redirect ไปหน้า login
              setTimeout(() => {
                this.router.navigate(['/login']);
              }, 3000);
            } catch (error: any) {
              console.error('Error deleting account:', error);
              // แสดง error message ที่ชัดเจนขึ้น
              let errorMessage = 'ไม่สามารถลบบัญชีได้';
              let errorTitle = 'เกิดข้อผิดพลาด';
              if (error.status === 404) {
                errorMessage = 'ไม่พบบัญชีที่ต้องการลบ';
                errorTitle = 'ไม่พบข้อมูล';
              } else if (error.status === 403) {
                errorMessage = 'ไม่มีสิทธิ์ในการลบบัญชีนี้';
                errorTitle = 'ไม่มีสิทธิ์';
              } else if (error.status === 400) {
                errorMessage = error.error?.message || 'ข้อมูลไม่ถูกต้อง';
                errorTitle = 'ข้อมูลไม่ถูกต้อง';
              } else if (error.status === 500) {
                errorMessage = 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง';
                errorTitle = 'Server Error';
              } else if (error.status === 401) {
                errorMessage = 'หมดอายุการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่';
                errorTitle = 'หมดอายุ';
              }
              this.notificationService.showNotification('error', errorTitle, errorMessage);
            }
          }
        );
      }
    );
  }
}
