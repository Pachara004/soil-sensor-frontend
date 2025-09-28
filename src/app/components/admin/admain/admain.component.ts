import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AdminService } from '../../../service/AdminService';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs'; // เปลี่ยนจาก rxjs/operators มาเป็น rxjs
import { Constants } from '../../../config/constants'; // ปรับ path ตามโครงสร้าง
import { NotificationService } from '../../../service/notification.service';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { lastValueFrom } from 'rxjs';

interface UserData {
  username: string;
  email?: string;
  type?: string;
  createdAt?: number | string;
  [key: string]: any;
}

const isNonAdmin = (u: UserData) =>
  ((u.type || 'user') + '').toLowerCase() !== 'admin';

@Component({
  selector: 'app-admain',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './admain.component.html',
  styleUrl: './admain.component.scss',
})
export class AdmainComponent implements OnInit, OnDestroy {
  adminName: string | null = null;
  adminEmail: string | null = null;
  currentUser: any = null; // ✅ เพิ่ม currentUser property
  devices: any[] = [];
  newDeviceName = '';
  newDeviceUser = '';
  hwDeviceId = '';
  hwDeviceName = '';
  hwDeviceUser = '';

  allUsers: UserData[] = [];
  allUsersDisplay: UserData[] = [];
  filteredUsers: UserData[] = [];
  regularUsers: UserData[] = [];
  regularUsersDisplay: UserData[] = [];
  unreadCount = 0;
  totalUsers = 0;
  regularUsersCount = 0;
  totalUsersFiltered = 0;
  showUsersList = true;
  showRegularUsersList = true;
  showEditModal = false;
  loadingUsers = false;
  showDevicesList = false;
  editingUser: UserData = { username: '' };
  newPassword = '';
  
  // ✅ Device selection properties
  selectedDeviceId: string = '';
  selectedDevice: any = null;
  suggestOpen = false;

  // Stub fields used in template
  pendingClaims: any[] = [];

  private searchSubject = new Subject<string>();
  private apiUrl: string;

  constructor(
    private adminService: AdminService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    private constants: Constants, // Inject Constants
    private notificationService: NotificationService,
    private auth: Auth // ✅ เพิ่ม Auth service
  ) {
    this.apiUrl = this.constants.API_ENDPOINT; // ใช้ instance ของ Constants

    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => this.filterUsers(query));
  }

  async ngOnInit() {
    // ✅ ใช้ Firebase Auth แทน localStorage
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.currentUser = user;
        console.log('✅ Admin user authenticated:', user.email);
        
        // ✅ ดึงข้อมูล admin จาก PostgreSQL
        await this.loadAdminData();
        
        // ✅ ตรวจสอบว่าเป็น admin หรือไม่
        if (this.adminName) {
          await this.loadDevices();
          await this.loadAllUsersOnce();
          await this.loadRegularUsers();
    } else {
          console.log('❌ User is not admin, redirecting to login');
          this.notificationService.showNotification('warning', 'ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์เข้าถึงหน้า Admin', true, 'ไปหน้า Login', () => {
      this.router.navigate(['/']);
          });
        }
        } else {
        console.log('❌ No user found, redirecting to login');
        this.notificationService.showNotification('warning', 'กรุณาล็อกอิน', 'กรุณาล็อกอินก่อน', true, 'ไปหน้า Login', () => {
          this.router.navigate(['/']);
        });
      }
    });
  }

  ngOnDestroy() {
    this.searchSubject.unsubscribe();
  }

  // ✅ ฟังก์ชันดึงข้อมูล admin จาก PostgreSQL
  async loadAdminData() {
    if (!this.currentUser) return;
    
    try {
      console.log('👤 Loading admin data from PostgreSQL...');
      const token = await this.currentUser.getIdToken();
      
      // ลองใช้หลาย endpoints เพื่อดึงข้อมูล admin
      const userEndpoints = [
        '/api/auth/me',
        '/api/user/profile',
        '/api/user/me',
        '/api/profile'
      ];

      let adminDataFound = false;
      for (const endpoint of userEndpoints) {
        try {
          console.log(`🔍 Trying admin endpoint: ${endpoint}`);
          const userResponse = await lastValueFrom(
            this.http.get<any>(`${this.apiUrl}${endpoint}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
          );
          
          let userData = userResponse;
          if (userResponse.user) {
            userData = userResponse.user;
          }
          
          // ✅ ตรวจสอบว่าเป็น admin หรือไม่
          if (userData && (userData.role === 'admin' || userData.type === 'admin')) {
            this.adminName = userData.user_name || userData.username || userData.name || 'Admin';
            this.adminEmail = userData.user_email || userData.email || this.currentUser.email;
            console.log(`✅ Admin data loaded from PostgreSQL ${endpoint}:`, {
              adminName: this.adminName,
              adminEmail: this.adminEmail,
              role: userData.role || userData.type
            });
            adminDataFound = true;
            break; // หยุดเมื่อเจอ endpoint ที่ทำงานได้
          }
        } catch (userError: any) {
          console.log(`❌ Admin endpoint ${endpoint} failed:`, userError.status);
          continue; // ลอง endpoint ถัดไป
        }
      }

      if (!adminDataFound) {
        console.log('⚠️ No PostgreSQL admin data found, checking localStorage fallback');
        // ✅ ลองใช้ข้อมูลจาก localStorage เป็น fallback
        const adminData = localStorage.getItem('admin');
        if (adminData) {
          try {
            const parsedData = JSON.parse(adminData);
            this.adminName = parsedData.name || parsedData.username || 'Admin';
            this.adminEmail = parsedData.email || this.currentUser.email;
            console.log('👤 Using localStorage admin data as fallback:', {
              adminName: this.adminName,
              adminEmail: this.adminEmail
            });
          } catch (e) {
            console.error('JSON parse error:', e);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error loading admin data:', error);
    }
  }

  // Stub method used in template input handler
  onUserInput() {
    // no-op stub to satisfy template binding
  }

  async loadDevices() {
    try {
      const devicesResult = await this.adminService.getDevices();
      
      // ✅ ตรวจสอบว่า devicesResult เป็น array หรือไม่
      if (Array.isArray(devicesResult)) {
        this.devices = devicesResult;
    } else {
        console.warn('⚠️ getDevices() returned non-array:', devicesResult);
        this.devices = [];
      }
      
      this.cdr.detectChanges();
      console.log('✅ Devices loaded successfully:', {
        totalDevices: this.devices.length,
        devices: this.devices
      });
    } catch (error) {
      console.error('❌ Error loading devices:', error);
      this.devices = [];
      this.cdr.detectChanges();
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโหลดอุปกรณ์');
    }
  }

  async loadAllUsersOnce() {
    try {
      this.loadingUsers = true;
      const usersResult = await this.adminService.getAllUsers();
      
      // ✅ ตรวจสอบว่า usersResult เป็น array หรือไม่
      if (Array.isArray(usersResult)) {
        this.allUsers = usersResult;
      } else {
        console.warn('⚠️ getAllUsers() returned non-array:', usersResult);
        this.allUsers = [];
      }
      
      this.allUsersDisplay = [...this.allUsers];
      this.filteredUsers = [...this.allUsers];
      this.totalUsers = this.allUsers.length;
      this.totalUsersFiltered = this.filteredUsers.length;
      this.loadingUsers = false;
      this.cdr.detectChanges();
      
      console.log('✅ Users loaded successfully:', {
        totalUsers: this.totalUsers,
        users: this.allUsers
      });
    } catch (error) {
      console.error('❌ Error loading users:', error);
      this.allUsers = [];
      this.allUsersDisplay = [];
      this.filteredUsers = [];
      this.totalUsers = 0;
      this.totalUsersFiltered = 0;
      this.loadingUsers = false;
      this.cdr.detectChanges();
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโหลดผู้ใช้');
    }
  }

  filterUsers(query: string) {
    this.filteredUsers = this.allUsersDisplay.filter(
      (user) =>
        user.username.toLowerCase().includes(query.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(query.toLowerCase()))
    );
    this.totalUsersFiltered = this.filteredUsers.length;
    this.cdr.detectChanges();
  }

  onSearch(event: Event) {
    const query = (event.target as HTMLInputElement).value;
    this.searchSubject.next(query);
  }

  async addDevice() {
    if (!this.newDeviceName || !this.newDeviceUser) {
      this.notificationService.showNotification('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่ออุปกรณ์และผู้ใช้');
      return;
    }
    try {
      await this.adminService.addDevice(this.newDeviceName, this.newDeviceUser);
      this.notificationService.showNotification('success', 'เพิ่มอุปกรณ์สำเร็จ', 'อุปกรณ์ถูกเพิ่มเรียบร้อยแล้ว');
      this.newDeviceName = '';
      this.newDeviceUser = '';
      await this.loadDevices();
    } catch (error) {
      console.error('Error adding device:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเพิ่มอุปกรณ์');
    }
  }

  async bindHardwareDevice() {
    if (!this.hwDeviceId || !this.hwDeviceName || !this.hwDeviceUser) {
      this.notificationService.showNotification('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    try {
      await this.http
        .post(`${this.apiUrl}/api/devices/claim-device`, {
          deviceId: this.hwDeviceId,
          displayName: this.hwDeviceName,
          user: this.hwDeviceUser,
        })
        .pipe(
          catchError((error) => {
            console.error('Error binding hardware device:', error);
            return throwError(() => new Error('Failed to bind device'));
          })
        )
        .toPromise();
      this.notificationService.showNotification('success', 'ผูกอุปกรณ์สำเร็จ', 'อุปกรณ์ถูกผูกเรียบร้อยแล้ว');
      this.hwDeviceId = '';
      this.hwDeviceName = '';
      this.hwDeviceUser = '';
      await this.loadDevices();
    } catch (error) {
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการผูกอุปกรณ์');
    }
  }

  async approveClaim(deviceId: string) {
    try {
      await this.http
        .post(`${this.apiUrl}/api/admin/approve-claim`, { deviceId })
        .pipe(
          catchError((error) => {
            console.error('Error approving claim:', error);
            return throwError(() => new Error('Failed to approve claim'));
          })
        )
        .toPromise();
      this.notificationService.showNotification('success', 'อนุมัติคำขอสำเร็จ', 'คำขอถูกอนุมัติเรียบร้อยแล้ว');
      await this.loadDevices();
    } catch (error) {
      this.notificationService.showNotification('error', 'อนุมัติคำขอไม่สำเร็จ', 'ไม่สามารถอนุมัติคำขอได้');
    }
  }

  async rejectClaim(deviceId: string) {
    try {
      await this.http
        .post(`${this.apiUrl}/api/admin/reject-claim`, { deviceId })
        .pipe(
          catchError((error) => {
            console.error('Error rejecting claim:', error);
            return throwError(() => new Error('Failed to reject claim'));
          })
        )
        .toPromise();
      this.notificationService.showNotification('success', 'ปฏิเสธคำขอสำเร็จ', 'คำขอถูกปฏิเสธเรียบร้อยแล้ว');
      await this.loadDevices();
    } catch (error) {
      this.notificationService.showNotification('error', 'ปฏิเสธคำขอไม่สำเร็จ', 'ไม่สามารถปฏิเสธคำขอได้');
    }
  }

  async deleteDevice(deviceId: string) {
    if (confirm(`ลบอุปกรณ์ ${deviceId} ?`)) {
      try {
        await this.adminService.deleteDevice(deviceId);
        this.notificationService.showNotification('success', 'ลบอุปกรณ์สำเร็จ', 'อุปกรณ์ถูกลบเรียบร้อยแล้ว');
        await this.loadDevices();
      } catch (error) {
        console.error('เกิดข้อผิดพลาดในการลบอุปกรณ์:', error);
        this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการลบอุปกรณ์');
      }
    }
  }

  toggleUsersList() {
    this.showUsersList = !this.showUsersList;
    if (this.showUsersList) {
      this.loadAllUsersOnce();
    }
  }

  toggleRegularUsersList() {
    this.showRegularUsersList = !this.showRegularUsersList;
    if (this.showRegularUsersList) {
      this.loadRegularUsers();
    }
  }

  toggleDevicesList() {
    this.showDevicesList = !this.showDevicesList;
    if (this.showDevicesList) {
      this.loadDevices();
    }
  }

  // ✅ ฟังก์ชันดึงข้อมูล regular users จาก /api/users/regular
  async loadRegularUsers() {
    try {
      this.loadingUsers = true;
      console.log('🔍 Loading regular users from /api/users/regular...');
      
      const regularUsersResult = await this.adminService.getRegularUsers();
      
      // ✅ ตรวจสอบว่า regularUsersResult เป็น array หรือไม่
      if (Array.isArray(regularUsersResult)) {
        this.regularUsers = regularUsersResult;
        console.log('✅ Regular users result is array:', regularUsersResult.length, 'users');
      } else {
        console.warn('⚠️ getRegularUsers() returned non-array:', regularUsersResult);
        this.regularUsers = [];
      }
      
      this.regularUsersDisplay = [...this.regularUsers];
      this.regularUsersCount = this.regularUsers.length;
      this.loadingUsers = false;
      this.cdr.detectChanges();
      
      console.log('✅ Regular users loaded successfully:', {
        regularUsersCount: this.regularUsersCount,
        regularUsers: this.regularUsers,
        regularUsersDisplay: this.regularUsersDisplay
      });

    } catch (error) {
      console.error('❌ Error loading regular users:', error);
      this.regularUsers = [];
      this.regularUsersDisplay = [];
      this.regularUsersCount = 0;
      this.loadingUsers = false;
      this.cdr.detectChanges();
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้ทั่วไป');
    }
  }

  // ✅ ฟังก์ชันจัดรูปแบบวันที่
  formatDate(date: any): string {
    if (!date) return 'ไม่ระบุ';
    
    try {
      let dateObj: Date;
      
      if (typeof date === 'string') {
        dateObj = new Date(date);
      } else if (typeof date === 'number') {
        dateObj = new Date(date);
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        return 'ไม่ระบุ';
      }
      
      // ตรวจสอบว่า date ถูกต้องหรือไม่
      if (isNaN(dateObj.getTime())) {
        return 'ไม่ระบุ';
      }
      
      // จัดรูปแบบเป็นภาษาไทย
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      
      return dateObj.toLocaleDateString('th-TH', options);
    } catch (error) {
      console.error('❌ Error formatting date:', error, 'Original date:', date);
      return 'ไม่ระบุ';
    }
  }

  // ✅ Device selection methods
  onDeviceChange(event: any) {
    const deviceId = event.target.value;
    console.log('🔍 Device selected:', deviceId);
    
    if (deviceId) {
      this.selectedDevice = this.devices.find(device => 
        device.id === deviceId || device.deviceid === deviceId
      );
      console.log('📱 Selected device:', this.selectedDevice);
      
      if (this.selectedDevice) {
        const deviceName = this.selectedDevice.display_name || 
                          this.selectedDevice.name || 
                          `Device ${this.selectedDevice.id || this.selectedDevice.deviceid}`;
        this.notificationService.showNotification('success', 'เลือกอุปกรณ์สำเร็จ', `เลือกอุปกรณ์: ${deviceName}`);
      }
    } else {
      this.selectedDevice = null;
      console.log('❌ No device selected');
    }
  }

  getDeviceUserName(userId: number): string {
    if (!userId) return 'ไม่ระบุ';
    
    const user = this.allUsers.find(u => 
      u['id'] === userId || u['userid'] === userId
    );
    return user ? user.username : `User ID: ${userId}`;
  }

  viewDevice(device: any) {
    localStorage.setItem('selectedDevice', JSON.stringify(device));
    this.router.navigate(['/device-detail']);
  }

  logout() {
    // ✅ ลบข้อมูล admin จาก localStorage
    localStorage.removeItem('admin');
    localStorage.removeItem('user');
    
    // ✅ Sign out จาก Firebase
    if (this.currentUser) {
      this.auth.signOut().then(() => {
        console.log('✅ Admin signed out successfully');
        this.router.navigate(['/']);
      }).catch((error) => {
        console.error('❌ Error signing out:', error);
        this.router.navigate(['/']);
      });
    } else {
      this.router.navigate(['/']);
    }
  }

  goToUsers() {
    this.router.navigate(['/profile']);
  }

  goToReports() {
    this.router.navigate(['/mail']);
  }
}
