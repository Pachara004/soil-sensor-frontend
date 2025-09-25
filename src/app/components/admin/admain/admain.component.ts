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
  devices: any[] = [];
  newDeviceName = '';
  newDeviceUser = '';
  hwDeviceId = '';
  hwDeviceName = '';
  hwDeviceUser = '';

  allUsers: UserData[] = [];
  allUsersDisplay: UserData[] = [];
  filteredUsers: UserData[] = [];
  unreadCount = 0;
  totalUsers = 0;
  totalUsersFiltered = 0;
  showUsersList = true;
  showEditModal = false;
  loadingUsers = false;
  showDevicesList = false;
  editingUser: UserData = { username: '' };
  newPassword = '';
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
    private notificationService: NotificationService
  ) {
    const adminData = localStorage.getItem('admin');
    if (adminData) {
      try {
        const parsedData = JSON.parse(adminData);
        this.adminName = parsedData.name || parsedData.username || null;
      } catch (e) {
        console.error('JSON parse error:', e);
      }
    }
    this.apiUrl = this.constants.API_ENDPOINT; // ใช้ instance ของ Constants

    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => this.filterUsers(query));
  }

  async ngOnInit() {
    if (!this.adminName) {
      this.notificationService.showNotification('warning', 'กรุณาล็อกอิน', 'กรุณาล็อกอินก่อน', true, 'ไปหน้า Login', () => {
        this.router.navigate(['/']);
      });
      return;
    }
    await this.loadDevices();
    await this.loadAllUsersOnce();
  }

  ngOnDestroy() {
    this.searchSubject.unsubscribe();
  }

  // Stub method used in template input handler
  onUserInput() {
    // no-op stub to satisfy template binding
  }

  async loadDevices() {
    try {
      this.devices = (await this.adminService.getDevices()) || [];
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading devices:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโหลดอุปกรณ์');
    }
  }

  async loadAllUsersOnce() {
    try {
      this.loadingUsers = true;
      this.allUsers = (await this.adminService.getAllUsers()) || [];
      this.allUsersDisplay = [...this.allUsers];
      this.filteredUsers = [...this.allUsers];
      this.totalUsers = this.allUsers.length;
      this.totalUsersFiltered = this.filteredUsers.length;
      this.loadingUsers = false;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading users:', error);
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

  async deleteDevice(deviceName: string) {
    if (confirm(`ลบอุปกรณ์ ${deviceName} ?`)) {
      try {
        await this.adminService.deleteDevice(deviceName);
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

  toggleDevicesList() {
    this.showDevicesList = !this.showDevicesList;
    if (this.showDevicesList) {
      this.loadDevices();
    }
  }

  viewDevice(device: any) {
    localStorage.setItem('selectedDevice', JSON.stringify(device));
    this.router.navigate(['/device-detail']);
  }

  logout() {
    localStorage.removeItem('admin');
    this.router.navigate(['/']);
  }

  goToUsers() {
    this.router.navigate(['/profile']);
  }

  goToReports() {
    this.router.navigate(['/mail']);
  }
}
