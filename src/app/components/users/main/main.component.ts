import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription, lastValueFrom } from 'rxjs'; // 👈 ใช้ lastValueFrom
import { Constants } from '../../../config/constants';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { DeviceService, SelectedDeviceData } from '../../../service/device.service';
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
  // ✅ Device validation properties
  deviceValidationError: boolean = false;
  deviceValidationMessage: string = '';
  constructor(
    private router: Router,
    private http: HttpClient,
    private constants: Constants,
    private auth: Auth,
    private deviceService: DeviceService
  ) {
    this.apiUrl = this.constants.API_ENDPOINT;
  }

  // ✅ ตรวจสอบรูปแบบอุปกรณ์จริง (esp32-soil-001 ถึง esp32-soil-999)
  private isValidProductionDevice(deviceName: string): boolean {
    // รูปแบบที่ถูกต้อง: esp32-soil-XXX (XXX = 001-999)
    const productionDevicePattern = /^esp32-soil-([0-9]{3})$/i;
    const match = deviceName.match(productionDevicePattern);
    
    if (!match) {
      return false;
    }
    
    // ตรวจสอบว่าหมายเลขอยู่ในช่วง 001-999
    const deviceNumber = parseInt(match[1], 10);
    return deviceNumber >= 1 && deviceNumber <= 999;
  }

  // ✅ ตรวจสอบ input แบบ real-time
  validateDeviceInput() {
    const deviceName = this.claimDeviceId.trim();
    
    if (!deviceName) {
      this.deviceValidationError = false;
      this.deviceValidationMessage = '';
      return;
    }

    const isTestDevice = deviceName.toLowerCase().includes('test');
    
    if (isTestDevice) {
      // อุปกรณ์ทดสอบ - ไม่มีข้อผิดพลาด
      this.deviceValidationError = false;
      this.deviceValidationMessage = '';
    } else if (this.isValidProductionDevice(deviceName)) {
      // อุปกรณ์จริงที่ถูกต้อง - ไม่มีข้อผิดพลาด
      this.deviceValidationError = false;
      this.deviceValidationMessage = '';
    } else {
      // รูปแบบไม่ถูกต้อง - แสดง error
      this.deviceValidationError = true;
      this.deviceValidationMessage = 'รูปแบบไม่ถูกต้อง! ใช้ esp32-soil-001 ถึง esp32-soil-999 หรือ "test"';
    }
  }
  ngOnInit(): void {
    this.clockSubscription = interval(1000).subscribe(() => {
      this.currentTime = new Date().toLocaleTimeString('th-TH');
    });
    // ตรวจสอบ Firebase auth state ก่อนโหลด devices
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.currentUser = user; // ✅ เก็บ currentUser
        console.log('🔑 User UID:', user.uid);
        // ตรวจสอบว่า user มี token หรือไม่
        user.getIdToken().then((token) => {
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
      // ตรวจสอบ Firebase user
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        return;
      }
      // ✅ ใช้ข้อมูลจาก PostgreSQL เท่านั้น - ไม่ใช้ Firebase
      // ✅ ดึงข้อมูลจาก PostgreSQL เท่านั้น
      try {
        const token = await currentUser.getIdToken(true);
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
            const response = await lastValueFrom(
              this.http.get<any>(`${this.apiUrl}${endpoint}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              })
            );
            // อัปเดตข้อมูลจาก PostgreSQL
            let userData = response;
            if (response.user) {
              userData = response.user;
            }
            // ✅ ใช้ข้อมูลจาก PostgreSQL เท่านั้น
            if (userData.user_name) {
              this.userName = userData.user_name;
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
          this.userName = 'Unknown User';
          this.userEmail = 'No email';
          this.userID = 'No ID';
        }
      } catch (tokenError) {
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
      // ตรวจสอบ Firebase user
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        this.devices = [
          { deviceid: 0, device_name: 'ไม่พบอุปกรณ์', created_at: '', updated_at: '', userid: 0, status: 'offline' }
        ];
        return;
      }
      // ✅ ดึงข้อมูล devices จาก PostgreSQL
      try {
        const token = await currentUser.getIdToken(true);
        const response = await lastValueFrom(
          this.http.get<Device[]>(`${this.apiUrl}/api/devices`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
        );
        this.devices = Array.isArray(response) ? response : [];
        // ✅ ใช้ device_type จาก database: false = test device (online), true = production device (offline)
        this.devices = this.devices.map(device => {
          const isTestDevice = device.device_type === false; // false = test device, true = production device
          return {
            ...device,
            status: isTestDevice ? 'online' as 'online' | 'offline' : 'offline' as 'online' | 'offline'
          };
        });
      } catch (deviceError: any) {
        console.error('❌ Error loading devices from PostgreSQL:', deviceError);
        // ✅ ใช้ข้อมูลจาก PostgreSQL เท่านั้น - ไม่มี fallback
        this.devices = [];
      }
      if (this.devices.length > 0) {
        // ✅ ตรวจสอบ localStorage ก่อน
        const savedDeviceId = localStorage.getItem('selectedDeviceId');
        let deviceToSelect = null;
        if (savedDeviceId) {
          // ✅ หาอุปกรณ์ที่เคยเลือกไว้
          deviceToSelect = this.devices.find(d => d.deviceid.toString() === savedDeviceId);
        }
        // ✅ ถ้าไม่เจออุปกรณ์ที่เคยเลือก หรือไม่มี savedDeviceId ให้เลือกอุปกรณ์แรก
        if (!deviceToSelect) {
          deviceToSelect = this.devices[0];
        }
        this.selectedDeviceId = deviceToSelect.deviceid.toString();
        this.selectedDevice = deviceToSelect;
        // เก็บข้อมูลอุปกรณ์ที่เลือกใน localStorage แบบครบถ้วน
        this.saveSelectedDeviceToStorage();
      } else {
        // fallback ถ้าไม่มีอุปกรณ์
        this.selectedDevice = null;
        this.selectedDeviceId = '';
        // ลบข้อมูลอุปกรณ์ออกจาก localStorage
        this.saveSelectedDeviceToStorage();
      }
    } catch (error: any) {
      console.error('❌ Error loading devices:', error);
      // ✅ ใช้ข้อมูลจาก PostgreSQL เท่านั้น - ไม่มี fallback
      this.devices = [];
    } finally {
      this.isLoading = false;
    }
  }
  selectDevice(deviceId: string) {
    this.selectedDeviceId = deviceId;
    this.selectedDevice = this.devices.find((d) => d.deviceid.toString() === deviceId) || null;
    
    // เก็บข้อมูลอุปกรณ์ที่เลือกใน localStorage แบบครบถ้วน
    this.saveSelectedDeviceToStorage();
    
    this.startLiveMonitor(deviceId);
  }

  // เพิ่ม method สำหรับเก็บข้อมูลอุปกรณ์ที่เลือกใน localStorage ผ่าน DeviceService
  private saveSelectedDeviceToStorage() {
    if (this.selectedDevice) {
      const deviceData: SelectedDeviceData = {
        deviceId: this.selectedDevice.deviceid.toString(),
        deviceName: this.selectedDevice.device_name || this.selectedDevice.deviceid.toString(),
        deviceStatus: this.selectedDevice.status || 'offline',
        deviceType: this.selectedDevice.device_type,
        lastUpdated: new Date().toISOString()
      };
      
      // ใช้ DeviceService เพื่อเก็บข้อมูลและแจ้งให้ components อื่นทราบ
      this.deviceService.setSelectedDevice(deviceData);
    } else {
      // ถ้าไม่มีอุปกรณ์ที่เลือก ให้ลบข้อมูลออกจาก localStorage
      this.deviceService.setSelectedDevice(null);
    }
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
      this.lastClaimType = 'warn';
      this.lastClaimMessage = 'กรุณากรอก ID อุปกรณ์';
      return;
    }

    // ✅ ตรวจสอบรูปแบบอุปกรณ์
    const deviceName = this.claimDeviceId.trim();
    const isTestDevice = deviceName.toLowerCase().includes('test');
    
    if (!isTestDevice && !this.isValidProductionDevice(deviceName)) {
      this.lastClaimType = 'err';
      this.lastClaimMessage = 'รูปแบบอุปกรณ์ไม่ถูกต้อง! กรุณาใช้รูปแบบ esp32-soil-001 ถึง esp32-soil-999 หรือพิมพ์ "test" สำหรับอุปกรณ์ทดสอบ';
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
      
      // ✅ ตรวจสอบว่าชื่ออุปกรณ์มีคำว่า "test" หรือไม่
      const deviceName = this.claimDeviceId.trim();
      const isTestDevice = deviceName.toLowerCase().includes('test');
      
      const requestData = {
        deviceId: isTestDevice ? `esp32-soil-test-${Date.now()}` : deviceName,
        device_name: isTestDevice ? `esp32-soil-test-${Date.now()}` : deviceName,
        status: isTestDevice ? 'online' : 'offline', // ✅ test device = online, อุปกรณ์ทั่วไป = offline
        device_type: isTestDevice ? false : true, // ✅ false = test device, true = production device
        description: isTestDevice ? 'อุปกรณ์ทดสอบ ESP32 Soil Sensor สำหรับทดสอบ API measurement' : 'อุปกรณ์ทั่วไป',
        userid: this.userID ? parseInt(this.userID) : null // ✅ ส่ง userid ไปด้วย
      };
      
      console.log('📤 Sending request to:', `${this.apiUrl}/api/devices`);
      console.log('📤 Request data:', requestData);
      
      const response = await lastValueFrom(
        this.http.post<ClaimResponse>(`${this.apiUrl}/api/devices`, requestData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      );
      
      // ตรวจสอบ response หลายแบบ
      const isSuccess = response.success === true || 
                       response.message?.includes('successfully') || 
                       response.message?.includes('สำเร็จ') ||
                       response.device;
                       
      if (isSuccess) {
        console.log('✅ Device created in database:', response);
        
        // ✅ เพิ่ม device เข้าไปใน devices array จาก response จริง
        const newDevice: Device = {
          deviceid: response.device?.deviceid || Math.floor(Math.random() * 1000),
          device_name: response.device?.device_name || deviceName,
          created_at: response.device?.created_at || new Date().toISOString(),
          updated_at: response.device?.updated_at || new Date().toISOString(),
          userid: this.userID ? parseInt(this.userID) : 0,
          status: (response.device?.status || requestData.status) as 'online' | 'offline',
          device_type: response.device?.device_type || requestData.device_type,
          description: response.device?.description || requestData.description,
          api_key: response.device?.api_key
        };
        
        // เพิ่ม device ใหม่เข้าไปใน devices array
        this.devices.push(newDevice);
        
        // อัปเดต selectedDeviceId เป็น device ใหม่
        this.selectedDeviceId = newDevice.device_name;
        this.selectedDevice = newDevice;
        
        console.log('✅ Device added to devices array:', newDevice);
        console.log('📋 Total devices:', this.devices.length);
        
        // แสดง notification popup เมื่อเพิ่มอุปกรณ์สำเร็จ
        const deviceType = isTestDevice ? 'ESP32-soil-test' : 'ทั่วไป';
        this.showNotificationPopup(
          'success',
          'เพิ่มอุปกรณ์สำเร็จ!',
          `อุปกรณ์${deviceType}: ${isTestDevice ? `esp32-soil-test-${Date.now()}` : deviceName}\n\n${isTestDevice ? 'อุปกรณ์ทดสอบพร้อมใช้งานสำหรับทดสอบ API measurement' : 'อุปกรณ์พร้อมใช้งาน'}\n\nกดตกลงเพื่อรีเฟรซหน้า`,
          true,
          'ตกลง',
          () => {
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
      } else if (err.status === 404) {
        this.lastClaimMessage = 'API endpoint ไม่มีอยู่ กรุณาติดต่อผู้ดูแลระบบ';
      } else {
        this.lastClaimMessage = 'เพิ่มอุปกรณ์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      }
    } finally {
      this.requestingClaim = false;
    }
  }
  // เพิ่ม method สำหรับการเปลี่ยนอุปกรณ์
  async onDeviceChange() {
    // เลือกอุปกรณ์ใหม่
    this.selectDevice(this.selectedDeviceId);
    
    // Fetch ข้อมูลใหม่เพื่ออัปเดต device status
    await this.refreshDeviceStatus();
  }

  // เพิ่ม method สำหรับ refresh device status
  private async refreshDeviceStatus() {
    if (!this.selectedDevice) return;

    try {
      // แสดง loading state (optional)
      this.isLoading = true;

      // Fetch ข้อมูล device ใหม่จาก backend
      await this.loadDevices();

      // อัปเดต selectedDevice ด้วยข้อมูลใหม่
      const updatedDevice = this.devices.find(d => d.deviceid.toString() === this.selectedDeviceId);
      if (updatedDevice) {
        this.selectedDevice = updatedDevice;
        // อัปเดต localStorage ด้วยข้อมูลใหม่
        this.saveSelectedDeviceToStorage();
      }

      // Restart live monitor สำหรับอุปกรณ์ที่เลือก
      this.startLiveMonitor(this.selectedDeviceId);

    } catch (error) {
      console.error('❌ Error refreshing device status:', error);
    } finally {
      this.isLoading = false;
    }
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
