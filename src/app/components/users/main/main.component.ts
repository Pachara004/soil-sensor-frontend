import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription, lastValueFrom } from 'rxjs'; // 👈 ใช้ lastValueFrom
import { Constants } from '../../../config/constants';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';

interface Device {
  deviceid: number;
  device_name: string;
  created_at: string;
  updated_at: string;
  userid: number;
  status: 'online' | 'offline';
  device_type?: boolean; // ✅ เพิ่ม device_type property
  [key: string]: any; // ✅ เพิ่ม index signature เพื่อรองรับ properties อื่นๆ
}

type LivePayload = {
  ts_epoch?: number;
  ts_uptime?: number;
  temperature?: number;
  moisture?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  ph?: number;
};

// 👇 เพิ่ม type ของ response จาก /api/devices/claim
interface ClaimResponse {
  success?: boolean;
  message?: string;
  device?: any;
}

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
})
export class MainComponent implements OnInit, OnDestroy {
  userID: string = '';
  userName: string = '';
  userEmail: string = '';
  currentUser: any = null; // ✅ เพิ่ม currentUser property

  devices: Device[] = [];
  selectedDevice: Device | null = null;
  selectedDeviceId: string = '';
  isLoading = false;
  currentTime: string = '';
  private clockSubscription: Subscription | null = null;

  private liveUnsub: (() => void) | null = null;
  private readonly FRESH_WINDOW_MS = 45_000;
  // 👇 ใช้ type ให้ถูก + เริ่มต้นเป็น null
  private liveOfflineTimer: ReturnType<typeof setInterval> | null = null;
  private lastLiveLocalMs = 0;

  claimDeviceId: string = '';
  lastClaimMessage: string = '';
  lastClaimType: 'ok' | 'warn' | 'err' | '' = '';
  requestingClaim = false;
  private apiUrl: string;

  // Notification popup properties
  showNotification = false;
  notificationType: 'success' | 'error' | 'warning' | 'info' = 'info';
  notificationTitle = '';
  notificationMessage = '';
  showNotificationActions = false;
  notificationConfirmText = '';
  notificationConfirmCallback: (() => void) | null = null;

  constructor(
    private router: Router,
    private http: HttpClient,
    private constants: Constants,
    private auth: Auth
  ) {
    this.apiUrl = this.constants.API_ENDPOINT;
  }

  ngOnInit(): void {
    this.clockSubscription = interval(1000).subscribe(() => {
      this.currentTime = new Date().toLocaleTimeString('th-TH');
    });
    
    // ตรวจสอบ Firebase auth state ก่อนโหลด devices
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.currentUser = user; // ✅ เก็บ currentUser
        console.log('✅ User is authenticated:', user.email);
        console.log('🔑 User UID:', user.uid);
        
        // ตรวจสอบว่า user มี token หรือไม่
        user.getIdToken().then((token) => {
          console.log('🎫 Firebase ID Token obtained');
          // เพิ่ม delay เล็กน้อยเพื่อให้ Firebase token พร้อมใช้งาน
          setTimeout(() => {
            this.loadUserProfile();
            this.loadDevices();
          }, 100);
        }).catch((error) => {
          console.error('❌ Failed to get ID token:', error);
          this.loadUserProfile();
          this.loadDevices();
        });
      } else {
        console.log('❌ User is not authenticated, redirecting to login');
        this.router.navigate(['/']);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.clockSubscription) {
      this.clockSubscription.unsubscribe();
    }
    if (this.liveUnsub) {
      this.liveUnsub();
    }
    if (this.liveOfflineTimer) {
      clearInterval(this.liveOfflineTimer); // 👈 ใช้ clearInterval
      this.liveOfflineTimer = null;
    }
  }

  async loadUserProfile() {
    try {
      console.log('👤 Loading user profile...');
      
      // ตรวจสอบ Firebase user
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        console.log('❌ No current user found for profile');
        return;
      }

      // ✅ ใช้ข้อมูลจาก PostgreSQL เท่านั้น - ไม่ใช้ Firebase
      console.log('👤 Loading user profile from PostgreSQL only...');

      // ✅ ดึงข้อมูลจาก PostgreSQL เท่านั้น
      try {
        const token = await currentUser.getIdToken(true);
        console.log('🔑 Firebase ID token obtained for PostgreSQL data');
        
        // ลองดึงข้อมูลจาก PostgreSQL endpoints
        const endpoints = [
          '/api/auth/me',
          '/api/user/profile', 
          '/api/user/me',
          '/api/profile'
        ];

        let userDataFound = false;
        for (const endpoint of endpoints) {
          try {
            console.log(`🔍 Trying PostgreSQL endpoint: ${endpoint}`);
            const response = await lastValueFrom(
              this.http.get<any>(`${this.apiUrl}${endpoint}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              })
            );
            
            console.log(`✅ Success with PostgreSQL ${endpoint}:`, response);
            
            // อัปเดตข้อมูลจาก PostgreSQL
            let userData = response;
            if (response.user) {
              userData = response.user;
            }
            
            // ✅ ใช้ข้อมูลจาก PostgreSQL เท่านั้น
            if (userData.user_name) {
              this.userName = userData.user_name;
              console.log('👤 User name from PostgreSQL:', this.userName);
            }
            if (userData.user_email) {
              this.userEmail = userData.user_email;
              console.log('📧 User email from PostgreSQL:', this.userEmail);
            }
            if (userData.userid) {
              this.userID = userData.userid.toString();
              console.log('🆔 User ID from PostgreSQL:', this.userID);
            }
            
            userDataFound = true;
            break; // หยุดเมื่อเจอ endpoint ที่ทำงานได้
          } catch (endpointError: any) {
            console.log(`❌ PostgreSQL endpoint ${endpoint} failed:`, endpointError.status);
            continue; // ลอง endpoint ถัดไป
          }
        }
        
        if (!userDataFound) {
          console.log('⚠️ No PostgreSQL data found, using default values');
          this.userName = 'Unknown User';
          this.userEmail = 'No email';
          this.userID = 'No ID';
        }
        
      } catch (tokenError) {
        console.log('❌ Failed to get token for PostgreSQL data');
        // ใช้ข้อมูล default
        this.userName = 'Unknown User';
        this.userEmail = 'No email';
        this.userID = 'No ID';
      }
      
    } catch (error: any) {
      console.error('❌ Error loading user profile:', error);
      // ใช้ข้อมูล default
      this.userName = 'Unknown User';
      this.userEmail = 'No email';
      this.userID = 'No ID';
    }
  }

  async loadDevices() {
    this.isLoading = true;
    try {
      console.log('🚀 Starting to load devices...');
      
      // ตรวจสอบ Firebase user
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        console.log('❌ No current user found');
        this.devices = [
          { deviceid: 0, device_name: 'ไม่พบอุปกรณ์', created_at: '', updated_at: '', userid: 0, status: 'offline' }
        ];
        return;
      }

      // ✅ ดึงข้อมูล devices จาก PostgreSQL
      try {
        const token = await currentUser.getIdToken(true);
        console.log('🔑 Firebase ID token obtained for devices');
        
        const response = await lastValueFrom(
          this.http.get<Device[]>(`${this.apiUrl}/api/devices`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
        );

        console.log('✅ Devices loaded from PostgreSQL:', response);
        this.devices = Array.isArray(response) ? response : [];
        
        // ✅ ใช้ device_type จาก database: false = test device (online), true = production device (offline)
        this.devices = this.devices.map(device => {
          const isTestDevice = device.device_type === false; // false = test device, true = production device
          
          console.log('🔍 Device:', device.device_name, 'DB Type:', device.device_type, 'Is Test:', isTestDevice);
          
          return {
            ...device,
            status: isTestDevice ? 'online' as 'online' | 'offline' : 'offline' as 'online' | 'offline'
          };
        });
        
      } catch (deviceError: any) {
        console.error('❌ Error loading devices from PostgreSQL:', deviceError);
        // ✅ ใช้ข้อมูลจาก PostgreSQL เท่านั้น - ไม่มี fallback
        this.devices = [];
        console.log('✅ No devices found - PostgreSQL only');
      }


      if (this.devices.length > 0) {
        // ✅ ตรวจสอบ localStorage ก่อน
        const savedDeviceId = localStorage.getItem('selectedDeviceId');
        let deviceToSelect = null;
        
        if (savedDeviceId) {
          // ✅ หาอุปกรณ์ที่เคยเลือกไว้
          deviceToSelect = this.devices.find(d => d.deviceid.toString() === savedDeviceId);
          console.log('🔄 Found saved device selection:', savedDeviceId, deviceToSelect);
        }
        
        // ✅ ถ้าไม่เจออุปกรณ์ที่เคยเลือก หรือไม่มี savedDeviceId ให้เลือกอุปกรณ์แรก
        if (!deviceToSelect) {
          deviceToSelect = this.devices[0];
          console.log('🔄 No saved selection found, selecting first device:', deviceToSelect);
        }
        
        this.selectedDeviceId = deviceToSelect.deviceid.toString();
        this.selectedDevice = deviceToSelect;
        localStorage.setItem('selectedDeviceId', this.selectedDeviceId);
        
        console.log('📱 Selected device:', this.selectedDevice);
      } else {
        // fallback ถ้าไม่มีอุปกรณ์
        this.selectedDevice = null;
        this.selectedDeviceId = '';
        localStorage.removeItem('selectedDeviceId');
        console.log('📱 No devices found for user');
      }
    } catch (error: any) {
      console.error('❌ Error loading devices:', error);
      // ✅ ใช้ข้อมูลจาก PostgreSQL เท่านั้น - ไม่มี fallback
      this.devices = [];
      console.log('✅ No devices found - PostgreSQL only');
    } finally {
      this.isLoading = false;
    }
  }

  selectDevice(deviceId: string) {
    console.log('🎯 Selecting device:', deviceId);
    this.selectedDeviceId = deviceId;
    this.selectedDevice = this.devices.find((d) => d.deviceid.toString() === deviceId) || null;
    localStorage.setItem('selectedDeviceId', deviceId);
    
    console.log('📱 Device selection updated:', {
      selectedDeviceId: this.selectedDeviceId,
      selectedDevice: this.selectedDevice,
      deviceName: this.selectedDevice?.device_name || this.selectedDevice?.deviceid
    });
    
    this.startLiveMonitor(deviceId);
  }

  private startLiveMonitor(deviceId: string) {
    if (this.liveUnsub) {
      this.liveUnsub();
    }
    this.liveUnsub = () => {}; // Placeholder for cleanup
    this.lastLiveLocalMs = Date.now();

    if (this.liveOfflineTimer) {
      clearInterval(this.liveOfflineTimer); // เคลียร์ของเดิมก่อน
    }
    this.liveOfflineTimer = setInterval(() => {
      if (Date.now() - this.lastLiveLocalMs > this.FRESH_WINDOW_MS) {
        this.updateDeviceStatus(deviceId, 'offline');
      } else {
        this.updateDeviceStatus(deviceId, 'online');
      }
    }, 1000);
  }

  private updateDeviceStatus(deviceId: string, status: 'online' | 'offline') {
    const device = this.devices.find((d) => d.deviceid.toString() === deviceId);
    if (device) {
      device.status = status;
    }
  }

  // Minimal stub for template
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('admin');
    this.router.navigate(['/']);
  }

  // เพิ่ม method สำหรับการเพิ่มอุปกรณ์
  async requestDeviceClaim() {
    await this.claimDevice();
  }

  // เพิ่ม method สำหรับเพิ่มอุปกรณ์ใหม่ (POST /api/devices)
  async addNewDevice() {
    console.log('🚀 addNewDevice() called with deviceId:', this.claimDeviceId);
    
    if (!this.claimDeviceId.trim()) {
      console.log('❌ No device ID provided');
      this.lastClaimType = 'warn';
      this.lastClaimMessage = 'กรุณากรอก ID อุปกรณ์';
      return;
    }

    this.requestingClaim = true;
    console.log('🔄 Starting device add request...');
    
    try {
      // ตรวจสอบ Firebase user และส่ง token ไปกับ request
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        console.log('❌ No current user found');
        this.lastClaimType = 'err';
        this.lastClaimMessage = 'ไม่พบผู้ใช้ กรุณาเข้าสู่ระบบใหม่';
        return;
      }

      const token = await currentUser.getIdToken();
      console.log('🔑 Firebase ID token obtained for add device');

      // ✅ ตรวจสอบว่าชื่ออุปกรณ์มีคำว่า "test" หรือไม่
      const deviceName = this.claimDeviceId.trim();
      const isTestDevice = deviceName.toLowerCase().includes('test');
      
      const requestData = {
        deviceId: isTestDevice ? `esp32-soil-test-${Date.now()}` : deviceName,
        device_name: isTestDevice ? `esp32-soil-test-${Date.now()}` : deviceName,
        status: isTestDevice ? 'online' : 'offline', // ✅ test device = online, อุปกรณ์ทั่วไป = offline
        device_type: isTestDevice ? false : true, // ✅ false = test device, true = production device
        description: isTestDevice ? 'อุปกรณ์ทดสอบ ESP32 Soil Sensor สำหรับทดสอบ API measurement' : 'อุปกรณ์ทั่วไป'
      };
      
      console.log('📤 Sending request to:', `${this.apiUrl}/api/devices`);
      console.log('📤 Request data:', requestData);
      console.log('🔍 Is Test Device:', isTestDevice);
      console.log('🔍 Device Status:', requestData.status);

      const response = await lastValueFrom(
        this.http.post<ClaimResponse>(`${this.apiUrl}/api/devices`, requestData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      );

      console.log('✅ Add device response:', response);
      console.log('✅ Response success:', response.success);
      console.log('✅ Response message:', response.message);
      console.log('✅ Response device:', response.device);
      console.log('✅ Response device status:', response.device?.status);

      // ตรวจสอบ response หลายแบบ
      const isSuccess = response.success === true || 
                       response.message?.includes('successfully') || 
                       response.message?.includes('สำเร็จ') ||
                       response.device;

           if (isSuccess) {
             console.log('🎉 Device added successfully! Showing notification...');
             
             // แสดง notification popup เมื่อเพิ่มอุปกรณ์สำเร็จ
             const deviceName = this.claimDeviceId.trim();
             const isTestDevice = deviceName.toLowerCase().includes('test');
             const deviceType = isTestDevice ? 'ESP32-soil-test' : 'ทั่วไป';
             
             this.showNotificationPopup(
               'success',
               'เพิ่มอุปกรณ์สำเร็จ!',
               `อุปกรณ์${deviceType}: ${isTestDevice ? `esp32-soil-test-${Date.now()}` : deviceName}\n\n${isTestDevice ? 'อุปกรณ์ทดสอบพร้อมใช้งานสำหรับทดสอบ API measurement' : 'อุปกรณ์พร้อมใช้งาน'}\n\nกดตกลงเพื่อรีเฟรซหน้า`,
               true,
               'ตกลง',
               () => {
                 console.log('🔄 Reloading page after notification...');
                 window.location.reload();
               }
             );
        
      } else {
        console.log('❌ Response indicates failure:', response.message);
        this.lastClaimType = 'err';
        this.lastClaimMessage = response.message || 'เพิ่มอุปกรณ์ไม่สำเร็จ';
      }
    } catch (err: any) {
      console.error('❌ Add device error:', err);
      console.error('❌ Error status:', err.status);
      console.error('❌ Error message:', err.message);
      
      this.lastClaimType = 'err';
      
      // ให้ข้อความ error ที่ชัดเจนขึ้น
      if (err.status === 400) {
        this.lastClaimMessage = 'ข้อมูลไม่ถูกต้อง หรือ Device ID ซ้ำ';
      } else if (err.status === 401) {
        this.lastClaimMessage = 'ไม่มีสิทธิ์ กรุณาเข้าสู่ระบบใหม่';
      } else if (err.status === 409) {
        this.lastClaimMessage = 'Device ID นี้มีอยู่แล้ว';
      } else if (err.status === 500) {
        this.lastClaimMessage = 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง';
      } else {
        this.lastClaimMessage = 'เพิ่มอุปกรณ์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      }
    } finally {
      this.requestingClaim = false;
      console.log('🏁 addNewDevice() completed');
    }
  }

  // เพิ่ม method สำหรับการเปลี่ยนอุปกรณ์
  onDeviceChange() {
    console.log('🔄 Device changed to:', this.selectedDeviceId);
    this.selectDevice(this.selectedDeviceId);
    console.log('📱 Selected device updated:', {
      deviceId: this.selectedDeviceId,
      deviceName: this.selectedDevice?.device_name || this.selectedDevice?.deviceid,
      device: this.selectedDevice
    });
  }

  // เพิ่ม method สำหรับการไปยังหน้า profile
  goToProfile() {
    this.router.navigate(['/profile']);
  }

  // เพิ่ม method สำหรับการไปยังหน้า history
  goToHistory() {
    this.router.navigate(['/history']);
  }

  // เพิ่ม method สำหรับการไปยังหน้า measure
  goToMeasure() {
    // ✅ ส่งข้อมูลอุปกรณ์ที่เลือกไปหน้า measurement
    const deviceData = this.selectedDevice ? {
      deviceId: this.selectedDevice.deviceid.toString(),
      deviceName: this.selectedDevice.device_name || this.selectedDevice.deviceid.toString(),
      deviceStatus: this.selectedDevice.status || 'offline'
    } : null;
    
    console.log('🎯 Navigating to measurement with device data:', deviceData);
    
    // ✅ ส่งข้อมูลผ่าน query parameters หรือ state
    this.router.navigate(['/measure'], {
      queryParams: deviceData ? {
        deviceId: deviceData.deviceId,
        deviceName: deviceData.deviceName,
        deviceStatus: deviceData.deviceStatus
      } : {}
    });
  }

  // เพิ่ม method สำหรับการไปยังหน้า contact admin
  goToContactAdmin() {
    this.router.navigate(['/reports']);
  }

  async claimDevice() {
    if (!this.claimDeviceId.trim()) {
      this.lastClaimType = 'warn';
      this.lastClaimMessage = 'กรุณากรอก ID อุปกรณ์';
      return;
    }

    this.requestingClaim = true;
    try {
      // ตรวจสอบ Firebase user และส่ง token ไปกับ request
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        this.lastClaimType = 'err';
        this.lastClaimMessage = 'ไม่พบผู้ใช้ กรุณาเข้าสู่ระบบใหม่';
        return;
      }

      const token = await currentUser.getIdToken();
      console.log('🔑 Firebase ID token obtained for claim device');

      const response = await lastValueFrom(
        this.http.post<ClaimResponse>(`${this.apiUrl}/api/devices/claim`, {
          deviceId: this.claimDeviceId,
          device_name: this.claimDeviceId, // เพิ่ม device_name
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      );

      // ตอนนี้ response เป็น ClaimResponse แบบไม่ undefined แล้ว
      if (response.success) {
        this.lastClaimType = 'ok';
        this.lastClaimMessage = `ผูกอุปกรณ์สำเร็จ! (อุปกรณ์: ${this.claimDeviceId})`;
        await this.loadDevices();
        this.selectedDeviceId = this.claimDeviceId;
        this.selectedDevice =
          this.devices.find((d) => d.deviceid.toString() === this.claimDeviceId) || null;
        if (this.selectedDevice) {
          localStorage.setItem('selectedDeviceId', this.claimDeviceId);
          // ไม่ต้อง start live monitor เพราะยังไม่มีการเชื่อมกับ IoT
        }
      } else {
        this.lastClaimType = 'err';
        this.lastClaimMessage = response.message || 'ผูกอุปกรณ์ไม่สำเร็จ';
      }
    } catch (err) {
      console.error('bind device error:', err);
      this.lastClaimType = 'err';
      this.lastClaimMessage = 'ผูกอุปกรณ์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
    } finally {
      this.requestingClaim = false;
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
}
