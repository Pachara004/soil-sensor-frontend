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
  
  // ✅ Dropdown search properties
  showDropdown = false;
  selectedIndex = -1;
  
  // ✅ User search properties
  userSearchQuery = '';
  
  // ✅ Device search properties
  deviceSearchQuery = '';
  devicesDisplay: any[] = [];
  loadingDevices = false;

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

  // ✅ Enhanced User input and selection methods
  onUserInput() {
    const query = this.newDeviceUser?.toLowerCase() || '';
    this.selectedIndex = -1;
    
    if (query.length > 0) {
      this.filteredUsers = this.allUsers.filter(user => {
        const username = user.username?.toLowerCase() || '';
        const email = user.email?.toLowerCase() || '';
        return username.includes(query) || email.includes(query);
      });
      this.showDropdown = true;
    } else {
      this.filteredUsers = [];
      this.showDropdown = false;
    }
  }

  onInputBlur() {
    // Delay hiding dropdown to allow click events
    setTimeout(() => {
      this.showDropdown = false;
      this.selectedIndex = -1;
    }, 200);
  }

  selectUser(username: string) {
    this.newDeviceUser = username;
    this.filteredUsers = [];
    this.showDropdown = false;
    this.selectedIndex = -1;
  }

  onKeyDown(event: KeyboardEvent) {
    if (!this.showDropdown || this.filteredUsers.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredUsers.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredUsers.length) {
          this.selectUser(this.filteredUsers[this.selectedIndex].username);
        }
        break;
      case 'Escape':
        this.showDropdown = false;
        this.selectedIndex = -1;
        break;
    }
  }

  async loadDevices() {
    try {
      this.loadingDevices = true;
      const devicesResult = await this.adminService.getDevices();
      
      // ✅ ตรวจสอบว่า devicesResult เป็น array หรือไม่
      if (Array.isArray(devicesResult)) {
        this.devices = devicesResult;
      } else {
        console.warn('⚠️ getDevices() returned non-array:', devicesResult);
        this.devices = [];
      }
      
      // ✅ เรียงข้อมูลตาม device id (จากน้อยไปมาก)
      this.devices.sort((a, b) => {
        const aId = a['id'] || a['deviceid'] || 0;
        const bId = b['id'] || b['deviceid'] || 0;
        return aId - bId;
      });
      
      this.devicesDisplay = [...this.devices];
      this.loadingDevices = false;
      this.cdr.detectChanges();
      
      console.log('✅ Devices loaded and sorted by device id:', {
        totalDevices: this.devices.length,
        devices: this.devices.map(d => ({
          deviceid: d['id'] || d['deviceid'],
          name: d['display_name'] || d['name'],
          userid: d['user_id'] || d['userid'],
          username: d['user_name'] || this.getDeviceUserName(d['user_id'] || d['userid']),
          useremail: d['user_email'] || 'ไม่ระบุ',
          status: d['status'],
          created_at: d['created_at'],
          updated_at: d['updated_at'],
          description: d['description']
        }))
      });

      // ✅ แสดงข้อมูลอุปกรณ์แบบตารางใน console
      console.table(this.devices.map(d => ({
        'Device ID': d['id'] || d['deviceid'],
        'ชื่ออุปกรณ์': d['display_name'] || d['name'],
        'User ID': d['user_id'] || d['userid'],
        'ชื่อผู้ใช้': d['user_name'] || this.getDeviceUserName(d['user_id'] || d['userid']),
        'อีเมลผู้ใช้': d['user_email'] || 'ไม่ระบุ',
        'สถานะ': d['status'],
        'สร้างเมื่อ': d['created_at'] ? this.formatDate(d['created_at']) : 'ไม่ระบุ',
        'อัปเดตล่าสุด': d['updated_at'] ? this.formatDate(d['updated_at']) : 'ไม่ระบุ'
      })));
    } catch (error) {
      console.error('❌ Error loading devices:', error);
      this.devices = [];
      this.devicesDisplay = [];
      this.loadingDevices = false;
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
      
      // ✅ เรียงข้อมูลตาม userid (จากน้อยไปมาก)
      this.allUsers.sort((a, b) => {
        const aId = a['userid'] || a['id'] || 0;
        const bId = b['userid'] || b['id'] || 0;
        return aId - bId;
      });
      
      this.allUsersDisplay = [...this.allUsers];
      this.filteredUsers = [...this.allUsers];
      this.totalUsers = this.allUsers.length;
      this.totalUsersFiltered = this.filteredUsers.length;
      this.loadingUsers = false;
      this.cdr.detectChanges();
      
      console.log('✅ Users loaded and sorted by userid:', {
        totalUsers: this.totalUsers,
        users: this.allUsers.map(u => ({
          userid: u['userid'] || u['id'],
          username: u['user_name'] || u['username'],
          role: u['role'] || u['type']
        }))
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

  // ✅ ฟังก์ชันค้นหาผู้ใช้ในรายการทั้งหมด
  onUserSearch() {
    const query = this.userSearchQuery?.toLowerCase() || '';
    
    if (query.length > 0) {
      this.allUsersDisplay = this.allUsers.filter(user => {
        const username = (user['user_name'] || user['username'] || '').toLowerCase();
        const email = (user['user_email'] || user['email'] || '').toLowerCase();
        const userid = String(user['userid'] || user['id'] || '');
        const role = (user['role'] || user['type'] || '').toLowerCase();
        
        return username.includes(query) || 
               email.includes(query) || 
               userid.includes(query) ||
               role.includes(query);
      });
    } else {
      this.allUsersDisplay = [...this.allUsers];
    }
    
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
    
    // ✅ ใช้ข้อมูลจาก allUsers array
    const user = this.allUsers.find(u => 
      u['id'] === userId || u['userid'] === userId
    );
    return user ? (user['user_name'] || user['username'] || `User ID: ${userId}`) : `User ID: ${userId}`;
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

  // ✅ User management methods
  editUser(user: UserData) {
    this.editingUser = { ...user };
    this.newPassword = '';
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editingUser = { username: '' };
    this.newPassword = '';
  }

  async saveUserChanges() {
    if (!this.editingUser.username) {
      this.notificationService.showNotification('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณาเลือกผู้ใช้ที่ต้องการแก้ไข');
      return;
    }

    try {
      const updateData: any = {
        user_name: this.editingUser.username,
        user_email: this.editingUser.email,
        role: this.editingUser.type || 'user'
      };

      if (this.newPassword && this.newPassword.trim()) {
        updateData.user_password = this.newPassword;
      }

      const token = await this.currentUser.getIdToken();
      const response = await lastValueFrom(
        this.http.put(`${this.apiUrl}/api/users/${this.editingUser.username}`, updateData, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );

      this.notificationService.showNotification('success', 'บันทึกสำเร็จ', 'ข้อมูลผู้ใช้ถูกอัปเดตเรียบร้อยแล้ว');
      this.closeEditModal();
      await this.loadAllUsersOnce();
    } catch (error: any) {
      console.error('Error saving user changes:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้');
    }
  }

  async deleteUser(username: string) {
    this.notificationService.showNotification('warning', 'ยืนยันการลบ', `ต้องการลบผู้ใช้ ${username} จริงหรือไม่?`, true, 'ลบ', async () => {
      try {
        const token = await this.currentUser.getIdToken();
        await lastValueFrom(
          this.http.delete(`${this.apiUrl}/api/users/${username}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );

        this.notificationService.showNotification('success', 'ลบสำเร็จ', 'ผู้ใช้ถูกลบเรียบร้อยแล้ว');
        await this.loadAllUsersOnce();
      } catch (error: any) {
        console.error('Error deleting user:', error);
        this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถลบผู้ใช้ได้');
      }
    });
  }

  // ✅ ฟังก์ชันดูรายละเอียดผู้ใช้
  viewUserDetails(user: UserData) {
    const userDetails = {
      'User ID': user['userid'] || user['id'] || 'ไม่ระบุ',
      'ชื่อผู้ใช้': user['user_name'] || user['username'] || 'ไม่ระบุ',
      'อีเมล': user['user_email'] || user['email'] || 'ไม่ระบุ',
      'เบอร์โทร': user['user_phone'] || user['phone'] || 'ไม่ระบุ',
      'ประเภท': user['role'] === 'admin' || user['type'] === 'admin' ? 'Admin' : 'User',
      'สร้างเมื่อ': this.formatDate(user['created_at'] || user['createdAt']),
      'อัปเดตล่าสุด': this.formatDate(user['updated_at'] || user['updatedAt']),
      'Firebase UID': user['firebase_uid'] || user['firebaseUid'] || 'ไม่ระบุ'
    };

    const detailsText = Object.entries(userDetails)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    this.notificationService.showNotification('info', 'รายละเอียดผู้ใช้', detailsText, true, 'ปิด');
  }

  // ✅ ฟังก์ชันค้นหาอุปกรณ์ในรายการทั้งหมด
  onDeviceSearch() {
    const query = this.deviceSearchQuery?.toLowerCase() || '';
    
    if (query.length > 0) {
      this.devicesDisplay = this.devices.filter(device => {
        const name = (device['display_name'] || device['name'] || '').toLowerCase();
        const deviceId = String(device['id'] || device['deviceid'] || '');
        const status = (device['status'] || '').toLowerCase();
        const userName = (device['user_name'] || this.getDeviceUserName(device['user_id'] || device['userid'])).toLowerCase();
        const userEmail = (device['user_email'] || '').toLowerCase();
        const description = (device['description'] || '').toLowerCase();
        
        return name.includes(query) || 
               deviceId.includes(query) || 
               status.includes(query) ||
               userName.includes(query) ||
               userEmail.includes(query) ||
               description.includes(query);
      });
    } else {
      this.devicesDisplay = [...this.devices];
    }
    
    this.cdr.detectChanges();
  }

  // ✅ ฟังก์ชันแก้ไขข้อมูลอุปกรณ์
  editDevice(device: any) {
    const deviceDetails = {
      'Device ID': device['id'] || device['deviceid'] || 'ไม่ระบุ',
      'ชื่ออุปกรณ์': device['display_name'] || device['name'] || 'ไม่ระบุ',
      'User ID': device['user_id'] || device['userid'] || 'ไม่ระบุ',
      'ชื่อผู้ใช้': device['user_name'] || this.getDeviceUserName(device['user_id'] || device['userid']),
      'อีเมลผู้ใช้': device['user_email'] || 'ไม่ระบุ',
      'สถานะ': device['status'] || 'ไม่ระบุ',
      'คำอธิบาย': device['description'] || 'ไม่ระบุ',
      'สร้างเมื่อ': this.formatDate(device['created_at']),
      'อัปเดตล่าสุด': this.formatDate(device['updated_at'])
    };

    const detailsText = Object.entries(deviceDetails)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    this.notificationService.showNotification('info', 'รายละเอียดอุปกรณ์', detailsText, true, 'ปิด');
  }
}
