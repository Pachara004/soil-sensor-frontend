import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Map, Marker, config, LngLatBounds, Popup } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { environment } from '../../../service/environment';
import { Constants } from '../../../config/constants';
import { lastValueFrom } from 'rxjs';
import { Database, ref, onValue, off } from '@angular/fire/database';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { NotificationService } from '../../../service/notification.service';
import { DeviceService, SelectedDeviceData } from '../../../service/device.service';
import { AuthService } from '../../../service/auth.service';
interface UserData {
  username: string;
  userID: string;
  name: string;
  email: string;
  phone: string;
  devices?: { [key: string]: boolean };
}
interface Measurement {
  deviceId: string;
  temperature: number;
  moisture: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  lat: number;
  lng: number;
  date: string;
  timestamp: number;
  locationNameType?: 'custom' | 'auto';
  customLocationName?: string | null;
  autoLocationName?: string | null;
  areasid?: string; // ใช้ undefined แทน null (ถ้าจะใช้ null ให้เปลี่ยนเป็น: string | null)
  measurementPoint?: number;
}
interface Area {
  id: string;
  name: string;
  deviceId: string;
  username: string;
  polygonBounds: [number, number][];
  createdDate: string;
  createdTimestamp: number;
  totalMeasurements: number;
  averages?: {
    temperature: number;
    moisture: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    ph: number;
  };
}
// ✅ Interface สำหรับ Firebase live data
interface FirebaseLiveData {
  temperature: number;
  moisture: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  timestamp: number;
  deviceId: string;
  status: 'online' | 'offline';
  latitude?: number;        // GPS latitude
  longitude?: number;       // GPS longitude
  isMeasuring?: boolean;    // กำลังวัดหรือไม่
  currentPointIndex?: number; // จุดที่กำลังวัด
}
@Component({
  selector: 'app-measure',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './measure.component.html',
  styleUrls: ['./measure.component.scss'],
})
export class MeasureComponent implements OnInit, AfterViewInit, OnDestroy {
  customLocationName: string = '';
  areaName: string = '';
  currentAreaId: string | null = null;
  currentArea: Area | null = null;
  measurements: Measurement[] = [];
  measurementCount = 0;
  // Minimal fields used by template
  isLoading = false;
  bounds: any = null;
  temperature = 0;
  moisture = 0;
  nitrogen = 0;
  phosphorus = 0;
  potassium = 0;
  ph = 0;
  locationDetail = '';
  showPopup = false;
  points: any[] = [];
  selectedPoints: [number, number][] = [];
  isSelectingArea = false;
  currentPolygon: any = null;
  measurementPoints: [number, number][] = []; // ✅ จุดที่ต้องวัด
  showMeasurementPoints = false; // ✅ แสดงจุดที่ต้องวัด
  measuredPoints: number[] = []; // ✅ จุดที่วัดแล้ว
  currentPointIndex = 0; // ✅ จุดที่กำลังวัด
  selectedPointIndex: number | null = null; // ✅ จุดที่เลือกอยู่
  pointSelectionEnabled: boolean = true; // ✅ เปิดใช้งานการเลือกจุด
  currentMeasuringPoint: number | null = null; // ✅ จุดที่กำลังวัด
  deviceMarker: any = null; // ✅ Marker ของอุปกรณ์
  measurementMarkers: any[] = []; // ✅ Markers ของจุดวัด
  // ✅ Firebase live data properties
  liveData: FirebaseLiveData | null = null;
  isLiveDataConnected = false;
  liveDataSubscription: any = null;
  currentUser: any = null;
  // ✅ User data properties
  userName: string = '';
  userEmail: string = '';
  userPhone: string = '';
  deviceName: string = '';
  deviceStatus: 'online' | 'offline' = 'offline';
  // ✅ UI Control properties
  showUserInfo = true;  // แสดงข้อมูล user โดยอัตโนมัติ
  showDeviceInfo = false;
  showMainMap = false;
  showCardMenu = false;
  
  // ✅ Measurement status properties
  isWaitingForStable = false;
  countdownSeconds = 0;
  map: Map | undefined;
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLElement>;
  private apiUrl: string;
  deviceId: string | null = null;
  username: string = '';
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private http: HttpClient,
    private constants: Constants,
    private database: Database,
    private auth: Auth,
    private authService: AuthService,
    private notificationService: NotificationService,
    private deviceService: DeviceService
  ) {
    this.apiUrl = this.constants.API_ENDPOINT;
    config.apiKey = environment.mapTilerApiKey;
  }
  ngOnInit(): void {
    // ✅ รับข้อมูลอุปกรณ์จาก query parameters หรือ DeviceService
    this.route.queryParams.subscribe(params => {
      if (params['deviceId']) {
        this.deviceId = params['deviceId'];
        this.deviceName = params['deviceName'] || 'ไม่ระบุ';
        this.deviceStatus = params['deviceStatus'] || 'offline';
        // Device data received from main page
      } else {
        // ถ้าไม่มี query parameters ให้ดึงจาก DeviceService
        const savedDevice = this.deviceService.getSelectedDevice();
        if (savedDevice) {
          this.deviceId = savedDevice.deviceId;
          this.deviceName = savedDevice.deviceName;
          this.deviceStatus = savedDevice.deviceStatus;
          console.log('📱 Device data loaded from DeviceService:', savedDevice);
        }
      }
      
      // ✅ สำหรับ test devices เท่านั้น ให้สร้างข้อมูลปลอมทันที
      const isTestDevice = this.deviceName && this.deviceName.toLowerCase().includes('test');
    });
    // ✅ ใช้ Firebase Auth แทน localStorage
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.currentUser = user;
        this.username = user.displayName || user.email?.split('@')[0] || '';
        // User authenticated
        // ✅ ดึงข้อมูล user เสมอ และ device (ถ้าไม่มีข้อมูลจาก main page)
        this.loadUserAndDeviceData();
        // ✅ เริ่มต้นการเชื่อมต่อ Firebase live data
        this.initializeFirebaseConnection();
        // ✅ แสดงแผนที่ทันทีเมื่อเข้าหน้า
        this.showPopup = true;
        this.isSelectingArea = true;
        // ✅ เริ่มต้นแผนที่ใน popup หลังจากแสดง popup
        setTimeout(() => {
          this.initializePopupMap();
        }, 1000);
      } else {
        // User not authenticated, redirecting to login
        this.router.navigate(['/']);
      }
    });
  }
  async ngAfterViewInit() {
    await this.initializeMap();
    // ✅ เริ่มต้นแผนที่ใน popup เมื่อ popup แสดง
    if (this.showPopup) {
      this.initializePopupMap();
    }
  }
  ngOnDestroy() {
    // Component destroying
    // ✅ ปิดการเชื่อมต่อ Firebase Realtime Database ก่อน
    if (this.liveDataSubscription) {
      try {
        off(this.liveDataSubscription);
        // Firebase connection closed
      } catch (error) {
        // Error closing Firebase connection
      }
      this.liveDataSubscription = null;
    }
    // ✅ ปิดแผนที่
    if (this.map) {
      try {
        this.map.remove();
        // Map removed
      } catch (error) {
        // Error removing map
      }
      this.map = undefined;
    }
    // Component destroyed successfully
  }
  // ✅ ดึงข้อมูล user และ device
  async loadUserAndDeviceData() {
    if (!this.currentUser) return;
    try {
      // Loading user and device data
      // ✅ ใช้ข้อมูลจาก Firebase เป็นหลัก
      this.userName = this.currentUser.displayName || this.currentUser.email?.split('@')[0] || '';
      this.userEmail = this.currentUser.email || '';
      // ✅ ดึงข้อมูลเพิ่มเติมจาก backend
      const token = await this.currentUser.getIdToken();
      // ✅ ดึงข้อมูล user เสมอ
      try {
        const userResponse = await lastValueFrom(
          this.http.get<any>(`${this.apiUrl}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );
        if (userResponse && userResponse.user) {
          const userData = userResponse.user;
          this.userName = userData.user_name || userData.username || this.userName;
          this.userEmail = userData.user_email || userData.email || this.userEmail;
          this.userPhone = userData.user_phone || userData.phone || '';
          // User data loaded from backend
        } else {
          // No user data in backend response, using Firebase data
        }
      } catch (userError) {
        // Could not load user data from backend, using Firebase data
      }
      // ✅ แสดงข้อมูล user ที่ได้
      // Final user data loaded
      // ✅ ดึงข้อมูล device
      try {
        const devicesResponse = await lastValueFrom(
          this.http.get<any[]>(`${this.apiUrl}/api/devices`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );
        if (devicesResponse && devicesResponse.length > 0) {
          // ✅ หา device ที่ตรงกับ deviceId ที่ส่งมาจาก main page
          let device = devicesResponse.find(d => d.deviceid?.toString() === this.deviceId) || devicesResponse[0];
          // ✅ ใช้ข้อมูลจาก backend เฉพาะถ้าไม่มีข้อมูลจาก main page
          if (!this.deviceId) {
            this.deviceName = device.device_name || device.displayName || device.id || 'ไม่ระบุ';
            this.deviceId = device.deviceid?.toString() || device.id;
          }
          // ✅ ตรวจสอบสถานะ device จาก database
          this.checkDeviceStatusFromDatabase(device);
          // Device data loaded
          // ✅ สำหรับ test devices เท่านั้น ให้สร้างข้อมูลปลอมทันที
          const isTestDevice = device.device_type === false || (this.deviceName && this.deviceName.toLowerCase().includes('test'));
          if (isTestDevice) {
            // Test device detected - generating initial fake data
            setTimeout(() => {
              this.generateFakeSensorData();
            }, 1000); // รอ 1 วินาทีให้ component โหลดเสร็จ
          } else {
            // Production device detected - using real sensor data
          }
        } else {
          // No devices found for user
          if (!this.deviceId) {
            this.deviceName = 'ไม่พบอุปกรณ์';
          }
        }
      } catch (deviceError) {
        // Could not load device data from backend
        if (!this.deviceId) {
          this.deviceName = 'ไม่สามารถโหลดข้อมูลอุปกรณ์';
        }
      }
    } catch (error) {
      console.error('❌ Error loading user and device data:', error);
    }
  }
  // ✅ ตรวจสอบสถานะ device จาก database
  checkDeviceStatusFromDatabase(device: any) {
    // ✅ ใช้ device_type จาก database: false = test device (online), true = production device (offline)
    const isTestDevice = device.device_type === false;
    if (isTestDevice) {
      this.deviceStatus = 'online'; // test devices เป็น online เสมอ
    } else {
      // ✅ สำหรับ production devices ให้ตรวจสอบจาก Firebase live data
      this.checkDeviceStatusFromFirebase(device.deviceid?.toString() || device.id);
    }
  }
  // ✅ ตรวจสอบสถานะ device จาก Firebase live data (สำหรับ production devices)
  checkDeviceStatusFromFirebase(deviceId: string) {
    // ✅ ตรวจสอบจาก Firebase live data สำหรับ production devices
    if (this.liveData && this.liveData.deviceId === deviceId) {
      this.deviceStatus = this.liveData.status || 'offline';
    } else {
      // ✅ ถ้าไม่มี live data ให้ตรวจสอบจาก timestamp
      if (this.liveData && this.liveData.timestamp) {
        const now = Date.now();
        const timeDiff = now - this.liveData.timestamp;
        const fiveMinutes = 5 * 60 * 1000; // 5 นาที
        this.deviceStatus = timeDiff < fiveMinutes ? 'online' : 'offline';
      } else {
        this.deviceStatus = 'offline';
      }
    }
  }
  // ✅ ตรวจสอบสถานะ device (ออนไลน์/ออฟไลน์) - legacy function
  checkDeviceStatus(deviceId: string) {
    // ✅ สำหรับ test devices ให้ตรวจสอบจาก device name
    if (this.deviceName && this.deviceName.toLowerCase().includes('test')) {
      this.deviceStatus = 'online'; // test devices เป็น online เสมอ
      return;
    }
    // ✅ ตรวจสอบจาก Firebase live data สำหรับ production devices
    this.checkDeviceStatusFromFirebase(deviceId);
  }
  // ✅ สร้างข้อมูลเซ็นเซอร์ปลอมสำหรับ test devices เท่านั้น
  generateFakeSensorData() {
    // ✅ ตรวจสอบว่าเป็น test device จริงๆ
    const isTestDevice = (this.deviceName && this.deviceName.toLowerCase().includes('test')) || 
                        (this.liveData && this.liveData.deviceId && this.liveData.deviceId.includes('test'));
    if (!isTestDevice) {
      this.notificationService.showNotification('error', 'ไม่สามารถสร้างข้อมูลปลอมได้', 'ฟีเจอร์นี้ใช้ได้เฉพาะกับ test devices เท่านั้น');
      return;
    }
    // ✅ สร้างข้อมูลเซ็นเซอร์ปลอมที่สมจริง (จำกัด precision เพื่อป้องกัน numeric field overflow)
    const fakeData = {
      temperature: this.limitPrecision(this.generateRandomValue(20, 35, 1), 2), // 20-35°C, 2 ทศนิยม
      moisture: this.limitPrecision(this.generateRandomValue(30, 80, 1), 2), // 30-80%, 2 ทศนิยม
      nitrogen: this.limitPrecision(this.generateRandomValue(10, 50, 1), 2), // 10-50 ppm, 2 ทศนิยม
      phosphorus: this.limitPrecision(this.generateRandomValue(5, 30, 1), 2), // 5-30 ppm, 2 ทศนิยม
      potassium: this.limitPrecision(this.generateRandomValue(8, 40, 1), 2), // 8-40 ppm, 2 ทศนิยม
      ph: this.limitPrecision(this.generateRandomValue(5.5, 7.5, 2), 2), // 5.5-7.5, 2 ทศนิยม
      lat: this.roundLatLng(this.generateRandomValue(16.0, 16.5, 6), 6), // ✅ จำกัด precision lat สำหรับ database constraint
      lng: this.roundLatLng(this.generateRandomValue(103.0, 103.5, 6), 6), // ✅ จำกัด precision lng สำหรับ database constraint
      timestamp: Date.now()
    };
    // ✅ อัปเดต liveData ด้วยข้อมูลปลอม
    this.liveData = {
      ...this.liveData,
      ...fakeData,
      deviceId: this.deviceId || 'test-device',
      status: 'online' as 'online' | 'offline'
    };
    // ✅ อัปเดต measurement values
    this.temperature = fakeData.temperature;
    this.moisture = fakeData.moisture;
    this.nitrogen = fakeData.nitrogen;
    this.phosphorus = fakeData.phosphorus;
    this.potassium = fakeData.potassium;
    this.ph = fakeData.ph;
  }
  // ✅ สร้างตัวเลขสุ่ม
  generateRandomValue(min: number, max: number, decimals: number = 0): number {
    const value = Math.random() * (max - min) + min;
    return Number(value.toFixed(decimals));
  }
  // ✅ จำกัด precision ของ lat/lng เพื่อป้องกัน numeric field overflow
  limitPrecision(value: number, decimals: number = 6): number {
    return Number(value.toFixed(decimals));
  }
  // ✅ Special function for lat/lng with precision 10, scale 8 (max 2 integer digits)
  roundLatLng(value: number, decimals: number = 6): number {
    if (value === null || value === undefined) return 0;
    // For precision 10, scale 8: max value is 99.99999999
    const maxValue = 99.99999999;
    const rounded = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
    return Math.min(Math.max(rounded, -maxValue), maxValue);
  }
  
  // ✅ แสดงตำแหน่ง ESP32 บนแผนที่
  addESP32MarkerToMap(lat: number, lng: number, pointNumber: number, measurementData: any) {
    if (!this.map) {
      console.error('❌ Map not initialized');
      return;
    }
    
    console.log(`📍 Adding ESP32 marker for point ${pointNumber} at:`, { lat, lng });
    
    // สร้าง popup HTML สำหรับแสดงข้อมูลการวัด
    const popupHTML = `
      <div class="esp32-marker-popup">
        <h4 class="popup-title">📍 จุดที่ ${pointNumber}</h4>
        <div class="popup-subtitle">🛰️ ตำแหน่ง GPS จาก ESP32</div>
        <div class="popup-content">
          <div class="popup-section">
            <div class="popup-label">📍 พิกัด GPS:</div>
            <div class="popup-value">
              <strong>Lat:</strong> ${lat.toFixed(8)}<br>
              <strong>Lng:</strong> ${lng.toFixed(8)}
            </div>
          </div>
          <div class="popup-section">
            <div class="popup-label">🌡️ ข้อมูลการวัด:</div>
            <div class="popup-value">
              <strong>อุณหภูมิ:</strong> ${measurementData.temperature?.toFixed(1) || 'N/A'}°C<br>
              <strong>ความชื้น:</strong> ${measurementData.moisture?.toFixed(1) || 'N/A'}%<br>
              <strong>pH:</strong> ${measurementData.ph?.toFixed(2) || 'N/A'}
            </div>
          </div>
          <div class="popup-section">
            <div class="popup-label">🌱 ธาตุอาหารพืช:</div>
            <div class="popup-value">
              <strong>N:</strong> ${measurementData.nitrogen?.toFixed(0) || 'N/A'} mg/kg<br>
              <strong>P:</strong> ${measurementData.phosphorus?.toFixed(0) || 'N/A'} mg/kg<br>
              <strong>K:</strong> ${measurementData.potassium?.toFixed(0) || 'N/A'} mg/kg
            </div>
          </div>
          <div class="popup-footer">
            <small>⏱️ ${new Date().toLocaleString('th-TH')}</small>
          </div>
        </div>
      </div>
    `;
    
    // สร้าง marker element
    const markerEl = document.createElement('div');
    markerEl.className = 'esp32-marker';
    markerEl.innerHTML = `
      <div class="marker-icon">
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18" fill="#4CAF50" stroke="#fff" stroke-width="3"/>
          <text x="20" y="26" text-anchor="middle" fill="#fff" font-size="16" font-weight="bold">${pointNumber}</text>
        </svg>
      </div>
    `;
    
    // เพิ่ม animation
    markerEl.style.animation = 'marker-bounce 0.6s ease-out';
    
    // สร้าง marker
    const marker = new Marker({ element: markerEl })
      .setLngLat([lng, lat])
      .setPopup(new Popup({ offset: 25 }).setHTML(popupHTML))
      .addTo(this.map);
    
    // เก็บ marker ไว้ใน array
    this.measurementMarkers.push(marker);
    
    console.log(`✅ ESP32 marker added for point ${pointNumber}`);
    
    // ✅ ปรับ map view ให้เห็น marker ใหม่
    this.map.flyTo({
      center: [lng, lat],
      zoom: 17,
      duration: 1500,
      essential: true
    });
  }
  
  // ✅ ลบ markers ทั้งหมดออกจากแผนที่
  clearESP32Markers() {
    if (this.measurementMarkers && this.measurementMarkers.length > 0) {
      console.log(`🗑️ Removing ${this.measurementMarkers.length} ESP32 markers`);
      this.measurementMarkers.forEach(marker => marker.remove());
      this.measurementMarkers = [];
    }
  }
  
  // ✅ รอรับข้อมูลการวัดจาก ESP32 ผ่าน Firebase
  async waitForESP32Measurement(pointNumber: number): Promise<any> {
    const timeout = 300000; // 5 minutes timeout
    const pollInterval = 2000; // ตรวจสอบทุก 2 วินาที
    const startTime = Date.now();
    
    console.log(`⏳ Waiting for ESP32 measurement at point ${pointNumber}...`);
    
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        const elapsedTime = Date.now() - startTime;
        
        // Check timeout
        if (elapsedTime > timeout) {
          console.error(`❌ Timeout waiting for ESP32 measurement at point ${pointNumber}`);
          clearInterval(checkInterval);
          resolve(null);
          return;
        }
        
        try {
          // ดึงข้อมูลจาก Firebase /measurements/{deviceId}
          const token = await this.currentUser.getIdToken();
          const response: any = await lastValueFrom(
            this.http.get(`${this.apiUrl}/api/realtime/live-measurements/${this.deviceId}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })
          );
          
          console.log(`📊 Firebase data check for point ${pointNumber}:`, response);
          
          // ตรวจสอบว่า ESP32 วัดเสร็จแล้วหรือยัง (finished = true)
          if (response && response.finished === true) {
            console.log(`✅ ESP32 finished measuring point ${pointNumber}`);
            clearInterval(checkInterval);
            resolve(response);
            return;
          }
          
          // แสดงความคืบหน้า
          const progress = response?.progress || 0;
          console.log(`📈 Measurement progress for point ${pointNumber}: ${progress}%`);
          
        } catch (error: any) {
          console.error(`❌ Error checking Firebase for point ${pointNumber}:`, error);
          // ไม่ resolve เพื่อให้ลองใหม่ในรอบถัดไป
        }
      }, pollInterval);
    });
  }
  
  // ✅ เริ่มต้นการเชื่อมต่อ Firebase
  initializeFirebaseConnection() {
    if (!this.currentUser) {
      console.error('❌ No current user for Firebase connection');
      return;
    }
    
    // ✅ ปิดการเชื่อมต่อเดิมก่อน (ถ้ามี)
    if (this.liveDataSubscription) {
      try {
        off(this.liveDataSubscription);
      } catch (error) {
        console.error('❌ Error unsubscribing from Firebase:', error);
      }
      this.liveDataSubscription = null;
    }
    
    // ✅ เชื่อมต่อกับ Firebase Realtime Database - ใช้ device-specific path
    if (this.deviceId) {
      console.log('🔗 Connecting to Firebase for device:', this.deviceId);
      
      // ลองหลาย path ที่เป็นไปได้ รวมถึง measurement
      const possiblePaths = [
        `live/${this.deviceId}`,
        `live/esp32-soil-${this.deviceId}`,
        `live/esp32-soil-001`,
        `devices/${this.deviceId}`,
        `Devices/${this.deviceId}`,
        `measurement/${this.deviceId}`,
        `measurements/${this.deviceId}`,
        `live`,
        `devices`,
        `Devices`,
        `measurement`,
        `measurements`
      ];
      
      // เชื่อมต่อกับ path แรกที่ทำงาน
      this.tryConnectToFirebasePaths(possiblePaths, 0);
    } else {
      console.log('⚠️ No deviceId available for Firebase connection');
      // ลองเชื่อมต่อกับ path ทั่วไป
      this.tryConnectToFirebasePaths(['live', 'devices', 'Devices', 'measurement', 'measurements'], 0);
    }
  }
  
  // ✅ ลองเชื่อมต่อกับ Firebase paths หลายตัว
  private tryConnectToFirebasePaths(paths: string[], index: number) {
    if (index >= paths.length) {
      console.log('❌ All Firebase paths failed');
      this.isLiveDataConnected = false;
      return;
    }
    
    const currentPath = paths[index];
    console.log(`🔄 Trying Firebase path: ${currentPath}`);
    
    const liveDataRef = ref(this.database, currentPath);
    this.liveDataSubscription = onValue(liveDataRef, (snapshot) => {
      try {
        const data = snapshot.val();
        console.log(`📊 Firebase data from ${currentPath}:`, data);
        
        if (data) {
          // ถ้าเป็น object ที่มี deviceId หลายตัว ให้หา device ที่ตรงกัน
          if (typeof data === 'object' && !data.deviceId) {
            // หา device ที่ตรงกับ deviceId ปัจจุบัน
            const deviceData = this.findDeviceDataInFirebase(data, this.deviceId!);
            if (deviceData) {
              this.liveData = deviceData;
              this.isLiveDataConnected = true;
              this.updateMeasurementValues(deviceData);
              console.log('✅ Found device data in Firebase:', deviceData);
              return;
            }
            
            // ✅ ลองหาข้อมูล measurement ล่าสุด
            const latestMeasurement = this.findLatestMeasurement(data, this.deviceId!);
            if (latestMeasurement) {
              this.liveData = latestMeasurement;
              this.isLiveDataConnected = true;
              this.updateMeasurementValues(latestMeasurement);
              console.log('✅ Found latest measurement in Firebase:', latestMeasurement);
              return;
            }
          } else if (data.deviceId === this.deviceId || !this.deviceId) {
            // ข้อมูลตรงกับ device หรือไม่มี deviceId
            this.liveData = data;
            this.isLiveDataConnected = true;
            this.updateMeasurementValues(data);
            console.log('✅ Connected to Firebase successfully:', data);
            return;
          }
        }
        
        // ถ้าไม่เจอข้อมูล ลอง path ถัดไป
        this.tryConnectToFirebasePaths(paths, index + 1);
        
      } catch (error) {
        console.error(`❌ Error processing Firebase data from ${currentPath}:`, error);
        this.tryConnectToFirebasePaths(paths, index + 1);
      }
    }, (error) => {
      console.error(`❌ Firebase connection error for ${currentPath}:`, error);
      this.tryConnectToFirebasePaths(paths, index + 1);
    });
  }
  
  // ✅ หาข้อมูล device ใน Firebase data
  private findDeviceDataInFirebase(firebaseData: any, deviceId: string): any {
    console.log('🔍 Searching for device data in Firebase:', firebaseData);
    console.log('🔍 Looking for deviceId:', deviceId);
    
    // ลองหาในหลายรูปแบบ
    const possibleKeys = [
      deviceId,
      `device_${deviceId}`,
      `esp32_${deviceId}`,
      `soil_${deviceId}`,
      `esp32-soil-${deviceId}`,
      `device_${deviceId}`,
      `Device_${deviceId}`,
      'esp32-soil-001'  // ✅ เพิ่ม key สำหรับ live data
    ];
    
    for (const key of possibleKeys) {
      if (firebaseData[key]) {
        console.log(`✅ Found device data with key: ${key}`);
        return firebaseData[key];
      }
    }
    
    // ลองหาใน array หรือ object ที่มี deviceId
    for (const key in firebaseData) {
      const item = firebaseData[key];
      if (item && typeof item === 'object') {
        // ตรวจสอบหลาย field ที่อาจเป็น deviceId
        const deviceFields = ['deviceId', 'device_id', 'deviceid', 'id', 'device_name'];
        
        for (const field of deviceFields) {
          if (item[field] === deviceId || item[field] === parseInt(deviceId)) {
            console.log(`✅ Found device data in object with key: ${key}, field: ${field}`);
            return item;
          }
        }
        
        // ตรวจสอบว่าเป็น device name ที่ตรงกันหรือไม่
        if (item.device_name && item.device_name.includes(deviceId)) {
          console.log(`✅ Found device data by name with key: ${key}`);
          return item;
        }
        
        // ✅ ตรวจสอบ esp32-soil-001 โดยตรง
        if (item.deviceId === 'esp32-soil-001' || item.deviceName === 'esp32-soil-001') {
          console.log(`✅ Found esp32-soil-001 data with key: ${key}`);
          return item;
        }
      }
    }
    
    console.log('❌ No device data found in Firebase');
    return null;
  }
  
  // ✅ หาข้อมูล measurement ล่าสุดใน Firebase
  private findLatestMeasurement(firebaseData: any, deviceId: string): any {
    console.log('🔍 Searching for latest measurement in Firebase:', firebaseData);
    console.log('🔍 Looking for deviceId:', deviceId);
    
    let latestMeasurement = null;
    let latestTimestamp = 0;
    
    // ลองหาในหลายรูปแบบ
    for (const key in firebaseData) {
      const item = firebaseData[key];
      if (item && typeof item === 'object') {
        // ตรวจสอบว่าเป็น measurement หรือไม่
        if (item.deviceid === parseInt(deviceId) || item.deviceId === deviceId || item.device_id === deviceId) {
          // ตรวจสอบ timestamp
          const timestamp = item.timestamp || item.created_at || item.updated_at || 0;
          if (timestamp > latestTimestamp) {
            latestTimestamp = timestamp;
            latestMeasurement = item;
            console.log(`✅ Found measurement with timestamp: ${timestamp}`);
          }
        }
        
        // ลองหาใน nested object
        if (item.measurements && Array.isArray(item.measurements)) {
          for (const measurement of item.measurements) {
            if (measurement.deviceid === parseInt(deviceId) || measurement.deviceId === deviceId) {
              const timestamp = measurement.timestamp || measurement.created_at || measurement.updated_at || 0;
              if (timestamp > latestTimestamp) {
                latestTimestamp = timestamp;
                latestMeasurement = measurement;
                console.log(`✅ Found measurement in array with timestamp: ${timestamp}`);
              }
            }
          }
        }
      }
    }
    
    if (latestMeasurement) {
      console.log('✅ Found latest measurement:', latestMeasurement);
    } else {
      console.log('❌ No measurement found in Firebase');
    }
    
    return latestMeasurement;
  }
  // ✅ อัปเดตค่าการวัดใน UI
  updateMeasurementValues(data: FirebaseLiveData) {
    console.log('🔄 Updating measurement values:', data);
    
    this.temperature = data.temperature || 0;
    this.moisture = data.moisture || 0;
    this.nitrogen = data.nitrogen || 0;
    this.phosphorus = data.phosphorus || 0;
    this.potassium = data.potassium || 0;
    this.ph = data.ph || 0;
    
    console.log('📊 Updated values:', {
      temperature: this.temperature,
      moisture: this.moisture,
      nitrogen: this.nitrogen,
      phosphorus: this.phosphorus,
      potassium: this.potassium,
      ph: this.ph
    });
    
    // ✅ อัปเดตตำแหน่งอุปกรณ์บนแผนที่
    if (data.latitude && data.longitude) {
      this.updateDevicePosition(data);
      this.checkMeasurementProximity(data);
    }
    
    // ✅ อัปเดตสถานะ device
    if (this.deviceId) {
      this.checkDeviceStatus(this.deviceId);
    }
  }
  
  // ✅ อัปเดตตำแหน่งอุปกรณ์บนแผนที่
  updateDevicePosition(data: FirebaseLiveData) {
    if (!this.map) return;
    
    // สร้าง/อัปเดต marker ของอุปกรณ์
    if (this.deviceMarker) {
      this.deviceMarker.setLngLat([data.longitude!, data.latitude!]);
    } else {
      this.deviceMarker = new Marker({ color: 'red' })
        .setLngLat([data.longitude!, data.latitude!])
        .setPopup(new Popup().setHTML(`
          <div class="device-popup">
            <h3>อุปกรณ์: ${data.deviceId}</h3>
            <p>สถานะ: ${data.status}</p>
            <p>กำลังวัด: ${data.isMeasuring ? 'ใช่' : 'ไม่'}</p>
            <p>ตำแหน่ง: ${data.latitude?.toFixed(6)}, ${data.longitude?.toFixed(6)}</p>
          </div>
        `))
        .addTo(this.map!);
    }
  }
  
  // ✅ ตรวจสอบระยะใกล้จุดวัด
  checkMeasurementProximity(deviceData: FirebaseLiveData) {
    if (!deviceData.latitude || !deviceData.longitude) return;
    
    const deviceLat = deviceData.latitude;
    const deviceLng = deviceData.longitude;
    
    // ตรวจสอบแต่ละจุดที่ยังไม่ได้วัด
    for (let i = 0; i < this.measurementPoints.length; i++) {
      if (this.measuredPoints.includes(i)) continue; // ข้ามจุดที่วัดแล้ว
      
      const [pointLng, pointLat] = this.measurementPoints[i];
      const distance = this.calculateDistance(deviceLat, deviceLng, pointLat, pointLng);
      
      // ถ้าอยู่ในระยะ 2-3 เมตร
      if (distance <= 3) {
        this.triggerMeasurementPoint(i, distance);
        break;
      }
    }
  }
  
  // ✅ คำนวณระยะห่างระหว่างจุด
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // รัศมีโลก (เมตร)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // ระยะห่างในเมตร
  }
  
  // ✅ แจ้งเตือนเมื่อถึงจุดวัด
  async triggerMeasurementPoint(pointIndex: number, distance: number) {
    // ส่งสัญญาณไปยังอุปกรณ์ให้เปิด Buzzer
    await this.sendBuzzerCommand(pointIndex, distance);
    
    // แสดงการแจ้งเตือนบนหน้าจอ
    this.notificationService.showNotification(
      'info', 
      '🎯 ถึงจุดวัดแล้ว!', 
      `คุณอยู่ห่างจากจุดวัด ${pointIndex + 1} ประมาณ ${distance.toFixed(1)} เมตร\nกรุณาเสียบ Sensor และกดวัดค่าในอุปกรณ์`
    );
    
    // เปลี่ยนสีจุดวัดเป็นสีเหลือง (พร้อมวัด)
    this.updateMeasurementPointColor(pointIndex, 'yellow');
  }
  
  // ✅ ส่งคำสั่ง Buzzer ไปยังอุปกรณ์
  async sendBuzzerCommand(pointIndex: number, distance: number) {
    try {
      const command = {
        deviceId: this.deviceId,
        action: 'buzzer',
        pointIndex: pointIndex,
        distance: distance,
        timestamp: Date.now()
      };
      
      // ส่งคำสั่งไปยังอุปกรณ์ผ่าน Firebase
      const { set, ref } = await import('@angular/fire/database');
      await set(ref(this.database, `commands/${this.deviceId}`), command);
    } catch (error) {
      console.error('Error sending buzzer command:', error);
    }
  }
  
  // ✅ อัปเดตสีจุดวัด
  updateMeasurementPointColor(pointIndex: number, color: string) {
    if (this.measurementMarkers[pointIndex]) {
      this.measurementMarkers[pointIndex].setColor(color);
    }
  }
  
  // ✅ เริ่มการวัดเมื่ออุปกรณ์ส่งสัญญาณ
  async onDeviceStartMeasurement() {
    if (!this.currentUser) return;
    
    try {
      const token = await this.currentUser.getIdToken();
      const measurementStart = {
        deviceId: this.deviceId,
        action: 'start_measurement',
        pointIndex: this.currentPointIndex,
        timestamp: Date.now()
      };
      
      // ส่งไป Firebase
      const { set, ref } = await import('@angular/fire/database');
      await set(ref(this.database, `measurements/${this.deviceId}/current`), measurementStart);
      
      // แสดง loading
      this.isLoading = true;
    } catch (error) {
      console.error('Error starting measurement:', error);
    }
  }
  
  // ✅ บันทึกข้อมูลการวัดเมื่ออุปกรณ์ส่งมา
  async saveMeasurementData(deviceData: FirebaseLiveData) {
    if (!this.currentUser) return;
    
    // ตรวจสอบ currentAreaId
    if (!this.currentAreaId) {
      console.error('❌ No currentAreaId available for real device measurement');
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'ไม่พบ Area ID กรุณาสร้างพื้นที่ใหม่');
      return;
    }
    
    try {
      const token = await this.currentUser.getIdToken();
      // ✅ ใช้พิกัดจริงจาก measurementPoints (ที่ได้จาก MapTiler)
      const currentPoint = this.measurementPoints[this.currentPointIndex];
      
      // ✅ ดึงพิกัดจริงจาก MapTiler โดยตรง
      const realLng = currentPoint ? parseFloat(currentPoint[0].toFixed(8)) : (deviceData.longitude || 0);
      const realLat = currentPoint ? parseFloat(currentPoint[1].toFixed(8)) : (deviceData.latitude || 0);
      
      console.log('🗺️ MapTiler real coordinates for device measurement:', {
        currentPoint: currentPoint,
        original_lng: currentPoint ? currentPoint[0] : deviceData.longitude,
        original_lat: currentPoint ? currentPoint[1] : deviceData.latitude,
        real_lng: realLng,
        real_lat: realLat,
        precision: '8 decimal places',
        accuracy: '~0.00111 mm'
      });
      
      const measurementData: Measurement = {
        deviceId: deviceData.deviceId,
        temperature: deviceData.temperature,
        moisture: deviceData.moisture,
        nitrogen: deviceData.nitrogen,
        phosphorus: deviceData.phosphorus,
        potassium: deviceData.potassium,
        ph: deviceData.ph,
        lat: realLat, // ✅ พิกัดจริงจาก MapTiler (precision 8)
        lng: realLng, // ✅ พิกัดจริงจาก MapTiler (precision 8)
        date: new Date(deviceData.timestamp).toISOString(),
        areasid: this.currentAreaId || undefined,
        measurementPoint: this.currentPointIndex + 1,
        timestamp: deviceData.timestamp
      };
      
      console.log('🔍 Real device measurement data:', measurementData);
      console.log('🔍 Current areaId:', this.currentAreaId);
      console.log('🔍 Current measurement point:', currentPoint);
      console.log('🔍 Current measurement point index:', this.currentPointIndex);
      console.log('🔍 Measurement lat/lng:', {lat: measurementData.lat, lng: measurementData.lng});
      
      // บันทึกใน PostgreSQL
      await this.saveSingleMeasurement(token, measurementData);
      
      // แสดงการแจ้งเตือนเมื่อวัดจุดนี้เสร็จ
      const remainingCount = this.measurementPoints.length - (this.currentPointIndex + 1);
      const progressPercentage = Math.round(((this.currentPointIndex + 1) / this.measurementPoints.length) * 100);
      
      this.notificationService.showNotification(
        'success', 
        '✅ วัดเสร็จแล้ว!', 
        `จุดที่ ${this.currentPointIndex + 1} วัดเสร็จแล้ว\nAreas ID: ${this.currentAreaId}\n\n📊 ความคืบหน้า: ${progressPercentage}%\n✅ วัดแล้ว: ${this.currentPointIndex + 1}/${this.measurementPoints.length} จุด\n⏳ เหลืออีก: ${remainingCount} จุด`
      );
      
      // อัปเดต UI
      this.markPointAsMeasured(this.currentPointIndex);
      this.currentPointIndex++;
      
      // ตรวจสอบว่าวัดครบทุกจุดหรือไม่
      if (this.currentPointIndex >= this.measurementPoints.length) {
        this.showMeasurementComplete();
      }
    } catch (error) {
      console.error('Error saving measurement data:', error);
    }
  }
  
  // ✅ ทำเครื่องหมายจุดที่วัดแล้ว
  markPointAsMeasured(pointIndex: number) {
    this.measuredPoints.push(pointIndex);
    this.updateMeasurementPoints();
    
    // คำนวณความคืบหน้า
    const totalPoints = this.measurementPoints.length;
    const measuredCount = this.measuredPoints.length;
    const remainingCount = totalPoints - measuredCount;
    const progressPercentage = Math.round((measuredCount / totalPoints) * 100);
    
    // แสดงการแจ้งเตือนที่ปรับปรุงแล้ว
    this.notificationService.showNotification(
      'success', 
      '✅ วัดเสร็จแล้ว!', 
      `จุดวัดที่ ${pointIndex + 1} วัดเสร็จแล้ว\n\n📊 ความคืบหน้า: ${progressPercentage}%\n✅ วัดแล้ว: ${measuredCount}/${totalPoints} จุด\n⏳ เหลืออีก: ${remainingCount} จุด`
    );
  }
  
  // ✅ แสดงความคืบหน้าการวัด
  updateMeasurementPoints() {
    if (!this.map) return;
    
    // ลบ markers เดิม
    this.measurementMarkers.forEach(marker => marker.remove());
    this.measurementMarkers = [];
    
    // สร้าง markers ใหม่
    this.measurementPoints.forEach((point, index) => {
      const [lng, lat] = point;
      const isMeasured = this.measuredPoints.includes(index);
      const isCurrent = index === this.currentPointIndex;
      
      let color = 'blue'; // ยังไม่วัด
      if (isMeasured) color = 'green'; // วัดแล้ว
      if (isCurrent) color = 'yellow'; // จุดปัจจุบัน
      
      const marker = new Marker({ color })
        .setLngLat([lng, lat])
        .setPopup(new Popup().setHTML(`
          <div class="measurement-point-popup">
            <h3>จุดวัดที่ ${index + 1}</h3>
            <p>สถานะ: ${isMeasured ? 'วัดแล้ว' : 'ยังไม่วัด'}</p>
            ${isMeasured ? this.getMeasurementDataHTML(index) : ''}
          </div>
        `))
        .addTo(this.map!);
      
      this.measurementMarkers.push(marker);
    });
  }
  
  // ✅ สร้าง HTML สำหรับข้อมูลการวัด
  getMeasurementDataHTML(pointIndex: number): string {
    // ใช้ข้อมูลจาก measurements array
    const measurement = this.measurements.find(m => m.measurementPoint === pointIndex + 1);
    if (!measurement) return '';
    
    return `
      <div class="measurement-data">
        <p>🌡️ อุณหภูมิ: ${measurement.temperature}°C</p>
        <p>💧 ความชื้น: ${measurement.moisture}%</p>
        <p>🌱 ไนโตรเจน: ${measurement.nitrogen} ppm</p>
        <p>🌿 ฟอสฟอรัส: ${measurement.phosphorus} ppm</p>
        <p>🍃 โพแทสเซียม: ${measurement.potassium} ppm</p>
        <p>⚗️ pH: ${measurement.ph}</p>
      </div>
    `;
  }
  
  // ✅ แสดงการวัดเสร็จสิ้น
  showMeasurementComplete() {
    this.isLoading = false;
    
    // คำนวณสถิติสุดท้าย
    const totalPoints = this.measurementPoints.length;
    const measuredCount = this.measuredPoints.length;
    const successRate = Math.round((measuredCount / totalPoints) * 100);
    
    this.notificationService.showNotification(
      'success', 
      '🎉 วัดเสร็จสิ้น!', 
      `การวัดทุกจุดเสร็จสิ้นแล้ว!\n\n📊 สถิติสุดท้าย:\n✅ วัดสำเร็จ: ${measuredCount}/${totalPoints} จุด\n📈 อัตราความสำเร็จ: ${successRate}%\n\nกำลังนำคุณไปหน้า History...`
    );
    
    setTimeout(() => {
      this.router.navigate(['/history']);
    }, 3000);
  }
  
  async loadMeasurements(deviceId: string) {
    try {
      const response = await lastValueFrom(
        this.http.get<Measurement[]>(
          `${this.apiUrl}/api/measurements?deviceId=${deviceId}`
        )
      );
      this.measurements = response || [];
      this.measurementCount = this.measurements.length;
      await this.initializeMap();
    } catch (error) {
      console.error('Error loading measurements:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
  }
  async saveMeasurement() {
    if (this.isLoading) return;
    
    // ตรวจสอบ device status
    if (!this.deviceId) {
      this.notificationService.showNotification('error', 'ไม่พบอุปกรณ์', 'กรุณาเลือกอุปกรณ์ก่อนบันทึกข้อมูล');
      return;
    }
    
    // ตรวจสอบ live data
    if (!this.liveData) {
      this.notificationService.showNotification('error', 'ไม่พบข้อมูลเซ็นเซอร์', 'ไม่พบข้อมูลการวัดจากเซ็นเซอร์ กรุณาตรวจสอบการเชื่อมต่อ');
      return;
    }
    
    if (!this.currentUser) {
      console.error('❌ No current user found');
      this.notificationService.showNotification('error', 'ไม่พบข้อมูลผู้ใช้', 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      return;
    }
    
    this.isLoading = true;
    
    try {
      const token = await this.currentUser.getIdToken();
      if (!token) {
        console.error('❌ Failed to get Firebase token');
        this.notificationService.showNotification('error', 'ไม่สามารถรับ Token', 'ไม่สามารถรับ Token จาก Firebase กรุณาเข้าสู่ระบบใหม่');
        return;
      }
      
      // ✅ แสดงข้อความรอการวัด
      this.notificationService.showNotification(
        'info', 
        'กำลังวัดค่า', 
        'กำลังรอให้ค่าคงที่ 2-3 วินาที...'
      );
      
      // ✅ รอให้ค่าคงที่ 2-3 วินาที
      await this.waitForStableValues();
      
      // ✅ บันทึกค่าจาก Firebase live ลง PostgreSQL
      await this.saveCurrentLiveDataToPostgreSQL(token);
      
    } catch (error: any) {
      console.error('❌ Error saving measurement:', error);
      console.error('❌ Error details:', {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        error: error.error
      });
      
      if (error.status === 400) {
        console.error('❌ Bad Request - Validation Error:', error.error);
        this.notificationService.showNotification('error', 'ข้อมูลไม่ถูกต้อง', `ข้อมูลไม่ถูกต้อง: ${error.error?.message || 'กรุณาตรวจสอบข้อมูลที่กรอก'}`);
      } else if (error.status === 401) {
        console.error('❌ Unauthorized - Token Error:', error.error);
        this.notificationService.showNotification('error', 'ไม่ได้รับอนุญาต', 'กรุณาเข้าสู่ระบบใหม่');
      } else if (error.status === 404) {
        console.error('❌ Not Found - API Endpoint Error:', error.error);
        this.notificationService.showNotification('error', 'ไม่พบ API', 'ไม่พบ API endpoint กรุณาตรวจสอบการตั้งค่า');
      } else if (error.status === 500) {
        console.error('❌ Server Error:', error.error);
        this.notificationService.showNotification('error', 'ข้อผิดพลาดเซิร์ฟเวอร์', 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');
      } else {
        console.error('❌ Unknown Error:', error);
        this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', `เกิดข้อผิดพลาดในการบันทึก: ${error.message || 'กรุณาลองใหม่อีกครั้ง'}`);
      }
    } finally {
      this.isLoading = false;
    }
  }
  
  // ✅ เลือกจุดในแผนที่แบบง่ายๆ
  selectPoint(pointIndex: number) {
    if (pointIndex < 0 || pointIndex >= this.measurementPoints.length) {
      return;
    }
    
    this.selectedPointIndex = pointIndex;
    console.log(`📍 Selected point ${pointIndex + 1}:`, this.measurementPoints[pointIndex]);
    
    // ✅ อัปเดตสีของ marker ทั้งหมด
    this.updateMarkerColors();
  }
  
  // ✅ โหลดข้อมูลการวัดที่เสร็จแล้วจากฐานข้อมูล
  private async loadCompletedMeasurements() {
    if (!this.currentAreaId || !this.deviceId) {
      console.log('⚠️ No areaId or deviceId available for loading measurements');
      return;
    }
    
    try {
      const token = await this.auth.currentUser?.getIdToken();
      if (!token) {
        console.log('⚠️ No token available for loading measurements');
        return;
      }
      
      // ✅ ดึงข้อมูลการวัดจากฐานข้อมูล
      const response = await lastValueFrom(
        this.http.get<any[]>(`${this.apiUrl}/api/measurements?areaid=${this.currentAreaId}&deviceid=${this.deviceId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );
      
      if (response && Array.isArray(response)) {
        console.log('📊 Loaded measurements from database:', response.length);
        
        // ✅ ตรวจสอบว่าจุดไหนวัดแล้วโดยเปรียบเทียบพิกัด
        const measuredIndices: number[] = [];
        
        for (let i = 0; i < this.measurementPoints.length; i++) {
          const [pointLng, pointLat] = this.measurementPoints[i];
          
          // ✅ หาการวัดที่มีพิกัดใกล้เคียงกับจุดนี้
          const matchingMeasurement = response.find(measurement => {
            const measurementLat = parseFloat(measurement.lat);
            const measurementLng = parseFloat(measurement.lng);
            
            // ✅ เปรียบเทียบพิกัด (ใช้ tolerance 0.0001)
            const latDiff = Math.abs(pointLat - measurementLat);
            const lngDiff = Math.abs(pointLng - measurementLng);
            
            return latDiff < 0.0001 && lngDiff < 0.0001;
          });
          
          if (matchingMeasurement) {
            measuredIndices.push(i);
            console.log(`✅ Point ${i + 1} has been measured (${matchingMeasurement.lat}, ${matchingMeasurement.lng})`);
          }
        }
        
        // ✅ อัปเดต measuredPoints
        this.measuredPoints = measuredIndices;
        console.log('✅ Updated measuredPoints:', this.measuredPoints);
      }
    } catch (error) {
      console.error('❌ Error loading completed measurements:', error);
    }
  }
  
  // ✅ อัปเดตสีของ marker ทั้งหมด
  private updateMarkerColors() {
    if (!this.map) return;
    
    console.log('🎨 Updating marker colors...');
    console.log('📍 Selected point index:', this.selectedPointIndex);
    console.log('✅ Measured points:', this.measuredPoints);
    
    // ✅ หา markers ทั้งหมดและอัปเดตสี
    const markers = this.map.getContainer().querySelectorAll('.maplibregl-marker');
    console.log('🔍 Found markers:', markers.length);
    
    markers.forEach((markerElement: any, index: number) => {
      if (index < this.measurementPoints.length) {
        const isMeasured = this.measuredPoints.includes(index);
        const isSelected = this.selectedPointIndex === index;
        
        // ✅ เลือกสีตามสถานะ
        let color = '#6c757d'; // เทา - ปกติ
        if (isSelected) {
          color = '#dc3545'; // แดง - เลือกอยู่
        } else if (isMeasured) {
          color = '#28a745'; // เขียว - วัดแล้ว
        }
        
        console.log(`🎨 Marker ${index + 1}: selected=${isSelected}, measured=${isMeasured}, color=${color}`);
        
        // ✅ อัปเดตสีของ marker
        const markerIcon = markerElement.querySelector('svg');
        if (markerIcon) {
          markerIcon.style.fill = color;
          console.log(`✅ Updated marker ${index + 1} color to ${color}`);
        } else {
          console.log(`❌ No SVG found for marker ${index + 1}`);
        }
      }
    });
  }
  
  // ✅ วัดค่าจุดที่เลือก
  async measureSelectedPoint() {
    if (this.selectedPointIndex === null) {
      this.notificationService.showNotification('warning', 'กรุณาเลือกจุด', 'กรุณาคลิกเลือกจุดในแผนที่ก่อน');
      return;
    }
    
    if (this.measuredPoints.includes(this.selectedPointIndex)) {
      this.notificationService.showNotification('info', 'จุดนี้วัดแล้ว', 'จุดนี้ได้รับการวัดแล้ว');
      return;
    }
    
    try {
      this.isLoading = true;
      this.currentMeasuringPoint = this.selectedPointIndex;
      
      const token = await this.auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('No authentication token');
      }
      
      console.log(`🎯 Measuring selected point ${this.selectedPointIndex + 1}`);
      
      // ✅ รอให้ค่าคงที่ 2-3 วินาที
      await this.waitForStableValues();
      
      // ✅ บันทึกค่าจาก Firebase live ลง PostgreSQL
      await this.saveCurrentLiveDataToPostgreSQL(token);
      
      // ✅ เพิ่มจุดนี้ในรายการที่วัดแล้ว
      this.measuredPoints.push(this.selectedPointIndex);
      
      // ✅ อัปเดตสีของ marker ทั้งหมด
      this.updateMarkerColors();
      
      // ✅ แสดงข้อความสำเร็จ
      const [lng, lat] = this.measurementPoints[this.selectedPointIndex];
      this.notificationService.showNotification(
        'success',
        'วัดจุดสำเร็จ',
        `จุดที่ ${this.selectedPointIndex + 1} วัดเสร็จแล้ว\nพิกัด: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
      );
      
      // ✅ เลือกจุดถัดไป (ถ้ามี)
      this.selectNextAvailablePoint();
      
    } catch (error: any) {
      console.error('❌ Error measuring selected point:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการวัดจุด กรุณาลองใหม่อีกครั้ง');
    } finally {
      this.isLoading = false;
      this.currentMeasuringPoint = null;
    }
  }
  
  // ✅ เลือกจุดถัดไปที่ยังไม่ได้วัด
  private selectNextAvailablePoint() {
    for (let i = 0; i < this.measurementPoints.length; i++) {
      if (!this.measuredPoints.includes(i)) {
        this.selectPoint(i);
        return;
      }
    }
    
    // ✅ ถ้าวัดครบทุกจุดแล้ว
    if (this.measuredPoints.length === this.measurementPoints.length) {
      this.notificationService.showNotification(
        'success',
        'วัดครบทุกจุดแล้ว',
        `วัดครบทุกจุดแล้ว (${this.measurementPoints.length} จุด) - กำลังไปที่หน้า History...`
      );
      this.selectedPointIndex = null;
      
      // ✅ นำทางไปหน้า history หลังจาก 2 วินาที
      setTimeout(() => {
        this.router.navigate(['/users/history']);
      }, 2000);
    }
  }
  
  
  // ✅ รอให้ค่าคงที่ 2-3 วินาที
  private async waitForStableValues(): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const waitTime = 3000; // 3 วินาที
      
      this.isWaitingForStable = true;
      this.countdownSeconds = 3;
      
      console.log('⏳ Waiting for stable values...');
      
      // ✅ แสดงข้อความนับถอยหลัง
      const countdownInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, waitTime - elapsed);
        const seconds = Math.ceil(remaining / 1000);
        
        this.countdownSeconds = seconds;
        
        if (seconds > 0) {
          console.log(`⏳ Waiting... ${seconds} seconds remaining`);
        }
      }, 1000);
      
      // ✅ รอ 3 วินาที
      setTimeout(() => {
        clearInterval(countdownInterval);
        this.isWaitingForStable = false;
        this.countdownSeconds = 0;
        console.log('✅ Values should be stable now');
        resolve();
      }, waitTime);
    });
  }
  
  // ✅ บันทึกค่าจาก Firebase live ลง PostgreSQL
  private async saveCurrentLiveDataToPostgreSQL(token: string): Promise<void> {
    // ✅ 1) guard ข้อมูลอ้างอิง
    if (this.selectedPointIndex == null || this.selectedPointIndex < 0) {
      throw new Error('No point selected for measurement');
    }
    if (!this.currentAreaId) {
      throw new Error('No area ID available');
    }
    if (!this.measurementPoints || !this.measurementPoints[this.selectedPointIndex]) {
      throw new Error('No coordinates for selected point');
    }
    if (!this.liveData) {
      throw new Error('No live data available');
    }

    // ✅ 2) ดึงพิกัดจากจุดที่เลือก (GeoJSON-like: [lng, lat])
    const [lngRaw, latRaw] = this.measurementPoints[this.selectedPointIndex];

    // ✅ 3) จำกัดความละเอียด และแปลงเป็น string เพื่อเข้ากับคอลัมน์ TEXT ใน Postgres
    const lat = this.limitPrecision(Number(latRaw), 8);
    const lng = this.limitPrecision(Number(lngRaw), 8);
    const latText = String(lat);
    const lngText = String(lng);

    // ✅ 4) สร้าง payload ครบถ้วน
    const measurementData = {
      deviceid: parseInt(this.deviceId || '0', 10),
      areaid: parseInt(String(this.currentAreaId), 10),   // FK -> areas.areasid
      point_id: this.selectedPointIndex + 1,              // 1-based index
      lat: latText,                                       // TEXT
      lng: lngText,                                       // TEXT
      temperature: this.limitPrecision(this.liveData?.temperature ?? 0, 2),
      moisture: this.limitPrecision(this.liveData?.moisture ?? 0, 2),
      nitrogen:  this.limitPrecision(this.liveData?.nitrogen ?? 0, 2),
      phosphorus:this.limitPrecision(this.liveData?.phosphorus ?? 0, 2),
      potassium: this.limitPrecision(this.liveData?.potassium ?? 0, 2),
      ph:        this.limitPrecision(this.liveData?.ph ?? 7.0, 2),
      measured_at: new Date().toISOString(),              // ใช้ชื่อกลาง ๆ ให้ backend map เป็น measurement_date/time
    };

    console.log('📊 Measurement data to save:', measurementData);
    console.log('🔗 API URL:', `${this.apiUrl}/api/firebase-measurements/save-current-live`);
    console.log('🔑 Token:', token ? 'Present' : 'Missing');

    // ✅ 5) ส่งเข้า API
    const response = await lastValueFrom(
      this.http.post(`${this.apiUrl}/api/firebase-measurements/save-current-live`, measurementData, {
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      })
    );

    console.log('✅ Live data saved to PostgreSQL:', response);

    // ✅ 6) แจ้งเตือนแบบมีบริบทจุดวัด
    this.notificationService.showNotification(
      'success',
      'บันทึกข้อมูลสำเร็จ',
      `บันทึกค่าจาก ESP32 สำเร็จ!
📍 จุดที่ ${this.selectedPointIndex + 1} (Area: ${this.currentAreaId})
🌍 พิกัด: ${lat.toFixed(6)}, ${lng.toFixed(6)}
🌡️ Temp: ${measurementData.temperature}°C | 💧 Moist: ${measurementData.moisture}%
🧪 pH: ${measurementData.ph}
📊 N:${measurementData.nitrogen} P:${measurementData.phosphorus} K:${measurementData.potassium}`
    );

    console.log('📊 Measurement data saved:', measurementData);
  }
  
  // ✅ วัดทีละจุดและบันทึกเข้าสู่ PostgreSQL (รอค่าจาก Firebase/ESP32)
  async measureAllPoints(token: string) {
    let successCount = 0;
    let errorCount = 0;
    // แสดง loading state
    this.isLoading = true;
    
    // แสดงการแจ้งเตือนเริ่มต้น
    this.notificationService.showNotification(
      'info', 
      '🚀 เริ่มการวัด', 
      `เริ่มวัด ${this.measurementPoints.length} จุด\nกรุณารอสักครู่...`
    );
    
    try {
      // ตรวจสอบ currentAreaId
      console.log('🔍 Current areaId before measurement:', this.currentAreaId);
      if (!this.currentAreaId) {
        console.error('❌ No currentAreaId available for measurement');
        this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'ไม่พบ Area ID กรุณาสร้างพื้นที่ใหม่');
        return;
      }
      
      // วัดทีละจุด
      for (let i = 0; i < this.measurementPoints.length; i++) {
        const [targetLng, targetLat] = this.measurementPoints[i];
        
        console.log(`📍 Target point ${i + 1}:`, { targetLat, targetLng });
        
        // ✅ รอค่าจาก Firebase/ESP32
        this.notificationService.showNotification(
          'info', 
          '⏳ รอข้อมูลจาก ESP32...', 
          `กำลังรอข้อมูลการวัดจุดที่ ${i + 1}/${this.measurementPoints.length}\nกรุณารอ ESP32 ทำการวัด...`
        );
        
        // รอให้ ESP32 วัดและส่งข้อมูลมา (ตรวจสอบว่า finished = true)
        const measurementFromESP32 = await this.waitForESP32Measurement(i + 1);
        
        if (!measurementFromESP32) {
          console.error(`❌ Timeout waiting for ESP32 measurement at point ${i + 1}`);
          errorCount++;
          
          this.notificationService.showNotification(
            'error',
            '⏱️ หมดเวลารอ',
            `ไม่ได้รับข้อมูลจาก ESP32 สำหรับจุดที่ ${i + 1}\nกรุณาตรวจสอบการเชื่อมต่อ`
          );
          
          continue; // ข้ามไปจุดถัดไป
        }
        
        console.log(`✅ Received measurement from ESP32 for point ${i + 1}:`, measurementFromESP32);
        
        // ✅ ใช้พิกัด GPS จริงจาก ESP32 (ไม่ใช่จาก MapTiler)
        const gpsLat = measurementFromESP32.lat || measurementFromESP32.latitude || targetLat;
        const gpsLng = measurementFromESP32.lng || measurementFromESP32.longitude || targetLng;
        
        console.log(`🛰️ GPS from ESP32 for point ${i + 1}:`, {
          gpsLat,
          gpsLng,
          targetLat,
          targetLng,
          source: 'ESP32 GPS Module'
        });
        
        // สร้างข้อมูล measurement สำหรับจุดนี้ - ใช้ค่าจาก ESP32
        const measurementData = {
          deviceId: this.deviceId,
          temperature: this.limitPrecision(measurementFromESP32.temperature || 0, 2),
          moisture: this.limitPrecision(measurementFromESP32.moisture || 0, 2),
          nitrogen: this.limitPrecision(measurementFromESP32.nitrogen || 0, 2),
          phosphorus: this.limitPrecision(measurementFromESP32.phosphorus || 0, 2),
          potassium: this.limitPrecision(measurementFromESP32.potassium || 0, 2),
          ph: this.limitPrecision(measurementFromESP32.ph || 7.0, 2),
          lat: this.limitPrecision(gpsLat, 8), // ✅ ใช้ GPS จาก ESP32 (precision 8)
          lng: this.limitPrecision(gpsLng, 8), // ✅ ใช้ GPS จาก ESP32 (precision 8)
          measurementPoint: i + 1,
          areaId: this.currentAreaId
        };
        
        console.log(`📊 Measurement data for point ${i + 1}:`, measurementData);
        
        try {
          // บันทึก measurement ไปยัง PostgreSQL
          const response = await lastValueFrom(
            this.http.post(`${this.apiUrl}/api/measurements`, measurementData, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })
          );
          successCount++;
          
          // อัปเดต UI
          this.measurementCount++;
          
          // แสดงการแจ้งเตือนเมื่อวัดจุดนี้เสร็จ
          const remainingCount = this.measurementPoints.length - (i + 1);
          const progressPercentage = Math.round(((i + 1) / this.measurementPoints.length) * 100);
          
          this.notificationService.showNotification(
            'success', 
            '✅ วัดเสร็จแล้ว!', 
            `จุดที่ ${i + 1} วัดเสร็จแล้ว\n\n📊 ความคืบหน้า: ${progressPercentage}%\n✅ วัดแล้ว: ${i + 1}/${this.measurementPoints.length} จุด\n⏳ เหลืออีก: ${remainingCount} จุด`
          );
          
          // อัปเดตจุดที่วัดแล้ว
          this.markPointAsMeasured(i);
          
          // ✅ แสดงตำแหน่ง ESP32 บนแผนที่
          this.addESP32MarkerToMap(gpsLat, gpsLng, i + 1, measurementFromESP32);
          
        } catch (pointError: any) {
          console.error(`❌ Error measuring point ${i + 1}:`, pointError);
          errorCount++;
          
          // แสดงการแจ้งเตือนข้อผิดพลาด
          this.notificationService.showNotification(
            'error', 
            '❌ วัดไม่สำเร็จ', 
            `จุดที่ ${i + 1} วัดไม่สำเร็จ\n${pointError.error?.message || 'เกิดข้อผิดพลาดในการบันทึก'}`
          );
        }
        
        // รอสักครู่ระหว่างการวัดแต่ละจุด (ยกเว้นจุดสุดท้าย)
        if (i < this.measurementPoints.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // แสดงผลลัพธ์สุดท้าย
      if (successCount > 0) {
        this.notificationService.showNotification(
          'success', 
          '🎉 วัดเสร็จสิ้น!', 
          `การวัดเสร็จสิ้นแล้ว!\n\n✅ วัดสำเร็จ: ${successCount} จุด\n${errorCount > 0 ? `❌ ล้มเหลว: ${errorCount} จุด\n` : ''}📊 อัตราความสำเร็จ: ${Math.round((successCount / this.measurementPoints.length) * 100)}%\n\nกำลังนำคุณไปหน้า History...`
        );
        
        // เด้งไปหน้า history หลังจาก 3 วินาที
        setTimeout(() => {
          this.router.navigate(['/users/history']);
        }, 3000);
      } else {
        this.notificationService.showNotification('error', 'วัดไม่สำเร็จ', 'ไม่สามารถวัดจุดใดได้ กรุณาลองใหม่');
      }
    } catch (error: any) {
      console.error('❌ Error in measureAllPoints:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการวัด กรุณาลองใหม่');
    } finally {
      this.isLoading = false;
    }
  }
  // ✅ บันทึก measurement เดียว
  async saveSingleMeasurement(token: string, newMeasurement: Measurement) {
    // ✅ แปลง areasid เป็น areaId สำหรับ API
    const measurementData = {
      ...newMeasurement,
      areaId: newMeasurement.areasid, // ✅ ใช้ areaId แทน areasid
      areasid: undefined // ✅ ลบ areasid ออก
    };
    
    const response = await lastValueFrom(
      this.http.post(`${this.apiUrl}/api/measurements`, measurementData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
    );
    // อัปเดต UI
    this.measurements.push(newMeasurement);
    this.measurementCount++;
    await this.updateAreaStatistics();
    await this.initializeMap();
    this.notificationService.showNotification('success', 'บันทึกสำเร็จ', 'บันทึกข้อมูลการวัดเรียบร้อยแล้ว');
  }
  // ✅ สร้าง area พร้อม measurements
  async saveAreaMeasurement(token: string) {
    const areaData = {
      area_name: this.locationDetail || `พื้นที่วัด ${new Date().toLocaleDateString('th-TH')}`,
      deviceId: this.deviceId, // ✅ เพิ่ม deviceId
      measurements: this.selectedPoints.map((point, index) => ({
        lat: this.roundLatLng(point[1], 6),
        lng: this.roundLatLng(point[0], 6),
        temperature: this.limitPrecision(this.liveData?.temperature || 0, 2),
        moisture: this.limitPrecision(this.liveData?.moisture || 0, 2),
        nitrogen: this.limitPrecision(this.liveData?.nitrogen || 0, 2),
        phosphorus: this.limitPrecision(this.liveData?.phosphorus || 0, 2),
        potassium: this.limitPrecision(this.liveData?.potassium || 0, 2),
        ph: this.limitPrecision(this.liveData?.ph || 7.0, 2)
      }))
    };
    const response = await lastValueFrom(
      this.http.post(`${this.apiUrl}/api/measurements/create-area`, areaData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
    );
    // อัปเดต UI
    this.measurementCount += this.selectedPoints.length;
    await this.initializeMap();
    this.notificationService.showNotification(
      'success', 
      'สร้างพื้นที่สำเร็จ', 
      `สร้างพื้นที่ "${areaData.area_name}" พร้อม ${this.selectedPoints.length} จุดวัดเรียบร้อยแล้ว`
    );
  }
  async createArea() {
    if (!this.areaName) {
      this.notificationService.showNotification('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อพื้นที่');
      return;
    }
    const newArea: Area = {
      id: Date.now().toString(),
      name: this.areaName,
      deviceId: this.deviceId || '',
      username: '', // ลบ username ออก - ให้ AuthInterceptor จัดการ Firebase ID token
      polygonBounds: this.getPolygonBounds() || [],
      createdDate: new Date().toISOString(),
      createdTimestamp: Date.now(),
      totalMeasurements: 0,
    };
    try {
      await lastValueFrom(this.http.post(`${this.apiUrl}/api/areas`, newArea));
      this.currentAreaId = newArea.id;
      this.currentArea = newArea;
      this.areaName = '';
      await this.initializeMap();
    } catch (error) {
      console.error('Error creating area:', error);
      this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการสร้างพื้นที่');
    }
  }
  private getPolygonBounds(): [number, number][] {
    // ต้องอัปเดตจาก map interaction (สมมติใช้พิกัดจากจุดวัดที่มี)
    return this.measurements.length > 0
      ? this.measurements.map((m) => [m.lng, m.lat] as [number, number])
      : [];
  }
  async updateAreaStatistics() {
    if (!this.currentAreaId || this.measurements.length === 0) return;
    try {
      const totals = this.measurements.reduce(
        (acc, m) => ({
          temperature: acc.temperature + (m.temperature || 0),
          moisture: acc.moisture + (m.moisture || 0),
          nitrogen: acc.nitrogen + (m.nitrogen || 0),
          phosphorus: acc.phosphorus + (m.phosphorus || 0),
          potassium: acc.potassium + (m.potassium || 0),
          ph: acc.ph + (m.ph || 0),
        }),
        {
          temperature: 0,
          moisture: 0,
          nitrogen: 0,
          phosphorus: 0,
          potassium: 0,
          ph: 0,
        }
      );
      const count = this.measurements.length;
      const averages = {
        temperature: parseFloat((totals.temperature / count).toFixed(2)),
        moisture: parseFloat((totals.moisture / count).toFixed(2)),
        nitrogen: parseFloat((totals.nitrogen / count).toFixed(2)),
        phosphorus: parseFloat((totals.phosphorus / count).toFixed(2)),
        potassium: parseFloat((totals.potassium / count).toFixed(2)),
        ph: parseFloat((totals.ph / count).toFixed(2)),
      };
      await lastValueFrom(
        this.http.put(`${this.apiUrl}/api/areas/${this.currentAreaId}`, {
          totalMeasurements: count,
          averages,
          lastUpdated: Date.now(),
        })
      );
      if (this.currentArea) {
        this.currentArea.totalMeasurements = count;
        this.currentArea.averages = averages;
      }
    } catch (error) {
      console.error('Error updating area statistics:', error);
    }
  }
  showAreaStatistics() {
    if (!this.currentArea || !this.currentArea.averages) {
      this.notificationService.showNotification('info', 'ไม่มีข้อมูลสถิติ', 'ยังไม่มีข้อมูลสถิติของพื้นที่นี้');
      return;
    }
    const s = this.currentArea.averages;
    const statsMessage = `สถิติพื้นที่: ${this.currentArea.name}
จำนวนจุดวัด: ${this.currentArea.totalMeasurements} จุด
ค่าเฉลี่ย:
• อุณหภูมิ: ${s.temperature}°C
• ความชื้น: ${s.moisture}%
• ไนโตรเจน: ${s.nitrogen} mg/kg
• ฟอสฟอรัส: ${s.phosphorus} mg/kg
• โพแทสเซียม: ${s.potassium} mg/kg
• ค่า pH: ${s.ph}`;
    this.notificationService.showNotification('info', 'สถิติพื้นที่', statsMessage);
  }
  async startNewArea() {
    if (this.measurementCount > 0) {
      const confirmReset = window.confirm(
        `คุณมีข้อมูลการวัด ${this.measurementCount} จุดในพื้นที่ "${this.areaName}"\nต้องการเริ่มพื้นที่ใหม่หรือไม่?`
      );
      if (!confirmReset) return;
    }
    await this.reopenPopup();
  }
  private async reopenPopup() {
    this.currentAreaId = null;
    this.currentArea = null;
    this.measurements = [];
    this.measurementCount = 0;
    this.areaName = '';
    this.customLocationName = '';
    await this.initializeMap();
  }
  closePopup() { 
    this.showPopup = false; 
    this.isSelectingArea = false;
    this.selectedPoints = [];
    this.measurementPoints = [];
    this.showMeasurementPoints = false;
    this.clearMarks();
  }
  stopPropagation(event: Event) { event.stopPropagation(); }
  // ✅ เริ่มการเลือกพื้นที่
  startAreaSelection() {
    this.isSelectingArea = true;
    this.selectedPoints = [];
    this.points = [];
    this.clearMarks();
    this.initializePopupMap();
  }
  // ✅ เริ่มต้นแผนที่เมื่อ popup แสดง
  onPopupShow() {
    setTimeout(() => {
      this.initializePopupMap();
    }, 100);
  }
  // ✅ อัปเดต polygon
  updatePolygon() {
    if (!this.map || this.selectedPoints.length < 3) {
      // ลบ polygon ถ้ามีจุดน้อยกว่า 3 จุด
      if (this.map && this.currentPolygon) {
        this.map.removeLayer('polygon-layer');
        this.map.removeLayer('polygon-outline');
        this.map.removeSource('polygon-source');
        this.currentPolygon = null;
      }
      return;
    }
    // ลบ polygon เดิม
    if (this.currentPolygon) {
      this.map.removeLayer('polygon-layer');
      this.map.removeLayer('polygon-outline');
      this.map.removeSource('polygon-source');
    }
    // สร้าง polygon ใหม่
    this.map.addSource('polygon-source', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [this.selectedPoints]
        }
      }
    });
    // ✅ เพิ่ม polygon fill (พื้นหลัง)
    this.map.addLayer({
      id: 'polygon-layer',
      type: 'fill',
      source: 'polygon-source',
      paint: {
        'fill-color': '#00aaff',
        'fill-opacity': 0.2 // ลดความโปร่งใสให้เห็นชัดขึ้น
      }
    });
    // ✅ เพิ่ม polygon outline (กรอบ)
    this.map.addLayer({
      id: 'polygon-outline',
      type: 'line',
      source: 'polygon-source',
      paint: {
        'line-color': '#00aaff',
        'line-width': 3, // เพิ่มความหนาของเส้น
        'line-dasharray': [2, 2] // เส้นประ
      }
    });
    this.currentPolygon = true;
  }
  // ✅ เคลียร์จุดทั้งหมด
  clearMarks() {
    this.selectedPoints = [];
    this.points = [];
    if (this.map) {
      // ลบ markers
      const markers = document.querySelectorAll('.maplibregl-marker');
      markers.forEach(marker => marker.remove());
      // ลบ polygon
      if (this.currentPolygon) {
        this.map.removeLayer('polygon-layer');
        this.map.removeLayer('polygon-outline');
        this.map.removeSource('polygon-source');
        this.currentPolygon = null;
      }
    }
  }
  // ✅ ยืนยันพื้นที่
  async confirmArea() {
    if (this.selectedPoints.length < 3) {
      this.notificationService.showNotification('error', 'ข้อมูลไม่เพียงพอ', 'กรุณาเลือกอย่างน้อย 3 จุดเพื่อสร้างพื้นที่');
      return;
    }
    // ✅ สร้างจุดที่ต้องวัดภายในพื้นที่
    this.generateMeasurementPoints();
    console.log('🎯 After generateMeasurementPoints:', {
      measurementPointsLength: this.measurementPoints.length,
      showMeasurementPoints: this.showMeasurementPoints
    });
    
    // ✅ สร้างข้อมูลใน table areas ทันที
    await this.createAreaImmediately();
    this.showPopup = false;
    this.isSelectingArea = false;
    this.showMeasurementPoints = true;
    
    console.log('🎯 After setting showMeasurementPoints:', {
      showMeasurementPoints: this.showMeasurementPoints,
      measurementPointsLength: this.measurementPoints.length
    });
    
    // ✅ แสดงแผนที่หลักและจุดวัด
    this.showMainMap = true;
    setTimeout(async () => {
      await this.initializeMap();
      // ✅ โหลดข้อมูลการวัดที่เสร็จแล้ว
      await this.loadCompletedMeasurements();
      // ✅ อัปเดตสีของ markers
      setTimeout(() => {
        this.updateMarkerColors();
      }, 500);
      console.log('🎯 Measurement points already created in initializeMap');
    }, 100);
    // คำนวณพื้นที่
    const area = this.calculateSimpleArea(this.selectedPoints);
    const areaFormatted = this.formatAreaToThaiUnits(area);
    this.locationDetail = `พื้นที่ที่เลือก: ${areaFormatted} (${this.selectedPoints.length} จุด) - จุดวัด: ${this.measurementPoints.length} จุด`;
    // แสดงขนาดพื้นที่ที่แม่นยำ
  }
  // ✅ สร้างข้อมูลใน table areas ทันทีเมื่อยืนยันพื้นที่
  async createAreaImmediately() {
    if (!this.currentUser || !this.deviceId) {
      console.error('❌ No current user or device ID for area creation');
      return;
    }
    
    try {
      // ✅ Get fresh token from Firebase
      const token = await this.currentUser.getIdToken(true); // force refresh
      
      console.log('🔑 Firebase token obtained:', {
        tokenLength: token?.length || 0,
        tokenStart: token?.substring(0, 20) + '...',
        userId: this.currentUser.uid,
        email: this.currentUser.email
      });
      
      // คำนวณพื้นที่
      const area = this.calculateSimpleArea(this.selectedPoints);
      const areaFormatted = this.formatAreaToThaiUnits(area);
      
      console.log('📍 Creating area:', {
        area_name: `พื้นที่วัด ${new Date().toLocaleDateString('th-TH')} - ${areaFormatted}`,
        description: `พื้นที่ ${areaFormatted} สร้างโดย ${this.userName} - Device: ${this.deviceId}`,
        apiUrl: this.apiUrl
      });
      
      // ✅ สร้าง area โดยไม่ต้องมี measurementId
      console.log('🚀 Sending POST request to:', `${this.apiUrl}/api/areas`);
      console.log('📦 Request payload:', {
        area_name: `พื้นที่วัด ${new Date().toLocaleDateString('th-TH')} - ${areaFormatted}`,
        description: `พื้นที่ ${areaFormatted} สร้างโดย ${this.userName} - Device: ${this.deviceId}`
      });
      console.log('🔐 Request headers:', {
        'Authorization': `Bearer ${token.substring(0, 20)}...`,
        'Content-Type': 'application/json'
      });
      
      const response: any = await lastValueFrom(
        this.http.post(`${this.apiUrl}/api/areas`, {
          area_name: `พื้นที่วัด ${new Date().toLocaleDateString('th-TH')} - ${areaFormatted}`,
          description: `พื้นที่ ${areaFormatted} สร้างโดย ${this.userName} - Device: ${this.deviceId}`
        }, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      );
      
      console.log('✅ API response received:', response);
      
      // เก็บ area ID
      if (response && response.area && response.area.area_id) {
        this.currentAreaId = response.area.area_id;
        console.log('✅ Area created with ID:', this.currentAreaId);
        
        this.notificationService.showNotification(
          'success', 
          'สร้างพื้นที่สำเร็จ', 
          `สร้างพื้นที่ "${response.area.area_name}" เรียบร้อยแล้ว\nArea ID: ${this.currentAreaId}\nพร้อมสำหรับการวัด ${this.measurementPoints.length} จุด`
        );
      } else {
        console.error('❌ No area_id in response:', response);
        throw new Error('Invalid response from server');
      }
      
    } catch (error: any) {
      console.error('❌ Error creating area:', {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        error: error.error,
        url: error.url,
        fullError: error
      });
      
      // แสดง error message ที่เจาะจง
      let errorMessage = 'ไม่สามารถสร้างพื้นที่ได้';
      let errorDetails = '';
      
      if (error.status === 401) {
        errorMessage = 'ไม่ได้รับอนุญาต - กรุณาเข้าสู่ระบบใหม่';
        errorDetails = error.error?.message || 'Firebase token ไม่ถูกต้องหรือหมดอายุ';
        console.error('🔐 Authentication Error:', {
          message: error.error?.message,
          hint: 'Token อาจหมดอายุหรือไม่ถูกต้อง - ลอง logout แล้ว login ใหม่'
        });
      } else if (error.status === 400) {
        errorMessage = 'ข้อมูลไม่ถูกต้อง';
        errorDetails = error.error?.message || 'กรุณาตรวจสอบข้อมูล';
      } else if (error.status === 500) {
        errorMessage = 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์';
        errorDetails = 'กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ';
        console.error('🔥 Server Error:', error.error);
      } else if (error.status === 404) {
        errorMessage = 'ไม่พบ endpoint';
        errorDetails = `/api/areas ไม่มีอยู่ - กรุณาติดต่อผู้ดูแลระบบ`;
      } else if (error.status === 0) {
        errorMessage = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์';
        errorDetails = 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต';
      } else if (error.message) {
        errorDetails = error.message;
      }
      
      console.error('💡 Error Details:', errorDetails);
      
      this.notificationService.showNotification(
        'error', 
        errorMessage, 
        errorDetails
      );
    }
  }
  // ✅ สร้างจุดที่ต้องวัดภายในพื้นที่
  generateMeasurementPoints() {
    console.log('🎯 generateMeasurementPoints called:', {
      selectedPointsLength: this.selectedPoints.length,
      selectedPoints: this.selectedPoints
    });
    
    if (this.selectedPoints.length < 3) {
      console.log('❌ Not enough points to generate measurement points');
      return;
    }
    
    this.measurementPoints = [];
    console.log('🔄 Starting to generate measurement points...');
    // ✅ คำนวณขอบเขตของ polygon
    const bounds = this.calculateBounds(this.selectedPoints);
    // ✅ คำนวณขนาดพื้นที่ (เมตร)
    const areaSize = this.calculateAreaSize(bounds);
    const realArea = this.calculatePolygonArea(this.selectedPoints);
    // ✅ กำหนดระยะห่างระหว่างจุดวัดตามขนาดพื้นที่
    let pointDistance: number;
    if (areaSize < 30) {
      // ✅ พื้นที่เล็ก (< 30m): ระยะห่าง 5-10 เมตร
      pointDistance = 7; // ใช้ค่าเฉลี่ย 7 เมตร
    } else {
      // ✅ พื้นที่ใหญ่ (≥ 30m): ระยะห่าง 10-15 เมตร
      pointDistance = 12; // ใช้ค่าเฉลี่ย 12 เมตร
    }
    // ✅ แปลงระยะห่างจากเมตรเป็นองศา (ประมาณ)
    // 1 องศา ≈ 111,000 เมตร
    const latStep = pointDistance / 111000;
    const lngStep = pointDistance / (111000 * Math.cos((bounds.minLat + bounds.maxLat) / 2 * Math.PI / 180));
    // ✅ สร้างจุดวัดแบบ grid pattern ด้วยพิกัดจริงจาก MapTiler
    const points: [number, number][] = [];
    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += lngStep) {
      for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += latStep) {
        // ✅ ดึงพิกัดจริงจาก MapTiler โดยตรง
        const realLng = parseFloat(lng.toFixed(8)); // precision 8 ตำแหน่งทศนิยม
        const realLat = parseFloat(lat.toFixed(8)); // precision 8 ตำแหน่งทศนิยม
        
        const point: [number, number] = [realLng, realLat];
        // ✅ ตรวจสอบว่าจุดอยู่ใน polygon หรือไม่
        if (this.isPointInPolygon(point, this.selectedPoints)) {
          points.push(point);
          
          console.log('🗺️ MapTiler measurement point generated:', {
            original_lng: lng,
            original_lat: lat,
            real_lng: realLng,
            real_lat: realLat,
            precision: '8 decimal places',
            accuracy: '~0.00111 mm'
          });
        }
      }
    }
    // ✅ จำกัดจำนวนจุดไม่เกิน 50 จุด (เพิ่มขึ้นเพื่อให้ครอบคลุมพื้นที่มากขึ้น)
    if (points.length > 50) {
      const step = Math.floor(points.length / 50);
      this.measurementPoints = points.filter((_, index) => index % step === 0).slice(0, 50);
    } else {
      this.measurementPoints = points;
    }
    
    console.log('✅ Measurement points generated:', {
      totalPoints: points.length,
      finalPoints: this.measurementPoints.length,
      measurementPoints: this.measurementPoints
    });
  }
  // ✅ คำนวณขอบเขตของ polygon
  calculateBounds(points: [number, number][]) {
    let minLng = points[0][0];
    let maxLng = points[0][0];
    let minLat = points[0][1];
    let maxLat = points[0][1];
    for (const [lng, lat] of points) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    return { minLng, maxLng, minLat, maxLat };
  }
  // ✅ คำนวณขนาดพื้นที่ (เมตร)
  calculateAreaSize(bounds: { minLng: number, maxLng: number, minLat: number, maxLat: number }) {
    // ✅ คำนวณระยะทางในแนว lat และ lng (เมตร)
    const latDistance = (bounds.maxLat - bounds.minLat) * 111000; // 1 องศา ≈ 111,000 เมตร
    const lngDistance = (bounds.maxLng - bounds.minLng) * 111000 * Math.cos((bounds.minLat + bounds.maxLat) / 2 * Math.PI / 180);
    // ✅ ใช้ขนาดที่ใหญ่กว่าเป็นตัวแทนขนาดพื้นที่
    const areaSize = Math.max(latDistance, lngDistance);
    return areaSize;
  }
  // ✅ ตรวจสอบว่าจุดอยู่ใน polygon หรือไม่
  isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }
  // ✅ คำนวณพื้นที่ polygon แบบแม่นยำ (ตารางเมตร)
  calculatePolygonArea(coordinates: [number, number][]): number {
    if (coordinates.length < 3) return 0;
    // ใช้ Shoelace formula สำหรับคำนวณพื้นที่ในระบบพิกัด
    let area = 0;
    const n = coordinates.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += coordinates[i][0] * coordinates[j][1];
      area -= coordinates[j][0] * coordinates[i][1];
    }
    area = Math.abs(area) / 2;
    // แปลงจาก degrees เป็น meters โดยใช้ Haversine formula
    const earthRadius = 6371000; // รัศมีโลกในหน่วยเมตร
    // คำนวณระยะทางเฉลี่ยระหว่างจุด
    let totalDistance = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const lat1 = coordinates[i][1] * Math.PI / 180;
      const lat2 = coordinates[j][1] * Math.PI / 180;
      const dLat = lat2 - lat1;
      const dLng = (coordinates[j][0] - coordinates[i][0]) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = earthRadius * c;
      totalDistance += distance;
    }
    const avgDistance = totalDistance / n;
    // คำนวณพื้นที่จริงในตารางเมตร
    const realArea = area * (avgDistance * avgDistance);
    return realArea;
  }
  // ✅ คำนวณพื้นที่แบบง่ายและแม่นยำ (ไร่)
  calculateSimpleArea(coordinates: [number, number][]): number {
    if (coordinates.length < 3) return 0;
    // ใช้ Shoelace formula
    let area = 0;
    const n = coordinates.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += coordinates[i][0] * coordinates[j][1];
      area -= coordinates[j][0] * coordinates[i][1];
    }
    area = Math.abs(area) / 2;
    // แปลงจาก degrees เป็น meters โดยใช้ค่าคงที่
    // 1 องศา ≈ 111,000 เมตร
    const latToMeters = 111000;
    const lngToMeters = 111000 * Math.cos(coordinates[0][1] * Math.PI / 180);
    // คำนวณพื้นที่ในตารางเมตร
    const areaInSquareMeters = area * latToMeters * lngToMeters;
    // แปลงเป็นไร่ (1 ไร่ = 1,600 ตารางเมตร)
    const areaInRai = areaInSquareMeters / 1600;
    return areaInRai;
  }
  // ✅ แปลงพื้นที่เป็นรูปแบบ "กี่ ไร่ กี่ งาน กี่ ตารางวา กี่ ตารางเมตร"
  formatAreaToThaiUnits(areaInRai: number): string {
    if (areaInRai < 0.0001) return '0 ไร่ 0 งาน 0 ตารางวา 0 ตารางเมตร';
    // 1 ไร่ = 4 งาน = 1,600 ตารางเมตร
    // 1 งาน = 400 ตารางเมตร
    // 1 งาน = 100 ตารางวา
    // 1 ตารางวา = 4 ตารางเมตร
    const rai = Math.floor(areaInRai);
    const remainingArea = (areaInRai - rai) * 1600; // แปลงเป็นตารางเมตร
    const ngan = Math.floor(remainingArea / 400);
    const remainingAfterNgan = remainingArea % 400;
    const squareWa = Math.floor(remainingAfterNgan / 4);
    const squareMeters = Math.round(remainingAfterNgan % 4);
    // เรียงลำดับ: ไร่ → งาน → ตารางวา → ตารางเมตร
    let result = '';
    if (rai > 0) {
      result += `${rai} ไร่`;
    }
    if (ngan > 0) {
      if (result) result += ' ';
      result += `${ngan} งาน`;
    }
    if (squareWa > 0) {
      if (result) result += ' ';
      result += `${squareWa} ตารางวา`;
    }
    if (squareMeters > 0) {
      if (result) result += ' ';
      result += `${squareMeters} ตารางเมตร`;
    }
    // ถ้าไม่มีอะไรเลย ให้แสดง 0 ไร่ 0 งาน 0 ตารางวา 0 ตารางเมตร
    if (!result) {
      result = '0 ไร่ 0 งาน 0 ตารางวา 0 ตารางเมตร';
    }
    return result;
  }
  // ✅ เริ่มต้นแผนที่ใน popup
  initializePopupMap() {
    setTimeout(() => {
      const popupMapContainer = document.querySelector('.map-popup');
      if (!popupMapContainer) {
        console.error('❌ Map container not found');
        return;
      }
      // ลบแผนที่เดิม
      if (this.map) {
        this.map.remove();
        this.map = undefined;
      }
      try {
        // สร้างแผนที่ใหม่ - คณะวิทยาการสารสนเทศ มหาวิทยาลัยมหาสารคาม
        this.map = new Map({
          container: popupMapContainer as HTMLElement,
          style: `https://api.maptiler.com/maps/satellite/style.json?key=${environment.mapTilerApiKey}`, // ✅ เปลี่ยนเป็นดาวเทียม
          center: [103.2501379, 16.2464504], // ✅ คณะวิทยาการสารสนเทศ มหาวิทยาลัยมหาสารคาม
          zoom: 17, // ✅ ขยายให้เห็นรายละเอียดของคณะ
          pitch: 0,
          bearing: 0
        });
        // เพิ่ม event listener สำหรับการคลิก
        this.map.on('click', (e) => {
          const { lng, lat } = e.lngLat;
          
          // ✅ ดึงพิกัดจริงจาก MapTiler โดยตรง
          const realLng = parseFloat(lng.toFixed(8)); // precision 8 ตำแหน่งทศนิยม
          const realLat = parseFloat(lat.toFixed(8)); // precision 8 ตำแหน่งทศนิยม
          
          console.log('🗺️ MapTiler coordinates:', {
            original_lng: lng,
            original_lat: lat,
            real_lng: realLng,
            real_lat: realLat,
            precision: '8 decimal places'
          });
          
          // ✅ เพิ่มจุดลงใน selectedPoints ด้วยพิกัดจริง
          this.selectedPoints.push([realLng, realLat]);
          
          // ✅ อัปเดต UI
          this.points = this.selectedPoints.map((point, index) => ({
            id: index + 1,
            lng: point[0],
            lat: point[1]
          }));
          
          // ✅ เพิ่ม marker ด้วยพิกัดจริง
          const marker = new Marker({ 
            color: '#00aaff',
            scale: 1.2
          })
            .setLngLat([realLng, realLat])
            .addTo(this.map!);
            
          // ✅ แสดงพิกัดจริงใน popup
          marker.setPopup(new Popup({
            offset: 25,
            closeButton: true,
            closeOnClick: false
          }).setHTML(`
            <div style="min-width: 200px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              <div style="background: linear-gradient(135deg, #00aaff 0%, #0088cc 100%); color: white; padding: 10px; border-radius: 8px 8px 0 0; margin: -10px -10px 10px -10px; text-align: center;">
                <h4 style="margin: 0; font-size: 16px; font-weight: bold;">📍 จุดที่ ${this.selectedPoints.length}</h4>
              </div>
              <div style="padding: 10px; background: #f8f9fa; border-radius: 0 0 8px 8px; margin: -10px -10px -10px -10px;">
                <p style="margin: 0; font-size: 12px; color: #666;"><strong>🌍 พิกัดจริงจาก MapTiler:</strong></p>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #2c3e50; font-weight: bold;">
                  Lat: ${realLat.toFixed(8)}<br>
                  Lng: ${realLng.toFixed(8)}
                </p>
                <p style="margin: 8px 0 0 0; font-size: 11px; color: #7f8c8d;">
                  ความแม่นยำ: 8 ตำแหน่งทศนิยม (~0.00111 mm)
                </p>
              </div>
            </div>
          `));
          
          // ✅ อัปเดต polygon
          this.updatePolygon();
        });
        this.map.once('load', () => {
        });
        this.map.on('error', (e) => {
          console.error('❌ Map error:', e);
        });
      } catch (error) {
        console.error('❌ Error creating map:', error);
        this.notificationService.showNotification('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโหลดแผนที่ กรุณาตรวจสอบ API Key');
      }
    }, 500); // เพิ่มเวลาให้ DOM โหลดเสร็จ
  }
  goBack() {
    this.location.back();
  }
  goToProfile() {
    this.router.navigate(['/profile']);
  }
  goToContactAdmin() {
    this.router.navigate(['/reports']);
  }
  goToHistory() {
    this.router.navigate(['/history']);
  }
  // ✅ Methods สำหรับควบคุมการแสดง/ซ่อน
  toggleUserInfo() {
    this.showUserInfo = !this.showUserInfo;
  }
  toggleDeviceInfo() {
    this.showDeviceInfo = !this.showDeviceInfo;
  }
  toggleMainMap() {
    this.showMainMap = !this.showMainMap;
    // ✅ อัปเดตแผนที่เมื่อแสดง
    if (this.showMainMap) {
      setTimeout(async () => {
        await this.initializeMap();
      }, 100);
    }
  }
  toggleCardMenu() {
    this.showCardMenu = !this.showCardMenu;
    console.log('📋 Card menu visibility:', this.showCardMenu);
  }
  closeCardMenu() {
    this.showCardMenu = false;
  }
  
  // ✅ แปลง timestamp เป็นรูปแบบที่อ่านง่าย
  formatTimestamp(timestamp: number): string {
    if (!timestamp) return 'ไม่ระบุ';
    
    try {
      // ถ้า timestamp เป็นวินาที (10 หลัก) ให้แปลงเป็นมิลลิวินาที
      const date = timestamp.toString().length === 10 
        ? new Date(timestamp * 1000) 
        : new Date(timestamp);
      
      return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      console.error('❌ Error formatting timestamp:', error);
      return 'ไม่ระบุ';
    }
  }
  
  // ✅ ดึงตำแหน่งตาม IP address
  private async getUserLocationByIP(): Promise<[number, number] | null> {
    try {
      console.log('🌍 Getting user location by IP...');
      
      // ใช้ IP geolocation service
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      
      if (data.latitude && data.longitude) {
        console.log('📍 User location found:', {
          country: data.country_name,
          city: data.city,
          coordinates: [data.longitude, data.latitude]
        });
        
        return [data.longitude, data.latitude];
      } else {
        console.log('⚠️ No location data from IP service');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting location by IP:', error);
      
      // Fallback: ลองใช้ service อื่น
      try {
        console.log('🔄 Trying fallback IP service...');
        const fallbackResponse = await fetch('https://ipinfo.io/json');
        const fallbackData = await fallbackResponse.json();
        
        if (fallbackData.loc) {
          const [lat, lng] = fallbackData.loc.split(',').map(Number);
          console.log('📍 Fallback location found:', {
            country: fallbackData.country,
            city: fallbackData.city,
            coordinates: [lng, lat]
          });
          
          return [lng, lat];
        }
      } catch (fallbackError) {
        console.error('❌ Fallback IP service also failed:', fallbackError);
      }
      
      return null;
    }
  }
  
  // ========= 🔻 เพิ่มเมธอดนี้เพื่อแก้ TS2339 และจัดการแผนที่ 🔻 =========
  private async initializeMap(): Promise<void> {
    if (!this.mapContainer?.nativeElement) return;
    // เคลียร์แผนที่เดิม (ถ้ามี)
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
    
    // ✅ ดึงตำแหน่งตาม IP address
    const userLocation = await this.getUserLocationByIP();
    
    // สร้างแผนที่ใหม่ - ตำแหน่งตาม IP หรือ fallback เป็นมหาวิทยาลัยมหาสารคาม
    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: `https://api.maptiler.com/maps/satellite/style.json?key=${environment.mapTilerApiKey}`, // ✅ เปลี่ยนเป็นดาวเทียม
      center: userLocation || [103.2501379, 16.2464504], // ✅ ตำแหน่งตาม IP หรือ fallback
      zoom: userLocation ? 15 : 17, // ✅ zoom ตามตำแหน่ง
    });
    const bounds = new LngLatBounds();
    let hasPoint = false;
    // แสดงจุดวัดเดิม
    for (const m of this.measurements) {
      if (typeof m.lng === 'number' && typeof m.lat === 'number') {
        new Marker({ color: '#ff6b6b' }).setLngLat([m.lng, m.lat]).addTo(this.map!);
        bounds.extend([m.lng, m.lat]);
        hasPoint = true;
      }
    }
    // ✅ แสดงจุดที่ต้องวัด (จุดใหม่ที่คำนวณจากพื้นที่ที่เลือก)
    if (this.showMeasurementPoints && this.measurementPoints.length > 0) {
      console.log('🎯 Showing measurement points:', this.measurementPoints.length);
      console.log('✅ Measured points:', this.measuredPoints);
      
      // ✅ โหลดข้อมูลการวัดที่เสร็จแล้วจากฐานข้อมูล
      await this.loadCompletedMeasurements();
      
      // ✅ ใช้วิธีเดิมที่ทำงานได้ - สร้าง Marker แต่ละจุด
      for (let i = 0; i < this.measurementPoints.length; i++) {
        const [lng, lat] = this.measurementPoints[i];
        const isMeasured = this.measuredPoints.includes(i);
        const isSelected = this.selectedPointIndex === i;
        const isMeasuring = this.currentMeasuringPoint === i;
        
        // ✅ เลือกสีตามสถานะ
        let color = '#6c757d'; // เทา - ปกติ
        if (isSelected) {
          color = '#dc3545'; // แดง - เลือกอยู่
        } else if (isMeasured) {
          color = '#28a745'; // เขียว - วัดแล้ว
        }
        
        // ✅ สร้าง marker แบบง่ายๆ
        const marker = new Marker({ 
          color: color
        }).setLngLat([lng, lat]).addTo(this.map!);
        
        // ✅ ตั้งค่า marker ให้คลิกได้
        marker.getElement().style.cursor = 'pointer';
        marker.getElement().style.pointerEvents = 'auto';
        
        // ✅ ตั้งค่า SVG ให้คลิกได้
        const svg = marker.getElement().querySelector('svg');
        if (svg) {
          svg.style.pointerEvents = 'auto';
          svg.style.cursor = 'pointer';
        }
        
        // ✅ เพิ่ม click event สำหรับเลือกจุดแบบง่ายๆ
        marker.getElement().addEventListener('click', (e) => {
          e.stopPropagation(); // ป้องกันการ propagate
          console.log(`📍 Point ${i + 1} clicked`);
          this.selectedPointIndex = i;
          console.log(`📍 Selected point ${i + 1}:`, this.measurementPoints[i]);
          
          // ✅ อัปเดตสีของ marker ทั้งหมด
          setTimeout(() => {
            this.updateMarkerColors();
          }, 100);
        });
        
        // ✅ เพิ่ม hover effect เพื่อให้รู้ว่าคลิกได้
        marker.getElement().addEventListener('mouseenter', () => {
          marker.getElement().style.cursor = 'pointer';
          marker.getElement().style.opacity = '0.8';
        });
        
        marker.getElement().addEventListener('mouseleave', () => {
          marker.getElement().style.cursor = 'default';
          marker.getElement().style.opacity = '1';
        });
        
        bounds.extend([lng, lat]);
        hasPoint = true;
      }
      
      console.log('✅ Measurement points markers created successfully');
      
      // ✅ อัปเดตสีของ markers หลังจากสร้างเสร็จ
      setTimeout(() => {
        this.updateMarkerColors();
      }, 500);
    }
    this.map.once('load', () => {
      console.log('🗺️ Map loaded successfully');
      
      if (hasPoint) {
        this.map!.fitBounds(bounds, { padding: 40, maxZoom: 17, duration: 0 });
      }
    });
  }
  // ========= 🔺 จบ initializeMap 🔺 =========
}
