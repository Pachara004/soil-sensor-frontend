import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription, lastValueFrom } from 'rxjs'; // 👈 ใช้ lastValueFrom
import { Constants } from '../../../config/constants';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { DeviceService, SelectedDeviceData } from '../../../service/device.service';
import { Database, ref, onValue, get, off, set } from '@angular/fire/database'; // ✅ Firebase Database

interface Device {
  deviceid: number;
  device_name: string;
  created_at: string;
  updated_at: string;
  userid: number;
  status: 'online' | 'offline';
  device_type?: boolean;
  sensor_status?: 'online' | 'offline'; // ✅ เพิ่ม sensor_status จาก Firebase
  firebase_synced?: boolean; // ✅ บอกว่า device นี้มีใน Firebase หรือไม่
  [key: string]: any;
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
    private deviceService: DeviceService,
    private database: Database // ✅ เพิ่ม Firebase Database
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
            this.subscribeToNotifications(); // ✅ Subscribe ถึง notifications
          }, 100);
        }).catch((error) => {
          console.error('❌ Failed to get ID token:', error);
          this.loadUserProfile();
          this.loadDevices();
          this.subscribeToNotifications(); // ✅ Subscribe ถึง notifications
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
    // ✅ ยกเลิก Firebase subscriptions
    this.firebaseSubscriptions.forEach(unsub => unsub());
    this.firebaseSubscriptions = [];
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
      
      console.log('📦 Loading devices from PostgreSQL and Firebase...');
      
      // ✅ Step 1: ดึงข้อมูล devices จาก PostgreSQL
      let postgresDevices: Device[] = [];
      try {
        const token = await currentUser.getIdToken(true);
        const response = await lastValueFrom(
          this.http.get<Device[]>(`${this.apiUrl}/api/devices`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
        );
        postgresDevices = Array.isArray(response) ? response : [];
        console.log('✅ PostgreSQL devices:', postgresDevices.length, 'devices');
      } catch (deviceError: any) {
        console.error('❌ Error loading devices from PostgreSQL:', deviceError);
        postgresDevices = [];
      }
      
      // ✅ Step 2: ดึงข้อมูล devices จาก Firebase
      const firebaseDevices = await this.getFirebaseDevices();
      console.log('🔥 Firebase devices:', Object.keys(firebaseDevices).length, 'devices');
      
      // ✅ Step 3: เปรียบเทียบและรวมข้อมูล
      this.devices = await this.mergeDevicesWithFirebase(postgresDevices, firebaseDevices);
      console.log('📊 Merged devices:', this.devices.length, 'devices (matched only)');
      
      // ✅ Step 4: Subscribe to real-time updates for matched devices
      this.subscribeToFirebaseUpdates();
      
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
        console.log('⚠️ No matched devices found between PostgreSQL and Firebase');
        // ลบข้อมูลอุปกรณ์ออกจาก localStorage
        this.saveSelectedDeviceToStorage();
      }
    } catch (error: any) {
      console.error('❌ Error loading devices:', error);
      this.devices = [];
    } finally {
      this.isLoading = false;
    }
  }
  
  // ✅ ดึงข้อมูล devices จาก Firebase
  private async getFirebaseDevices(): Promise<Record<string, any>> {
    try {
      const devicesRef = ref(this.database, 'devices');
      const snapshot = await get(devicesRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('🔥 Firebase devices data:', data);
        return data;
      } else {
        console.log('⚠️ No devices found in Firebase');
        return {};
      }
    } catch (error) {
      console.error('❌ Error getting Firebase devices:', error);
      return {};
    }
  }
  
  // ✅ เปรียบเทียบและรวมข้อมูลจาก PostgreSQL และ Firebase
  private async mergeDevicesWithFirebase(
    postgresDevices: Device[], 
    firebaseDevices: Record<string, any>
  ): Promise<Device[]> {
    const mergedDevices: Device[] = [];
    
    for (const pgDevice of postgresDevices) {
      const deviceName = pgDevice.device_name;
      
      // ✅ ตรวจสอบว่า device นี้มีใน Firebase หรือไม่
      const firebaseDevice = firebaseDevices[deviceName];
      
      if (firebaseDevice) {
        // ✅ เช็คว่า deviceId ตรงกันหรือไม่
        const firebaseDeviceId = firebaseDevice.deviceId || firebaseDevice.deviceName;
        
        if (firebaseDeviceId === deviceName) {
          console.log(`✅ Device matched: ${deviceName}`);
          console.log(`   - PostgreSQL: deviceid=${pgDevice.deviceid}, name=${deviceName}`);
          console.log(`   - Firebase: deviceId=${firebaseDeviceId}`);
          console.log(`   - Sensor Status: ${this.extractSensorStatus(firebaseDevice)}`);
          console.log(`   - Sensor Data:`, firebaseDevice.sensor || firebaseDevice.sensor_status || 'N/A');
          
          // ✅ รวมข้อมูล: ใช้ sensor_status จาก Firebase (รองรับ sensor.online)
          const sensorStatus = this.extractSensorStatus(firebaseDevice);
          
          mergedDevices.push({
            ...pgDevice,
            sensor_status: sensorStatus,
            status: sensorStatus === 'online' ? 'online' : 'offline', // ✅ อัพเดท status จาก sensor_status
            firebase_synced: true,
            firebase_data: firebaseDevice // เก็บข้อมูล Firebase ไว้ใช้งาน
          });
        } else {
          console.log(`⚠️ Device name mismatch: ${deviceName}`);
          console.log(`   - PostgreSQL: ${deviceName}`);
          console.log(`   - Firebase: ${firebaseDeviceId}`);
          // ไม่แสดงอุปกรณ์ที่ไม่ตรงกัน
        }
      } else {
        console.log(`⚠️ Device not found in Firebase: ${deviceName}`);
        // ไม่แสดงอุปกรณ์ที่ไม่มีใน Firebase
      }
    }
    
    return mergedDevices;
  }
  
  // ✅ Extract sensor status from Firebase data (รองรับ sensor.online จาก ESP32)
  private extractSensorStatus(firebaseData: any): 'online' | 'offline' {
    // ✅ ตรวจสอบ sensor.online จาก ESP32 (ตามโค้ด ESP32 ที่ส่งมา)
    if (firebaseData.sensor && typeof firebaseData.sensor === 'object') {
      const sensorOnline = firebaseData.sensor.online;
      if (typeof sensorOnline === 'boolean') {
        return sensorOnline ? 'online' : 'offline';
      }
      if (typeof sensorOnline === 'string') {
        return (sensorOnline === 'true' || sensorOnline === '1') ? 'online' : 'offline';
      }
      if (typeof sensorOnline === 'number') {
        return sensorOnline === 1 ? 'online' : 'offline';
      }
    }
    
    // ✅ Fallback: ตรวจสอบ sensor_status (format เดิม)
    if (firebaseData.sensor_status) {
      return firebaseData.sensor_status === 'online' ? 'online' : 'offline';
    }
    
    // ✅ Fallback: ตรวจสอบ status
    if (firebaseData.status) {
      return firebaseData.status === 'online' ? 'online' : 'offline';
    }
    
    // ✅ Default: offline
    return 'offline';
  }
  
  // ✅ Subscribe to Firebase real-time updates
  private firebaseSubscriptions: (() => void)[] = [];
  
  // ✅ Notification system properties
  persistentNotifications: any[] = [];
  showPersistentNotification = false;
  currentPersistentNotification: any = null;
  
  private subscribeToFirebaseUpdates() {
    // ✅ ยกเลิก subscriptions เก่า
    this.firebaseSubscriptions.forEach(unsub => unsub());
    this.firebaseSubscriptions = [];
    
    // ✅ Subscribe to each device
    this.devices.forEach(device => {
      const deviceRef = ref(this.database, `devices/${device.device_name}`);
      
      const unsubscribe = onValue(deviceRef, (snapshot) => {
        if (snapshot.exists()) {
          const firebaseData = snapshot.val();
          
          // ✅ อัพเดท sensor_status และ status (รองรับ sensor.online)
          const deviceIndex = this.devices.findIndex(d => d.device_name === device.device_name);
          if (deviceIndex !== -1) {
            const sensorStatus = this.extractSensorStatus(firebaseData);
            
            this.devices[deviceIndex] = {
              ...this.devices[deviceIndex],
              sensor_status: sensorStatus,
              status: sensorStatus === 'online' ? 'online' : 'offline',
              firebase_data: firebaseData
            };
            
            console.log(`🔄 Real-time update: ${device.device_name} → ${sensorStatus}`);
            
            // ✅ ถ้าเป็น device ที่กำลังเลือกอยู่ ให้อัพเดท selectedDevice ด้วย
            if (this.selectedDevice && this.selectedDevice.device_name === device.device_name) {
              this.selectedDevice = this.devices[deviceIndex];
            }
          }
        }
      });
      
      this.firebaseSubscriptions.push(unsubscribe);
    });
    
    console.log(`📡 Subscribed to ${this.devices.length} devices for real-time updates`);
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
  // ✅ เพิ่มอุปกรณ์ใหม่พร้อม sync Firebase (POST /api/devices/add-device)
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
      
      // ✅ ตรวจสอบชื่อ device ซ้ำก่อนเพิ่ม
      const finalDeviceName = isTestDevice ? `esp32-soil-test-${Date.now()}` : deviceName;
      
      // เช็คชื่อซ้ำใน devices array ปัจจุบัน
      const existingDevice = this.devices.find(d => d.device_name === finalDeviceName);
      if (existingDevice) {
        this.lastClaimType = 'err';
        this.lastClaimMessage = `ชื่ออุปกรณ์ "${finalDeviceName}" มีอยู่แล้ว กรุณาใช้ชื่ออื่น`;
        this.requestingClaim = false;
        return;
      }
      
      // ✅ Dual-sync endpoint: ส่งข้อมูลตรงกับ Backend schema ที่แก้ไขแล้ว
      const requestData = {
        deviceName: finalDeviceName,
        deviceType: !isTestDevice  // ✅ true = production device, false = test device
      };
      
      console.log('📤 Sending request to:', `${this.apiUrl}/api/devices/add-device`);
      console.log('📤 Request data:', requestData);
      console.log('🔑 Token:', token ? '✅ Present' : '❌ Missing');
      console.log('🔍 Token preview:', token ? token.substring(0, 20) + '...' : 'N/A');
      
      const response = await lastValueFrom(
        this.http.post<any>(`${this.apiUrl}/api/devices/add-device`, requestData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      );
      
      console.log('✅ Response received:', response);
      
      // ✅ ตรวจสอบ response จาก dual-sync endpoint (รองรับ format ใหม่)
      if (response.device && (response.success === true || response.message?.includes('successfully'))) {
        console.log('✅ Device added successfully to PostgreSQL and Firebase!');
        console.log('📊 PostgreSQL data:', response.device);
        console.log('🔥 Firebase sync status:', response.firebasePaths);
        
        // ✅ เพิ่ม device เข้าไปใน devices array จาก response
        const newDevice: Device = {
          deviceid: response.device.deviceid,
          device_name: response.device.device_name,
          created_at: response.device.created_at,
          updated_at: response.device.updated_at,
          userid: response.device.userid || (this.userID ? parseInt(this.userID) : 0),
          status: response.device.status as 'online' | 'offline',
          device_type: response.device.device_type,
          description: response.device.description
        };
        
        // เพิ่ม device ใหม่เข้าไปใน devices array
        this.devices.push(newDevice);
        
        // อัปเดต selectedDeviceId เป็น device ใหม่
        this.selectedDeviceId = newDevice.deviceid.toString();
        this.selectedDevice = newDevice;
        
        console.log('✅ Device added to UI:', newDevice);
        console.log('📋 Total devices:', this.devices.length);
        
        // แสดง notification popup พร้อมข้อมูล Firebase sync
        const firebaseSynced = response.firebasePaths ? '✅ Sync ไปยัง Firebase สำเร็จ' : '⚠️ Firebase sync ไม่สำเร็จ';
        const deviceType = isTestDevice ? 'ทดสอบ' : 'ทั่วไป';
        
        this.showNotificationPopup(
          'success',
          'เพิ่มอุปกรณ์สำเร็จ!',
          `อุปกรณ์${deviceType}: ${newDevice.device_name}\n\n✅ บันทึกลง PostgreSQL\n${firebaseSynced}\n\nอุปกรณ์พร้อมใช้งาน!\n\nกดตกลงเพื่อโหลดข้อมูลใหม่`,
          true,
          'ตกลง',
          async () => {
            // ✅ Fetch ข้อมูลใหม่แทนการรีเฟรชหน้า
            console.log('🔄 Fetching updated device list...');
            await this.loadDevices();
            console.log('✅ Device list updated successfully');
          }
        );
      } else {
        console.log('❌ Response indicates failure:', response);
        this.lastClaimType = 'err';
        this.lastClaimMessage = response.message || 'เพิ่มอุปกรณ์ไม่สำเร็จ';
      }
      
    } catch (err: any) {
      console.error('❌ Add device error:', err);
      console.error('❌ Error status:', err.status);
      console.error('❌ Error message:', err.message);
      this.lastClaimType = 'err';
      
      // ให้ข้อความ error ที่ชัดเจนขึ้น
      const deviceNameForError = this.claimDeviceId.trim();
      if (err.status === 400) {
        // ตรวจสอบว่าเป็น error เรื่องชื่อซ้ำหรือไม่
        if (err.error && err.error.message && err.error.message.includes('duplicate')) {
          this.lastClaimMessage = `ชื่ออุปกรณ์ "${deviceNameForError}" มีอยู่แล้ว กรุณาใช้ชื่ออื่น`;
        } else {
          this.lastClaimMessage = 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบข้อมูลที่กรอก';
        }
      } else if (err.status === 401) {
        this.lastClaimMessage = 'ไม่มีสิทธิ์ กรุณาเข้าสู่ระบบใหม่';
      } else if (err.status === 409) {
        this.lastClaimMessage = `ชื่ออุปกรณ์ "${deviceNameForError}" มีอยู่แล้ว กรุณาใช้ชื่ออื่น`;
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

  // ✅ Subscribe ถึง notifications จาก Firebase
  private subscribeToNotifications() {
    if (!this.currentUser) return;
    
    try {
      // ✅ ดึง userid จาก localStorage หรือ API
      const userData = localStorage.getItem('user');
      let userId = null;
      
      if (userData) {
        try {
          const parsedUserData = JSON.parse(userData);
          userId = parsedUserData.userid || parsedUserData.id;
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }
      
      if (!userId) {
        console.log('ℹ️ No user ID found for notifications');
        return;
      }
      
      console.log(`🔔 Subscribing to notifications for user: ${userId}`);
      
      // ✅ Subscribe ถึง notifications path
      const notificationsRef = ref(this.database, `notifications/${userId}`);
      const unsubscribe = onValue(notificationsRef, (snapshot) => {
        if (snapshot.exists()) {
          const notifications = snapshot.val();
          const notificationList = Object.values(notifications) as any[];
          
          // ✅ หา persistent notifications ที่ยังไม่ได้อ่าน
          const unreadPersistentNotifications = notificationList.filter(notification => 
            notification.persistent && !notification.read
          );
          
          if (unreadPersistentNotifications.length > 0) {
            // ✅ แสดง persistent notification แรก
            const latestNotification = unreadPersistentNotifications[unreadPersistentNotifications.length - 1];
            this.showPersistentNotification = true;
            this.currentPersistentNotification = latestNotification;
            
            console.log('🔔 New persistent notification:', latestNotification);
          } else {
            this.showPersistentNotification = false;
            this.currentPersistentNotification = null;
          }
          
          this.persistentNotifications = unreadPersistentNotifications;
        } else {
          this.showPersistentNotification = false;
          this.currentPersistentNotification = null;
          this.persistentNotifications = [];
        }
      });
      
      // ✅ เก็บ unsubscribe function
      this.firebaseSubscriptions.push(unsubscribe);
      
    } catch (error) {
      console.error('❌ Error subscribing to notifications:', error);
    }
  }

  // ✅ รับทราบ persistent notification
  async acknowledgeNotification(notificationId: string) {
    try {
      if (!this.currentUser) return;
      
      const userData = localStorage.getItem('user');
      let userId = null;
      
      if (userData) {
        try {
          const parsedUserData = JSON.parse(userData);
          userId = parsedUserData.userid || parsedUserData.id;
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }
      
      if (!userId) return;
      
      // ✅ อัปเดต notification เป็น read
      const notificationRef = ref(this.database, `notifications/${userId}/${notificationId}`);
      await set(notificationRef, {
        ...this.currentPersistentNotification,
        read: true,
        acknowledgedAt: new Date().toISOString()
      });
      
      console.log('✅ Notification acknowledged:', notificationId);
      
      // ✅ ซ่อน persistent notification
      this.showPersistentNotification = false;
      this.currentPersistentNotification = null;
      
    } catch (error) {
      console.error('❌ Error acknowledging notification:', error);
    }
  }

  // ✅ ปิด persistent notification (ชั่วคราว)
  dismissPersistentNotification() {
    this.showPersistentNotification = false;
    // ✅ ไม่ลบ notification จาก Firebase เพื่อให้แสดงอีกครั้งเมื่อ refresh
  }

  // ✅ จัดรูปแบบเวลาสำหรับ notification
  formatNotificationTime(timestamp: string): string {
    if (!timestamp) return 'ไม่ระบุ';
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMins < 1) {
        return 'เมื่อสักครู่';
      } else if (diffMins < 60) {
        return `${diffMins} นาทีที่แล้ว`;
      } else if (diffHours < 24) {
        return `${diffHours} ชั่วโมงที่แล้ว`;
      } else if (diffDays < 7) {
        return `${diffDays} วันที่แล้ว`;
      } else {
        return date.toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      console.error('Error formatting notification time:', error);
      return 'ไม่ระบุ';
    }
  }
}
