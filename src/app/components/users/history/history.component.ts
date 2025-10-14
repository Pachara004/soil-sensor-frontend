import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Map, Marker, config, LngLatBounds, Popup } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { environment } from '../../../service/environment';
import { Constants } from '../../../config/constants';
import { NotificationService } from '../../../service/notification.service';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { lastValueFrom } from 'rxjs';
interface Measurement {
  id: string;
  location: string;
  date: string;
  temperature?: number;
  moisture?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  ph?: number;
  areasid?: string;
  measurementPoint?: number;
  lat?: number;
  lng?: number;
  [key: string]: any;
}
interface AreaGroup {
  areasid: string;
  areaName: string;
  measurements: Measurement[];
  totalMeasurements: number;
  averages: {
    temperature: number;
    moisture: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    ph: number;
  };
  lastMeasurementDate: string;
  polygonBounds?: [number, number][];
}
interface UserData {
  username: string;
  userID: string;
  name: string;
  email: string;
  phone: string;
  devices?: { [key: string]: boolean };
}
interface FertilizerRecommendation {
  formula: string;
  brand: string;
  amount: string;
  description: string;
  application: string;
  timing: string;
  price: string;
  availability: string;
}
@Component({
  selector: 'app-history',
  standalone: true,
  imports: [FormsModule, CommonModule, MatProgressSpinnerModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit, AfterViewInit, OnDestroy {
  username: string = '';
  userName: string = '';
  userEmail: string = '';
  deviceId: string | null = null;
  devices: string[] = [];
  deviceMap: { [key: string]: string } = {}; // Map device_name to device_id
  userData: any = null;
  deviceData: any = null;
  areas: AreaGroup[] = [];
  areaGroups: AreaGroup[] = [];
  selectedArea: AreaGroup | null = null;
  showAreaDetails = false;
  isLoading = true;
  showCardMenu = false;
  map: Map | undefined;
  markers: any[] = [];
  currentUser: any = null;
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLElement>;
  private apiUrl: string;
  constructor(
    private router: Router,
    private location: Location,
    private http: HttpClient,
    private constants: Constants,
    private notificationService: NotificationService,
    private auth: Auth
  ) {
    this.apiUrl = this.constants.API_ENDPOINT;
    config.apiKey = environment.mapTilerApiKey;
  }
  ngOnInit(): void {
    // ✅ แก้ไขการโหลดข้อมูลหลัง refresh - ใช้ข้อมูลจาก localStorage ก่อน
    const cachedData = localStorage.getItem('history-cache');
    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        console.log('📦 Loading cached data:', parsedData);
        
        // ✅ ตรวจสอบ cache expiration (5 นาที)
        const cacheAge = Date.now() - (parsedData.timestamp || 0);
        const cacheExpired = cacheAge > 5 * 60 * 1000; // 5 minutes
        
        if (!cacheExpired) {
          if (parsedData.username) this.username = parsedData.username;
          if (parsedData.userName) this.userName = parsedData.userName;
          if (parsedData.userEmail) this.userEmail = parsedData.userEmail;
          if (parsedData.devices) this.devices = parsedData.devices;
          if (parsedData.deviceId) this.deviceId = parsedData.deviceId;
          if (parsedData.deviceMap) this.deviceMap = parsedData.deviceMap;
          if (parsedData.areaGroups) this.areaGroups = parsedData.areaGroups;
          if (parsedData.areas) this.areas = parsedData.areas;
          
          console.log('📦 Cached data loaded successfully');
          console.log('📦 Username from cache:', this.username);
          console.log('📦 Devices from cache:', this.devices);
          console.log('📦 Device ID from cache:', this.deviceId);
          console.log('📦 Cache age:', Math.round(cacheAge / 1000), 'seconds');
        } else {
          console.log('📦 Cache expired, will reload data');
          localStorage.removeItem('history-cache');
        }
      } catch (error) {
        console.error('❌ Error loading cached data:', error);
        localStorage.removeItem('history-cache');
      }
    }
    
    // ใช้ Firebase Auth แทน localStorage
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.currentUser = user;
        // ✅ แก้ไขการแสดงชื่อ user - ใช้ displayName ก่อน ถ้าไม่มีให้ใช้ email
        this.username = user.displayName || user.email?.split('@')[0] || 'ไม่ระบุ';
        this.userName = user.displayName || user.email?.split('@')[0] || 'ไม่ระบุ';
        this.userEmail = user.email || 'ไม่ระบุ';
        
        console.log('👤 User info from Firebase:', {
          displayName: user.displayName,
          email: user.email,
          username: this.username,
          userName: this.userName,
          userEmail: this.userEmail
        });
        
        // ดึงข้อมูล user และ device จาก backend with debounce
        setTimeout(() => this.loadUserAndDeviceData(), 50);
      } else {
        this.router.navigate(['/login']);
      }
    });
  }
  ngAfterViewInit() {
    this.initializeMap();
  }
  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }
  async onDeviceChange() {
    console.log('🔄 Device changed to:', this.deviceId);
    console.log('🔄 Device map:', this.deviceMap);
    
    if (this.deviceId) {
      // ✅ โหลดแค่ areas ที่เป็นจุดหลักๆ ตาม device ที่เลือก
      console.log('🔄 Loading areas for device:', this.deviceId);
      await this.loadAreas();
    }
  }
  async loadUserAndDeviceData() {
    if (!this.currentUser) return;
    
    // Check cache first for better performance
    const cacheKey = `user_data_${this.userEmail}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const data = JSON.parse(cachedData);
        if (Date.now() - data.timestamp < 300000) { // 5 minutes cache
          this.userData = data.userData;
          this.deviceData = data.deviceData;
          this.loadAreas();
          return;
        }
      } catch (e) {
        // Cache invalid, continue with API call
      }
    }
    
    try {
      // ดึงข้อมูล user และ device จาก backend
      const token = await this.currentUser.getIdToken();
      // ดึงข้อมูล user จาก PostgreSQL
      let userDataFound = false;
      const userEndpoints = [
        '/api/auth/me',
        '/api/user/profile',
        '/api/user/me',
        '/api/profile'
      ];
      for (const endpoint of userEndpoints) {
      try {
        const userResponse = await lastValueFrom(
            this.http.get<any>(`${this.apiUrl}${endpoint}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );
          let userData = userResponse;
          if (userResponse.user) {
            userData = userResponse.user;
          }
          if (userData && (userData.user_name || userData.username)) {
            // ✅ แก้ไขการแสดง user_name จาก PostgreSQL - ใช้ user_name จาก DB ก่อน
            this.username = userData.user_name || userData.username || this.username;
            this.userName = userData.user_name || userData.username || this.userName;
            this.userEmail = userData.user_email || userData.email || this.userEmail;
            this.userData = userData;
            userDataFound = true;
            
            console.log('👤 User data from PostgreSQL:', userData);
            console.log('👤 PostgreSQL user_name:', userData.user_name);
            console.log('👤 Username set to:', this.username);
            console.log('👤 UserName set to:', this.userName);
            console.log('👤 UserEmail set to:', this.userEmail);
            break; // หยุดเมื่อเจอ endpoint ที่ทำงานได้
          }
        } catch (userError: any) {
          // User endpoint failed
          continue; // ลอง endpoint ถัดไป
        }
      }
      if (!userDataFound) {
        // ✅ ถ้าไม่สามารถดึงข้อมูลจาก backend ได้ ให้ใช้ข้อมูลจาก Firebase
        // ✅ แก้ไขการแสดงชื่อ user - ใช้ displayName ก่อน ถ้าไม่มีให้ใช้ email
        this.username = this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'ไม่ระบุ';
        this.userName = this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'ไม่ระบุ';
        this.userEmail = this.currentUser.email || 'ไม่ระบุ';
        
        console.log('👤 User info from Firebase:', {
          displayName: this.currentUser.displayName,
          email: this.currentUser.email,
          username: this.username,
          userName: this.userName,
          userEmail: this.userEmail
        });
      }
      // ดึงข้อมูล device
      try {
        console.log('🔍 Loading devices from API...');
        const devicesResponse = await lastValueFrom(
          this.http.get<any[]>(`${this.apiUrl}/api/devices`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );
        console.log('📱 Devices response:', devicesResponse);
        
        if (devicesResponse && devicesResponse.length > 0) {
          // ✅ แก้ไขการแสดงชื่ออุปกรณ์ - ใช้ device_name ก่อน ถ้าไม่มีให้ใช้ deviceid
          this.devices = devicesResponse.map(device => {
            const deviceName = device.device_name || device.deviceid || `Device ${device.deviceid}`;
            console.log('📱 Device mapping:', { deviceid: device.deviceid, device_name: device.device_name, finalName: deviceName });
            return deviceName;
          });
          console.log('📱 Devices list:', this.devices);
          
          // สร้าง map สำหรับแปลง device_name กลับเป็น device_id
          this.deviceMap = {};
          devicesResponse.forEach(device => {
            const deviceName = device.device_name || device.deviceid || `Device ${device.deviceid}`;
            this.deviceMap[deviceName] = device.deviceid;
          });
          console.log('📱 Device map:', this.deviceMap);
          
          this.deviceId = this.devices[0] || null;
          console.log('📱 Selected device ID:', this.deviceId);
          console.log('📱 Selected device name:', this.deviceId);
          
          // ✅ Debug: ตรวจสอบการแสดงอุปกรณ์
          console.log('🔍 Device display check:');
          console.log('🔍 Devices array length:', this.devices.length);
          console.log('🔍 First device:', this.devices[0]);
          console.log('🔍 Device ID:', this.deviceId);
        } else {
          console.log('⚠️ No devices found');
          // ✅ แสดงข้อความเมื่อไม่มีอุปกรณ์
          this.devices = ['ไม่มีอุปกรณ์'];
          this.deviceId = null;
        }
      } catch (deviceError) {
        console.error('❌ Error loading devices:', deviceError);
      }
      // ✅ Cache the data for better performance - รวมข้อมูลทั้งหมด
      const cacheData = {
        username: this.username,
        userName: this.userName,
        userEmail: this.userEmail,
        devices: this.devices,
        deviceId: this.deviceId,
        deviceMap: this.deviceMap,
        userData: this.userData,
        deviceData: this.deviceData,
        timestamp: Date.now()
      };
      
      localStorage.setItem('history-cache', JSON.stringify(cacheData));
      console.log('💾 Data cached successfully:', cacheData);
      
      // ดึงข้อมูล areas หลังจากได้ token แล้ว
      await this.loadAreas();
      // ✅ ไม่ต้องดึง measurements ทีละจุดแล้ว เพราะ areas API มีข้อมูลครบถ้วนแล้ว
    } catch (error) {
      console.error('❌ Error loading user and device data:', error);
    }
  }
  // ✅ ดึงข้อมูล measurements จาก database โดยตรง
  private async loadMeasurementsFromDatabase(): Promise<any[]> {
    if (!this.currentUser) {
      console.log('⚠️ No current user for loading measurements');
      return [];
    }

    try {
      const token = await this.currentUser.getIdToken();
      console.log('🔍 Loading measurements from database...');
      
      // ✅ ลองใช้ endpoint ที่มีอยู่จริง
      const endpoints = [
        '/api/firebase-measurements',
        '/api/measurements',
        '/api/measurements/all',
        '/api/measurement-data',
        '/api/measurement-records',
        '/api/firebase-measurements/all',
        '/api/firebase-measurements/list'
      ];
      
      for (const endpoint of endpoints) {
        try {
          console.log(`🔍 Trying endpoint: ${endpoint}`);
          const response = await lastValueFrom(
            this.http.get<any[]>(`${this.apiUrl}${endpoint}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
          );
          
          if (response && Array.isArray(response)) {
            console.log(`✅ Successfully loaded measurements from ${endpoint}:`, response.length);
            console.log('📊 Sample measurement data:', response[0]);
            
            // ✅ กรอง measurements ตาม device ที่เลือก
            if (this.deviceId) {
              const actualDeviceId = this.deviceMap[this.deviceId] || this.deviceId;
              console.log('🔍 Filtering measurements by device:', actualDeviceId);
              console.log('🔍 Device map:', this.deviceMap);
              console.log('🔍 Selected device ID:', this.deviceId);
              console.log('🔍 All measurements before filtering:', response);
              
              const filteredMeasurements = response.filter(measurement => {
                const measurementDeviceId = measurement['deviceid'] || measurement['device_id'];
                const match = measurementDeviceId && measurementDeviceId.toString() === actualDeviceId.toString();
                console.log(`🔍 Measurement device: ${measurementDeviceId}, Match: ${match}`);
                return match;
              });
              
              console.log(`📊 Filtered measurements: ${filteredMeasurements.length} out of ${response.length}`);
              return filteredMeasurements;
            } else {
              console.log('⚠️ No device selected, returning all measurements');
              console.log('🔍 All measurements:', response);
            }
            
            return response;
          }
        } catch (error: any) {
          console.log(`❌ Endpoint ${endpoint} failed:`, error.status, error.message);
        }
      }
      
      console.log('⚠️ All measurement endpoints failed');
      return [];
      
    } catch (error) {
      console.error('❌ Error loading measurements from database:', error);
      return [];
    }
  }

  // ✅ ดึงข้อมูล measurements จาก PostgreSQL โดยใช้ API endpoints ใหม่
  private async loadMeasurementsFromPostgreSQLAPI(areasid?: string): Promise<any[]> {
    if (!this.currentUser) {
      console.log('⚠️ No current user for loading measurements');
      return [];
    }

    try {
      const token = await this.currentUser.getIdToken();
      console.log('🔍 Loading measurements from PostgreSQL API...');
      console.log('🔍 Areasid filter:', areasid);
      
      let apiUrl: string;
      
      if (areasid) {
        // ✅ ใช้ API endpoint สำหรับพื้นที่เฉพาะ
        const deviceId = this.deviceId ? (this.deviceMap[this.deviceId] || this.deviceId) : '';
        apiUrl = `${this.apiUrl}/api/areas/${areasid}/measurements?deviceid=${deviceId}`;
        console.log('🔍 Using area-specific API:', apiUrl);
        console.log('🔍 Device ID for area-specific API:', deviceId);
      } else {
        // ✅ ใช้ API endpoint สำหรับข้อมูลทั้งหมด
        const deviceId = this.deviceId ? (this.deviceMap[this.deviceId] || this.deviceId) : '';
        apiUrl = `${this.apiUrl}/api/areas/measurements/all?deviceid=${deviceId}`;
        console.log('🔍 Using all measurements API:', apiUrl);
        console.log('🔍 Device ID for all measurements API:', deviceId);
      }
      
      const response = await lastValueFrom(
        this.http.get<any[]>(apiUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );
      
      if (response && Array.isArray(response)) {
        console.log(`✅ Successfully loaded measurements from PostgreSQL API:`, response.length);
        console.log('📊 Sample measurement data:', response[0]);
        
        // ✅ Debug: ตรวจสอบข้อมูล measurements
        response.forEach((measurement, index) => {
          console.log(`📊 PostgreSQL API Measurement ${index + 1}:`, {
            measurementid: measurement['measurementid'],
            areasid: measurement['areasid'],
            point_id: measurement['point_id'],
            lat: measurement['lat'],
            lng: measurement['lng'],
            deviceid: measurement['deviceid'],
            device_name: measurement['device_name'],
            area_name: measurement['area_name'],
            temperature: measurement['temperature'],
            moisture: measurement['moisture'],
            ph: measurement['ph'],
            nitrogen: measurement['nitrogen'],
            phosphorus: measurement['phosphorus'],
            potassium: measurement['potassium'],
            measurement_date: measurement['measurement_date'],
            measurement_time: measurement['measurement_time']
          });
        });
        
        return response;
      }
      
      console.log('⚠️ No measurements found in PostgreSQL API');
      return [];
      
    } catch (error) {
      console.error('❌ Error loading measurements from PostgreSQL API:', error);
      return [];
    }
  }

  // ✅ ดึงข้อมูล measurements จาก PostgreSQL โดยตรงผ่าน SQL query
  private async loadMeasurementsFromPostgreSQLDirect(areasid?: string): Promise<any[]> {
    if (!this.currentUser) {
      console.log('⚠️ No current user for loading measurements');
      return [];
    }

    try {
      const token = await this.currentUser.getIdToken();
      console.log('🔍 Loading measurements from PostgreSQL directly...');
      console.log('🔍 Areasid filter:', areasid);
      
      // ✅ สร้าง SQL query สำหรับดึงข้อมูลจาก measurement table
      let sqlQuery = `
        SELECT 
          measurementid,
          deviceid,
          areasid,
          point_id,
          lat,
          lng,
          temperature,
          moisture,
          nitrogen,
          phosphorus,
          potassium,
          ph,
          measurement_date,
          measurement_time,
          created_at,
          updated_at
        FROM measurement
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      // ✅ เพิ่มเงื่อนไข areasid ถ้ามี
      if (areasid) {
        sqlQuery += ` AND areasid = $${paramIndex}`;
        params.push(parseInt(areasid));
        paramIndex++;
      }
      
      // ✅ เพิ่มเงื่อนไข deviceid ถ้ามี
      if (this.deviceId) {
        const actualDeviceId = this.deviceMap[this.deviceId] || this.deviceId;
        sqlQuery += ` AND deviceid = $${paramIndex}`;
        params.push(parseInt(actualDeviceId));
        paramIndex++;
      }
      
      sqlQuery += ` ORDER BY measurementid DESC`;
      
      console.log('🔍 SQL Query:', sqlQuery);
      console.log('🔍 SQL Params:', params);
      
      // ✅ ส่ง SQL query ไปยัง backend
      const response = await lastValueFrom(
        this.http.post<any[]>(`${this.apiUrl}/api/query`, {
          query: sqlQuery,
          params: params
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );
      
      if (response && Array.isArray(response)) {
        console.log(`✅ Successfully loaded measurements from PostgreSQL:`, response.length);
        console.log('📊 Sample measurement data:', response[0]);
        
        // ✅ Debug: ตรวจสอบข้อมูล measurements
        response.forEach((measurement, index) => {
          console.log(`📊 PostgreSQL Measurement ${index + 1}:`, {
            measurementid: measurement['measurementid'],
            areasid: measurement['areasid'],
            point_id: measurement['point_id'],
            lat: measurement['lat'],
            lng: measurement['lng'],
            deviceid: measurement['deviceid'],
            temperature: measurement['temperature'],
            moisture: measurement['moisture'],
            ph: measurement['ph'],
            nitrogen: measurement['nitrogen'],
            phosphorus: measurement['phosphorus'],
            potassium: measurement['potassium'],
            measurement_date: measurement['measurement_date'],
            measurement_time: measurement['measurement_time']
          });
        });
        
        return response;
      }
      
      console.log('⚠️ No measurements found in PostgreSQL');
      return [];
      
    } catch (error) {
      console.error('❌ Error loading measurements from PostgreSQL:', error);
      return [];
    }
  }

  // ✅ ดึงข้อมูล measurements จาก PostgreSQL โดยตรง
  private async loadMeasurementsFromPostgreSQL(areasid?: string): Promise<any[]> {
    if (!this.currentUser) {
      console.log('⚠️ No current user for loading measurements');
      return [];
    }

    try {
      const token = await this.currentUser.getIdToken();
      console.log('🔍 Loading measurements from PostgreSQL...');
      console.log('🔍 Areasid filter:', areasid);
      
      // ✅ สร้าง URL สำหรับดึงข้อมูลจาก PostgreSQL
      let apiUrl = `${this.apiUrl}/api/firebase-measurements`;
      
      // ✅ เพิ่ม query parameters
      const params = new URLSearchParams();
      if (areasid) {
        params.append('areasid', areasid);
      }
      if (this.deviceId) {
        const actualDeviceId = this.deviceMap[this.deviceId] || this.deviceId;
        params.append('deviceid', actualDeviceId);
      }
      
      if (params.toString()) {
        apiUrl += `?${params.toString()}`;
      }
      
      console.log('🔍 Firebase Measurements API URL:', apiUrl);
      
      const response = await lastValueFrom(
        this.http.get<any[]>(apiUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );
      
      if (response && Array.isArray(response)) {
        console.log(`✅ Successfully loaded measurements from PostgreSQL:`, response.length);
        console.log('📊 Sample measurement data:', response[0]);
        
        // ✅ Debug: ตรวจสอบข้อมูล measurements
        response.forEach((measurement, index) => {
          console.log(`📊 PostgreSQL Measurement ${index + 1}:`, {
            measurementid: measurement['measurementid'],
            id: measurement['id'],
            measurement_id: measurement['measurement_id'],
            areasid: measurement['areasid'],
            point_id: measurement['point_id'],
            lat: measurement['lat'],
            lng: measurement['lng'],
            deviceid: measurement['deviceid'],
            temperature: measurement['temperature'],
            moisture: measurement['moisture'],
            ph: measurement['ph'],
            nitrogen: measurement['nitrogen'],
            phosphorus: measurement['phosphorus'],
            potassium: measurement['potassium'],
            measurement_date: measurement['measurement_date'],
            measurement_time: measurement['measurement_time']
          });
        });
        
        return response;
      }
      
      console.log('⚠️ No measurements found in PostgreSQL');
      return [];
      
    } catch (error) {
      console.error('❌ Error loading measurements from PostgreSQL:', error);
      return [];
    }
  }

  // ✅ ดึงข้อมูล measurements สำหรับ areasid เฉพาะ
  private async loadMeasurementsForArea(areasid: string): Promise<any[]> {
    console.log(`🔍 Loading measurements for areasid: ${areasid}`);
    
    // ✅ ใช้ฟังก์ชันใหม่ที่ดึงข้อมูลจาก PostgreSQL โดยใช้ API endpoints ใหม่
    const measurements = await this.loadMeasurementsFromPostgreSQLAPI(areasid);
    
    console.log(`📊 Area ${areasid} measurements loaded:`, measurements.length);
    console.log(`📊 Area ${areasid} measurement details:`, measurements.map(m => ({
      measurementid: m['measurementid'] || m.measurementid,
      areasid: m['areasid'] || m.areasid,
      point_id: m['point_id'] || m.point_id,
      lat: m['lat'] || m.lat,
      lng: m['lng'] || m.lng,
      deviceid: m['deviceid'] || m.deviceid
    })));
    
    return measurements;
  }

  async loadAreas() {
    if (!this.currentUser) {
      return;
    }
    
    // Check cache for areas data
    const areasCacheKey = `areas_data_${this.userEmail}`;
    const cachedAreas = localStorage.getItem(areasCacheKey);
    if (cachedAreas) {
      try {
        const data = JSON.parse(cachedAreas);
        if (Date.now() - data.timestamp < 600000) { // 10 minutes cache
          this.areas = data.areas;
          this.areaGroups = data.areaGroups;
          this.isLoading = false;
          return;
        }
      } catch (e) {
        // Cache invalid, continue with API call
      }
    }
    
    this.isLoading = true;
    try {
      const token = await this.currentUser.getIdToken();
      
      // ✅ ดึงข้อมูล areas ก่อน - ใช้ endpoint ที่มีอยู่จริง
      let areasApiUrl = `${this.apiUrl}/api/areas`;
      if (this.deviceId) {
        const actualDeviceId = this.deviceMap[this.deviceId] || this.deviceId;
        areasApiUrl += `?deviceid=${actualDeviceId}`;
      }
      
      console.log('🔍 Areas API URL:', areasApiUrl);
      console.log('🔍 Device ID:', this.deviceId);
      console.log('🔍 Actual Device ID:', this.deviceId ? (this.deviceMap[this.deviceId] || this.deviceId) : 'No device selected');
      
      const areasResponse = await lastValueFrom(
        this.http.get<any[]>(areasApiUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );

      if (areasResponse && Array.isArray(areasResponse)) {
        console.log('📊 Areas loaded from API:', areasResponse.length);
        console.log('📊 Areas data:', areasResponse);
        
        // ✅ Debug: ตรวจสอบ areasid ที่มีใน areas
        const uniqueAreasIds = [...new Set(areasResponse.map(area => area.areasid || area.id).filter(id => id != null))];
        console.log('📊 Unique areasids in areas:', uniqueAreasIds);
        // ✅ ดึงข้อมูล measurements จาก PostgreSQL โดยใช้ API endpoints ใหม่
        console.log('🔍 Loading measurements from PostgreSQL API...');
        console.log('🔍 Device ID for measurements:', this.deviceId);
        console.log('🔍 Device Map for measurements:', this.deviceMap);
        
        const measurementsResponse = await this.loadMeasurementsFromPostgreSQLAPI();
        console.log('📊 Measurements loaded:', measurementsResponse.length);
        console.log('📊 Measurements data:', measurementsResponse);
        
        console.log('📊 Measurements loaded from API:', measurementsResponse.length);
        console.log('📊 Measurements data:', measurementsResponse);
        
        // ✅ Debug: ตรวจสอบการโหลด measurements ทั้งหมด (ลด log ที่ซ้ำ)
        console.log('🔍 All measurements before filtering:', measurementsResponse.length);
        
        // ✅ Debug: ตรวจสอบ areasid ที่มีใน measurements
        const allMeasurementAreasids = measurementsResponse.map(m => m['areasid'] || m.areasid).filter(id => id != null);
        const allAreaAreasids = areasResponse.map(area => area.areasid || area.id).filter(id => id != null);
        const commonAreasids = [...new Set(allMeasurementAreasids)].filter(id => 
          [...new Set(allAreaAreasids)].includes(id)
        );
        console.log('🔍 Common areasids:', commonAreasids);
        
        // ✅ Debug: ตรวจสอบ measurement IDs และ areasid
        console.log('📊 Looking for areasids:', uniqueAreasIds);
        
        // ✅ กรอง measurements ตาม areasid ที่มีอยู่ (ลด log ที่ซ้ำ)
        const filteredMeasurements = measurementsResponse.filter(measurement => {
          const measurementAreasid = measurement['areasid']?.toString();
          const match = uniqueAreasIds.includes(measurementAreasid);
          return match;
        });
        
        console.log(`📊 Filtered measurements: ${filteredMeasurements.length} out of ${measurementsResponse.length}`);
        
        // ✅ Debug: ตรวจสอบว่าทำไมไม่มี measurements
        if (filteredMeasurements.length === 0) {
          console.log('⚠️ No measurements found after filtering');
          console.log('⚠️ Available measurements areasids:', measurementsResponse.map(m => m['areasid']));
          console.log('⚠️ Looking for areasids:', uniqueAreasIds);
        }
        
        // ✅ ลด log ที่ซ้ำ - แสดงเฉพาะข้อมูลสำคัญ
        if (measurementsResponse.length > 0) {
          console.log('📊 Sample measurement:', {
            measurementid: measurementsResponse[0]['measurementid'],
            areasid: measurementsResponse[0]['areasid'],
            point_id: measurementsResponse[0]['point_id'],
            deviceid: measurementsResponse[0]['deviceid']
          });
        }
        
        // ✅ ลด log ที่ซ้ำ - แสดงเฉพาะข้อมูลสำคัญ
        const uniqueMeasurementsAreasIds = [...new Set(measurementsResponse.map(m => m.areasid).filter(id => id != null))];
        console.log('📊 Unique areasids in measurements:', uniqueMeasurementsAreasIds);
        
        // ✅ ลด log ที่ซ้ำ - แสดงเฉพาะข้อมูลสำคัญ
        const areasAreasIds = [...new Set(areasResponse.map(area => area.areasid || area.id).filter(id => id != null))];
        const measurementsAreasIds = [...new Set(measurementsResponse.map(m => m.areasid).filter(id => id != null))];
        console.log('📊 Areas vs Measurements areasids:', { areas: areasAreasIds, measurements: measurementsAreasIds });
        console.log('📊 Missing areasids in measurements:', areasAreasIds.filter(id => !measurementsAreasIds.includes(id)));
        
        // ✅ ลด log ที่ซ้ำ - แสดงเฉพาะข้อมูลสำคัญ
        const measurementsWithCoords = measurementsResponse.filter(m => m.lat && m.lng);
        console.log('📊 Measurements with coordinates:', measurementsWithCoords.length);
        
        // ✅ ลด log ที่ซ้ำ - แสดงเฉพาะข้อมูลสำคัญ
        const measurementsWithValidCoords = measurementsResponse.filter(m => {
          const lat = parseFloat(String(m.lat || '0'));
          const lng = parseFloat(String(m.lng || '0'));
          return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
        });
        console.log('📊 Valid measurements with coordinates:', measurementsWithValidCoords.length);

        // แปลงข้อมูลจาก Areas API เป็น format ที่ต้องการ
        const areaGroups: AreaGroup[] = await Promise.all(areasResponse.map(async area => {
          const areasid = area.areasid?.toString() || area.id?.toString() || '';
          console.log(`🔍 Processing area ${areasid}:`, area);
          
        // ✅ แก้ไขการโหลด measurements - ใช้ filtered measurements และดึงเพิ่มเติมถ้าจำเป็น
        let areaMeasurements = filteredMeasurements.filter(measurement => {
          const measurementAreasid = measurement['areasid']?.toString();
          const match = measurementAreasid === areasid;
          console.log(`🔍 Area ${areasid} measurement areasid: ${measurementAreasid}, Match: ${match}`);
          console.log(`🔍 Area ${areasid} measurement details:`, measurement);
          return match;
        });
        
        // ✅ ถ้าไม่มี measurements ใน filteredMeasurements ให้ดึงใหม่จาก API
        if (areaMeasurements.length === 0) {
          console.log(`⚠️ No measurements in filteredMeasurements for area ${areasid}, trying to load from API...`);
          try {
            const apiMeasurements = await this.loadMeasurementsForArea(areasid);
            console.log(`📊 API measurements for area ${areasid}:`, apiMeasurements.length);
            if (apiMeasurements.length > 0) {
              areaMeasurements = apiMeasurements;
              console.log(`✅ Successfully loaded ${apiMeasurements.length} measurements from API for area ${areasid}`);
            }
          } catch (error) {
            console.error(`❌ Error loading measurements from API for area ${areasid}:`, error);
          }
        }
          
          console.log(`📊 Area ${areasid} measurements loaded:`, areaMeasurements.length);
          
          // ✅ Debug: ตรวจสอบว่าทำไมไม่มี measurements สำหรับ area นี้
          if (areaMeasurements.length === 0) {
            console.log(`⚠️ No measurements found for area ${areasid}`);
          }
          
          // ✅ ลด log ที่ซ้ำ - แสดงเฉพาะข้อมูลสำคัญ
          const areaMeasurementsWithCoords = areaMeasurements.filter(m => m.lat && m.lng);
          const areaMeasurementsWithValidCoords = areaMeasurements.filter(m => {
            const lat = parseFloat(String(m.lat || '0'));
            const lng = parseFloat(String(m.lng || '0'));
            return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
          });
          console.log(`📊 Area ${areasid} valid coordinates:`, areaMeasurementsWithValidCoords.length);

          // ✅ คำนวณขนาดพื้นที่จาก polygon bounds
          const areaSize = this.calculateAreaFromBounds(area.polygon_bounds || []);
          const areaSizeFormatted = this.formatAreaToThaiUnits(areaSize);
          
          // ✅ ใช้ค่าเฉลี่ยจาก backend แทนการคำนวณใหม่
          const averages = {
            temperature: parseFloat(area.temperature_avg) || 0,
            moisture: parseFloat(area.moisture_avg) || 0,
            nitrogen: parseFloat(area.nitrogen_avg) || 0,
            phosphorus: parseFloat(area.phosphorus_avg) || 0,
            potassium: parseFloat(area.potassium_avg) || 0,
            ph: parseFloat(area.ph_avg) || 0
          };
          
          // Area backend data processed
          
          const areaGroup = {
            areasid: areasid,
            areaName: area.area_name || area.name || area.location || `พื้นที่ ${areasid}`,
            measurements: areaMeasurements,
            totalMeasurements: areaMeasurements.length,
            averages: averages,
            lastMeasurementDate: areaMeasurements.length > 0 
              ? areaMeasurements[0].createdAt || areaMeasurements[0].date || area.created_at || ''
              : area.created_at || ''
          };
          
          console.log(`✅ Created area group for ${areasid}:`, areaGroup);
          console.log(`✅ Area group measurements:`, areaGroup.measurements);
          console.log(`✅ Area group measurement IDs:`, areaGroup.measurements.map(m => m['measurementid'] || m['id'] || m['measurement_id']));
          
          // ✅ Debug: ตรวจสอบ measurementid ใน area group
          areaGroup.measurements.forEach((measurement, index) => {
            console.log(`✅ Area Group ${areasid} Measurement ${index + 1}:`, {
              measurementid: measurement.measurementid,
              id: measurement.id,
              measurement_id: measurement.measurement_id,
              areasid: measurement.areasid,
              point_id: measurement.point_id,
              lat: measurement.lat,
              lng: measurement.lng
            });
          });
          
          return areaGroup;
        }));
        
        this.areas = areaGroups;
        this.areaGroups = areaGroups;
        
        console.log('🎯 Final areaGroups:', areaGroups);
        console.log('🎯 AreaGroups length:', areaGroups.length);
        console.log('🎯 AreaGroups details:', areaGroups.map(ag => ({
          areasid: ag.areasid,
          areaName: ag.areaName,
          measurementsCount: ag.measurements.length,
          measurementIds: ag.measurements.map(m => m['measurementid'] || m['id'] || m['measurement_id'])
        })));
        
        // ✅ Debug: ตรวจสอบการแสดงผลในหน้าเว็บ
        console.log('🌐 Frontend Display Check:');
        console.log('🌐 areaGroups.length:', areaGroups.length);
        console.log('🌐 areaGroups[0]?.measurements?.length:', areaGroups[0]?.measurements?.length);
        console.log('🌐 areaGroups[0]?.measurements:', areaGroups[0]?.measurements);
        console.log('🌐 Device ID for display:', this.deviceId);
        console.log('🌐 Device Map for display:', this.deviceMap);
        console.log('🌐 Username for display:', this.username);
        console.log('🌐 UserName for display:', this.userName);
        console.log('🌐 UserEmail for display:', this.userEmail);
        
        this.areas = areaGroups;
        this.areaGroups = areaGroups;
        
        // ✅ Cache the areas data for better performance - รวมข้อมูลทั้งหมด
        const cacheData = {
          username: this.username,
          userName: this.userName,
          userEmail: this.userEmail,
          devices: this.devices,
          deviceId: this.deviceId,
          deviceMap: this.deviceMap,
          areas: areaGroups,
          areaGroups: areaGroups,
          timestamp: Date.now()
        };
        
        localStorage.setItem('history-cache', JSON.stringify(cacheData));
        console.log('💾 Areas data cached successfully:', cacheData);
        
      this.isLoading = false;
      
        // Areas with measurements loaded
        
        if (areaGroups.length === 0) {
        this.notificationService.showNotification(
          'info',
          'ไม่มีข้อมูล',
          'ยังไม่มีข้อมูลการวัดค่าในระบบ'
        );
      }
      } else {
        this.areas = [];
        this.areaGroups = [];
        this.isLoading = false;
        this.notificationService.showNotification(
          'info',
          'ไม่มีข้อมูล',
          'ยังไม่มีข้อมูลการวัดค่าในระบบ'
        );
      }
    } catch (error: any) {
      console.error('❌ Error loading areas:', error);
      this.isLoading = false;
      
      if (error.status === 401) {
        this.notificationService.showNotification(
          'error',
          'หมดอายุการเข้าสู่ระบบ',
          'กรุณาเข้าสู่ระบบใหม่'
        );
        this.router.navigate(['/login']);
      } else if (error.status === 404) {
        // ✅ ถ้า endpoint ไม่มีอยู่ ให้ลองใช้ fallback
        console.log('🔄 Trying fallback endpoint...');
        try {
          await this.loadAreasAlternative();
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
          this.notificationService.showNotification(
            'error',
            'เกิดข้อผิดพลาด',
            'ไม่สามารถโหลดข้อมูลประวัติการวัดได้ กรุณาลองใหม่อีกครั้ง'
          );
        }
      } else {
        this.notificationService.showNotification(
          'error',
          'เกิดข้อผิดพลาด',
          'ไม่สามารถโหลดข้อมูลประวัติการวัดได้ กรุณาลองใหม่อีกครั้ง'
        );
      }
    }
  }
  async loadAreasAlternative() {
    try {
      const token = await this.currentUser.getIdToken();
      // ลองใช้ endpoint /api/areas
      const response = await lastValueFrom(
        this.http.get<any[]>(
          `${this.apiUrl}/api/areas`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        )
      );
      if (response && Array.isArray(response)) {
        // แปลงข้อมูล areas เป็น format ที่ต้องการ
        const areaGroups: AreaGroup[] = response.map(area => ({
          areasid: area.id || area.areasid || '',
          areaName: area.name || area.location || 'ไม่ระบุสถานที่',
          measurements: area.measurements || [],
          totalMeasurements: area.measurements?.length || 0,
          averages: {
            temperature: 0,
            moisture: 0,
            nitrogen: 0,
            phosphorus: 0,
            potassium: 0,
            ph: 0
          },
          lastMeasurementDate: area.measurements?.[0]?.date || ''
        }));
        this.areas = areaGroups;
        this.areaGroups = areaGroups;
        if (areaGroups.length === 0) {
          this.notificationService.showNotification(
            'info',
            'ยังไม่มีข้อมูล',
            'ยังไม่มีข้อมูลการวัดค่าในระบบ'
          );
        }
      } else {
        this.areas = [];
        this.areaGroups = [];
        this.notificationService.showNotification(
          'info',
          'ยังไม่มีข้อมูล',
          'ยังไม่มีข้อมูลการวัดค่าในระบบ'
        );
      }
    } catch (altError: any) {
      console.error('❌ Alternative endpoint also failed:', altError);
      if (altError.status === 401) {
        this.notificationService.showNotification(
          'error',
          'หมดอายุการเข้าสู่ระบบ',
          'กรุณาเข้าสู่ระบบใหม่'
        );
        // Redirect to login
        this.router.navigate(['/login']);
      } else {
        this.areas = [];
        this.areaGroups = [];
        this.notificationService.showNotification(
          'info',
          'ยังไม่มีข้อมูล',
          'ยังไม่มีข้อมูลการวัดค่าในระบบ'
        );
      }
    }
  }
  initializeMap() {
    if (!this.mapContainer || !this.selectedArea) return;
    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: 'streets-v2',
      center: [100.5018, 13.7563],
      zoom: 10,
    });
    if (this.selectedArea.measurements.length > 0) {
      this.selectedArea.measurements.forEach((m) => {
        if (m.lat && m.lng) {
          new Marker({ color: '#FF0000' })
            .setLngLat([m.lng, m.lat])
            .addTo(this.map!);
        }
      });
    }
  }
  getDisplayAreaName(area: AreaGroup): string {
    return area.areaName || 'ไม่ระบุพื้นที่';
  }

  // ✅ ฟังก์ชันสำหรับ format ตัวเลข
  formatNumber(value: any, decimals: number = 2): string {
    // ✅ แก้ไข error toFixed - ตรวจสอบค่าให้ครบถ้วน
    if (value === null || value === undefined) {
      return '0.00';
    }
    
    // ✅ แปลงเป็น number ก่อน
    const numValue = Number(value);
    
    // ✅ ตรวจสอบว่าเป็น number ที่ถูกต้อง
    if (isNaN(numValue)) {
      console.warn('⚠️ formatNumber: Invalid number value:', value);
      return '0.00';
    }
    
    // ✅ ตรวจสอบว่าเป็น finite number
    if (!isFinite(numValue)) {
      console.warn('⚠️ formatNumber: Non-finite number value:', value);
      return '0.00';
    }
    
    try {
      return numValue.toFixed(decimals);
    } catch (error) {
      console.error('❌ formatNumber error:', error, 'value:', value, 'type:', typeof value);
      return '0.00';
    }
  }
  viewAreaDetails(area: AreaGroup) {
    console.log('🗺️ viewAreaDetails called with area:', area);
    console.log('🗺️ Area measurements count:', area.measurements?.length);
    console.log('🗺️ Area measurements data:', area.measurements);
    
    // ✅ Debug: ตรวจสอบการแสดงรายการ measurements (ลด log ที่ซ้ำ)
    if (area.measurements && area.measurements.length > 0) {
      console.log('📊 Measurements to display:', area.measurements.length);
      // แสดงเฉพาะ measurement แรกเป็นตัวอย่าง
      if (area.measurements[0]) {
        console.log('📊 Sample measurement:', {
          measurementid: area.measurements[0]['measurementid'],
          areasid: area.measurements[0]['areasid'],
          point_id: area.measurements[0]['point_id']
        });
      }
    } else {
      console.log('⚠️ No measurements to display for area:', area.areasid);
    }
    
    this.selectedArea = area;
    this.showAreaDetails = true;
    console.log('🗺️ showAreaDetails set to true');
    
    // ✅ Debug: ตรวจสอบการแสดงผลในหน้าเว็บ
    console.log('🌐 Frontend Display Status:');
    console.log('🌐 isLoading:', this.isLoading);
    console.log('🌐 showAreaDetails:', this.showAreaDetails);
    console.log('🌐 areaGroups.length:', this.areaGroups.length);
    console.log('🌐 selectedArea:', this.selectedArea);
    console.log('🌐 selectedArea.measurements?.length:', this.selectedArea?.measurements?.length);
    
    // แสดงแผนที่หลังจาก DOM อัปเดต
    setTimeout(() => {
      console.log('🗺️ Calling showMapInAreaDetails after timeout');
      this.showMapInAreaDetails();
    }, 200);
  }
  fitMapToBounds() {
    if (
      !this.map ||
      !this.selectedArea ||
      this.selectedArea.measurements.length === 0
    )
      return;
    const validMeasurements = this.selectedArea.measurements.filter(
      (m) => m.lat !== undefined && m.lng !== undefined && !isNaN(m.lat!) && !isNaN(m.lng!)
    );
    if (validMeasurements.length === 0) {
      this.mapContainer.nativeElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f5f5f5; color: #666;">
          <p>ไม่พบข้อมูลตำแหน่งของจุดวัด</p>
        </div>
      `;
      return;
    }
    const lats = validMeasurements.map((m) => m.lat!);
    const lngs = validMeasurements.map((m) => m.lng!);
    const bounds = new LngLatBounds(
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)]
    );
    this.map.fitBounds(bounds, { padding: 50, maxZoom: 18 });
  }
  showAreaStatistics(area: AreaGroup) {
    const stats = area.averages;
    const message = `สถิติพื้นที่: ${area.areaName}
      จำนวนจุดวัด: ${area.totalMeasurements} จุด
      วันที่วัดล่าสุด: ${area.lastMeasurementDate}
      ค่าเฉลี่ย:
      • อุณหภูมิ: ${this.formatNumber(stats.temperature)}°C
      • ความชื้น: ${this.formatNumber(stats.moisture)}%
      • ไนโตรเจน: ${this.formatNumber(stats.nitrogen)} mg/kg
      • ฟอสฟอรัส: ${this.formatNumber(stats.phosphorus)} mg/kg
      • โพแทสเซียม: ${this.formatNumber(stats.potassium)} mg/kg
      • ค่า pH: ${this.formatNumber(stats.ph, 1)}`;
    this.notificationService.showNotification('info', 'ข้อมูล', message);
  }
  viewMeasurementDetail(measurement: Measurement) {
    // ใช้ device_id จริงสำหรับการส่งข้อมูล
    const actualDeviceId = this.deviceMap[this.deviceId || ''] || this.deviceId;
    const measurementData = { 
      ...measurement, 
      deviceId: actualDeviceId,
      areasid: measurement.areasid || this.selectedArea?.areasid
    };
    // แสดงข้อมูลการวัดในรูปแบบ popup หรือ modal
    const detailMessage = `
จุดที่: ${measurement.measurementPoint || 'ไม่ระบุ'}
วันที่: ${new Date(measurement.date).toLocaleDateString('th-TH')}
เวลา: ${new Date(measurement.date).toLocaleTimeString('th-TH')}
อุณหภูมิ: ${measurement.temperature}°C
ความชื้น: ${measurement.moisture}%
ไนโตรเจน: ${measurement.nitrogen} ppm
ฟอสฟอรัส: ${measurement.phosphorus} ppm
โพแทสเซียม: ${measurement.potassium} ppm
pH: ${measurement.ph}
พิกัด: ${measurement.lat}, ${measurement.lng}
    `.trim();
    this.notificationService.showNotification(
      'info',
      'รายละเอียดการวัด',
      detailMessage
    );
    // บันทึกข้อมูลสำหรับหน้า detail (ถ้าต้องการ)
    localStorage.setItem('selectedMeasurement', JSON.stringify(measurementData));
  }
  backToAreaList() {
    this.showAreaDetails = false;
    this.selectedArea = null;
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
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
  // ✅ ฟังก์ชันคำแนะนำการปรับปรุงดินแบบละเอียด
  recommendSoilImprovement(area: AreaGroup | null): { message: string; fertilizers: FertilizerRecommendation[]; soilAnalysis: any; improvementPlan: any } {
    if (!area || !area.averages) {
      return {
        message: 'ไม่สามารถให้คำแนะนำได้ เนื่องจากไม่มีข้อมูลการวัด',
        fertilizers: [],
        soilAnalysis: null,
        improvementPlan: null
      };
    }
    
    const { temperature, moisture, nitrogen, phosphorus, potassium, ph } = area.averages;
    
    // วิเคราะห์สภาพดินแบบละเอียด
    const soilAnalysis = this.analyzeSoilCondition(ph, nitrogen, phosphorus, potassium, moisture, temperature);
    const improvementPlan = this.createImprovementPlan(soilAnalysis);
    
    let message = this.generateDetailedMessage(soilAnalysis);
    const fertilizers = this.getDetailedFertilizerRecommendations(soilAnalysis);
    
    return { message, fertilizers, soilAnalysis, improvementPlan };
  }

  // ✅ วิเคราะห์สภาพดินแบบละเอียด
  private analyzeSoilCondition(ph: number, nitrogen: number, phosphorus: number, potassium: number, moisture: number, temperature: number) {
    return {
      ph: {
        value: ph,
        status: ph < 5.5 ? 'กรดมาก' : ph < 6.5 ? 'กรดเล็กน้อย' : ph < 7.5 ? 'เป็นกลาง' : ph < 8.5 ? 'ด่างเล็กน้อย' : 'ด่างมาก',
        recommendation: ph < 6.0 ? 'ต้องปรับปรุง' : ph > 8.0 ? 'ต้องปรับปรุง' : 'เหมาะสม'
      },
      nitrogen: {
        value: nitrogen,
        status: nitrogen < 15 ? 'ขาดมาก' : nitrogen < 25 ? 'ขาดเล็กน้อย' : nitrogen < 40 ? 'เหมาะสม' : 'เกินความต้องการ',
        recommendation: nitrogen < 20 ? 'ต้องเพิ่ม' : nitrogen > 35 ? 'ลดการใส่' : 'เพียงพอ'
      },
      phosphorus: {
        value: phosphorus,
        status: phosphorus < 10 ? 'ขาดมาก' : phosphorus < 20 ? 'ขาดเล็กน้อย' : phosphorus < 30 ? 'เหมาะสม' : 'เกินความต้องการ',
        recommendation: phosphorus < 15 ? 'ต้องเพิ่ม' : phosphorus > 25 ? 'ลดการใส่' : 'เพียงพอ'
      },
      potassium: {
        value: potassium,
        status: potassium < 15 ? 'ขาดมาก' : potassium < 25 ? 'ขาดเล็กน้อย' : potassium < 40 ? 'เหมาะสม' : 'เกินความต้องการ',
        recommendation: potassium < 20 ? 'ต้องเพิ่ม' : potassium > 35 ? 'ลดการใส่' : 'เพียงพอ'
      },
      moisture: {
        value: moisture,
        status: moisture < 30 ? 'แห้งมาก' : moisture < 50 ? 'แห้งเล็กน้อย' : moisture < 70 ? 'เหมาะสม' : 'ชื้นมาก',
        recommendation: moisture < 40 ? 'ต้องให้น้ำ' : moisture > 75 ? 'ระบายน้ำ' : 'เพียงพอ'
      },
      temperature: {
        value: temperature,
        status: temperature < 20 ? 'เย็น' : temperature < 30 ? 'เหมาะสม' : 'ร้อน',
        recommendation: temperature < 25 ? 'ปลูกพืชทนหนาว' : temperature > 32 ? 'ปลูกพืชทนร้อน' : 'ปลูกพืชทั่วไป'
      }
    };
  }

  // ✅ สร้างแผนการปรับปรุงดิน
  private createImprovementPlan(soilAnalysis: any) {
    const plan = {
      immediate: [] as string[],
      shortTerm: [] as string[],
      longTerm: [] as string[],
      monitoring: [] as string[]
    };

    // แผนเร่งด่วน (1-2 สัปดาห์)
    if (soilAnalysis.ph.recommendation === 'ต้องปรับปรุง') {
      plan.immediate.push('ปรับ pH ดินด้วยปูนขาวหรือกำมะถัน');
    }
    if (soilAnalysis.moisture.recommendation === 'ต้องให้น้ำ') {
      plan.immediate.push('ให้น้ำอย่างสม่ำเสมอ');
    }

    // แผนระยะสั้น (1-3 เดือน)
    if (soilAnalysis.nitrogen.recommendation === 'ต้องเพิ่ม') {
      plan.shortTerm.push('ใส่ปุ๋ยไนโตรเจนตามคำแนะนำ');
    }
    if (soilAnalysis.phosphorus.recommendation === 'ต้องเพิ่ม') {
      plan.shortTerm.push('ใส่ปุ๋ยฟอสฟอรัสตามคำแนะนำ');
    }
    if (soilAnalysis.potassium.recommendation === 'ต้องเพิ่ม') {
      plan.shortTerm.push('ใส่ปุ๋ยโพแทสเซียมตามคำแนะนำ');
    }

    // แผนระยะยาว (3-12 เดือน)
    plan.longTerm.push('เพิ่มอินทรียวัตถุด้วยปุ๋ยหมักหรือปุ๋ยคอก');
    plan.longTerm.push('ปลูกพืชปุ๋ยสดเพื่อปรับปรุงดิน');
    plan.longTerm.push('หมุนเวียนพืชเพื่อรักษาความอุดมสมบูรณ์ของดิน');

    // การติดตาม
    plan.monitoring.push('วัดค่า pH ทุก 3 เดือน');
    plan.monitoring.push('ตรวจสอบธาตุอาหารทุก 6 เดือน');
    plan.monitoring.push('สังเกตการเจริญเติบโตของพืช');

    return plan;
  }

  // ✅ สร้างข้อความวิเคราะห์แบบละเอียด
  private generateDetailedMessage(soilAnalysis: any): string {
    let message = '🔍 การวิเคราะห์ดินแบบละเอียด:\n\n';
    
    message += `📊 ค่า pH: ${soilAnalysis.ph.value.toFixed(1)} (${soilAnalysis.ph.status}) - ${soilAnalysis.ph.recommendation}\n`;
    message += `🌱 ไนโตรเจน: ${soilAnalysis.nitrogen.value.toFixed(1)} mg/kg (${soilAnalysis.nitrogen.status}) - ${soilAnalysis.nitrogen.recommendation}\n`;
    message += `⚡ ฟอสฟอรัส: ${soilAnalysis.phosphorus.value.toFixed(1)} mg/kg (${soilAnalysis.phosphorus.status}) - ${soilAnalysis.phosphorus.recommendation}\n`;
    message += `💪 โพแทสเซียม: ${soilAnalysis.potassium.value.toFixed(1)} mg/kg (${soilAnalysis.potassium.status}) - ${soilAnalysis.potassium.recommendation}\n`;
    message += `💧 ความชื้น: ${soilAnalysis.moisture.value.toFixed(1)}% (${soilAnalysis.moisture.status}) - ${soilAnalysis.moisture.recommendation}\n`;
    message += `🌡️ อุณหภูมิ: ${soilAnalysis.temperature.value.toFixed(1)}°C (${soilAnalysis.temperature.status}) - ${soilAnalysis.temperature.recommendation}\n\n`;
    
    message += '💡 คำแนะนำ: ';
    const recommendations = [];
    if (soilAnalysis.ph.recommendation === 'ต้องปรับปรุง') recommendations.push('ปรับ pH');
    if (soilAnalysis.nitrogen.recommendation === 'ต้องเพิ่ม') recommendations.push('เพิ่มไนโตรเจน');
    if (soilAnalysis.phosphorus.recommendation === 'ต้องเพิ่ม') recommendations.push('เพิ่มฟอสฟอรัส');
    if (soilAnalysis.potassium.recommendation === 'ต้องเพิ่ม') recommendations.push('เพิ่มโพแทสเซียม');
    if (soilAnalysis.moisture.recommendation === 'ต้องให้น้ำ') recommendations.push('เพิ่มการให้น้ำ');
    
    if (recommendations.length === 0) {
      message += 'ดินมีสภาพดี เหมาะสำหรับการปลูกพืช';
    } else {
      message += recommendations.join(', ');
    }
    
    return message;
  }

  // ✅ คำแนะนำปุ๋ยแบบละเอียดพร้อมปุ๋ยจริงในท้องตลาด
  private getDetailedFertilizerRecommendations(soilAnalysis: any): FertilizerRecommendation[] {
    const fertilizers: FertilizerRecommendation[] = [];

    // ปุ๋ยปรับ pH
    if (soilAnalysis.ph.recommendation === 'ต้องปรับปรุง') {
      if (soilAnalysis.ph.value < 6.0) {
        fertilizers.push({
          formula: 'ปูนขาว (CaCO3)',
          brand: 'ปูนขาวตราไก่, ปูนขาวตราช้าง, ปูนขาวตราเสือ',
          amount: '1-2 ตัน/ไร่',
          description: 'ปรับปรุงความเป็นกรดของดิน เพิ่มแคลเซียม',
          application: 'หว่านให้ทั่วแปลงแล้วไถกลบ',
          timing: 'ก่อนปลูก 2-4 สัปดาห์',
          price: '800-1,200 บาท/ตัน',
          availability: 'หาซื้อได้ทั่วไปในร้านเกษตร'
        });
      } else if (soilAnalysis.ph.value > 8.0) {
        fertilizers.push({
          formula: 'กำมะถัน (S)',
          brand: 'กำมะถันตราไก่, กำมะถันตราช้าง',
          amount: '100-200 กก./ไร่',
          description: 'ลดความเป็นด่างของดิน',
          application: 'หว่านให้ทั่วแปลงแล้วไถกลบ',
          timing: 'ก่อนปลูก 3-4 สัปดาห์',
          price: '25-35 บาท/กก.',
          availability: 'หาซื้อได้ทั่วไปในร้านเกษตร'
        });
      }
    }

    // ปุ๋ยไนโตรเจน
    if (soilAnalysis.nitrogen.recommendation === 'ต้องเพิ่ม') {
      fertilizers.push({
        formula: 'ปุ๋ยยูเรีย (46-0-0)',
        brand: 'ยูเรียตราไก่, ยูเรียตราช้าง, ยูเรียตราเสือ, ยูเรียตราโค',
        amount: '20-30 กก./ไร่',
        description: 'เพิ่มไนโตรเจนในดิน เร่งการเจริญเติบโตของใบ',
        application: 'หว่านรอบโคนต้นหรือโรยเป็นแถว',
        timing: 'ช่วงแตกใบใหม่ หรือก่อนออกดอก',
        price: '18-22 บาท/กก.',
        availability: 'หาซื้อได้ทั่วไปในร้านเกษตร'
      });

      fertilizers.push({
        formula: 'ปุ๋ยแอมโมเนียมซัลเฟต (21-0-0)',
        brand: 'แอมโมเนียมซัลเฟตตราไก่, ตราช้าง',
        amount: '25-35 กก./ไร่',
        description: 'เพิ่มไนโตรเจนและกำมะถัน เหมาะสำหรับดินด่าง',
        application: 'หว่านรอบโคนต้น',
        timing: 'ช่วงแตกใบใหม่',
        price: '15-18 บาท/กก.',
        availability: 'หาซื้อได้ทั่วไปในร้านเกษตร'
      });
    }

    // ปุ๋ยฟอสฟอรัส
    if (soilAnalysis.phosphorus.recommendation === 'ต้องเพิ่ม') {
      fertilizers.push({
        formula: 'ปุ๋ยซุปเปอร์ฟอสเฟต (0-46-0)',
        brand: 'ซุปเปอร์ฟอสเฟตตราไก่, ตราช้าง, ตราเสือ',
        amount: '15-25 กก./ไร่',
        description: 'เพิ่มฟอสฟอรัสในดิน เร่งการออกดอกและผล',
        application: 'ใส่รองก้นหลุมหรือหว่านแล้วไถกลบ',
        timing: 'ก่อนปลูก หรือช่วงออกดอก',
        price: '22-28 บาท/กก.',
        availability: 'หาซื้อได้ทั่วไปในร้านเกษตร'
      });

      fertilizers.push({
        formula: 'ปุ๋ยไดแอมโมเนียมฟอสเฟต (18-46-0)',
        brand: 'DAP ตราไก่, ตราช้าง',
        amount: '20-30 กก./ไร่',
        description: 'เพิ่มไนโตรเจนและฟอสฟอรัส เหมาะสำหรับดินขาดทั้งสองธาตุ',
        application: 'ใส่รองก้นหลุม',
        timing: 'ก่อนปลูก',
        price: '25-30 บาท/กก.',
        availability: 'หาซื้อได้ทั่วไปในร้านเกษตร'
      });
    }

    // ปุ๋ยโพแทสเซียม
    if (soilAnalysis.potassium.recommendation === 'ต้องเพิ่ม') {
      fertilizers.push({
        formula: 'ปุ๋ยโพแทสเซียมคลอไรด์ (0-0-60)',
        brand: 'โพแทสเซียมคลอไรด์ตราไก่, ตราช้าง, ตราเสือ',
        amount: '10-20 กก./ไร่',
        description: 'เพิ่มโพแทสเซียมในดิน เพิ่มความต้านทานโรคและคุณภาพผล',
        application: 'หว่านรอบโคนต้น',
        timing: 'ช่วงออกดอกหรือก่อนเก็บเกี่ยว',
        price: '28-35 บาท/กก.',
        availability: 'หาซื้อได้ทั่วไปในร้านเกษตร'
      });

      fertilizers.push({
        formula: 'ปุ๋ยโพแทสเซียมซัลเฟต (0-0-50)',
        brand: 'โพแทสเซียมซัลเฟตตราไก่, ตราช้าง',
        amount: '15-25 กก./ไร่',
        description: 'เพิ่มโพแทสเซียมและกำมะถัน เหมาะสำหรับดินขาดกำมะถัน',
        application: 'หว่านรอบโคนต้น',
        timing: 'ช่วงออกดอก',
        price: '30-38 บาท/กก.',
        availability: 'หาซื้อได้ทั่วไปในร้านเกษตร'
      });
    }

    // ปุ๋ยผสม
    if (soilAnalysis.nitrogen.recommendation === 'ต้องเพิ่ม' && 
        soilAnalysis.phosphorus.recommendation === 'ต้องเพิ่ม' && 
        soilAnalysis.potassium.recommendation === 'ต้องเพิ่ม') {
      fertilizers.push({
        formula: 'ปุ๋ยผสม 15-15-15',
        brand: 'ปุ๋ยผสมตราไก่, ตราช้าง, ตราเสือ, ตราโค',
        amount: '30-50 กก./ไร่',
        description: 'ปุ๋ยผสมครบธาตุ เหมาะสำหรับดินขาดธาตุอาหารหลายชนิด',
        application: 'หว่านรอบโคนต้น',
        timing: 'ช่วงแตกใบใหม่',
        price: '20-25 บาท/กก.',
        availability: 'หาซื้อได้ทั่วไปในร้านเกษตร'
      });

      fertilizers.push({
        formula: 'ปุ๋ยผสม 16-16-16',
        brand: 'ปุ๋ยผสมตราไก่, ตราช้าง',
        amount: '25-40 กก./ไร่',
        description: 'ปุ๋ยผสมสมดุล เหมาะสำหรับพืชทั่วไป',
        application: 'หว่านรอบโคนต้น',
        timing: 'ช่วงแตกใบใหม่',
        price: '22-28 บาท/กก.',
        availability: 'หาซื้อได้ทั่วไปในร้านเกษตร'
      });
    }

    // ปุ๋ยอินทรีย์
    fertilizers.push({
      formula: 'ปุ๋ยหมัก',
      brand: 'ปุ๋ยหมักตราไก่, ตราช้าง, ตราเสือ, ปุ๋ยหมักท้องถิ่น',
      amount: '2-4 ตัน/ไร่',
      description: 'เพิ่มอินทรียวัตถุ ปรับปรุงโครงสร้างดิน',
      application: 'หว่านให้ทั่วแปลงแล้วไถกลบ',
      timing: 'ก่อนปลูก 1-2 เดือน',
      price: '1,500-2,500 บาท/ตัน',
      availability: 'หาซื้อได้ทั่วไปในร้านเกษตร'
    });

    fertilizers.push({
      formula: 'ปุ๋ยคอก',
      brand: 'ปุ๋ยคอกวัว, ปุ๋ยคอกไก่, ปุ๋ยคอกหมู',
      amount: '1-2 ตัน/ไร่',
      description: 'เพิ่มอินทรียวัตถุและธาตุอาหาร',
      application: 'หว่านให้ทั่วแปลงแล้วไถกลบ',
      timing: 'ก่อนปลูก 2-3 สัปดาห์',
      price: '800-1,500 บาท/ตัน',
      availability: 'หาซื้อได้ทั่วไปในร้านเกษตร'
    });

    return fertilizers;
  }

  // ✅ Helper functions for template
  getAnalysisLabel(key: string): string {
    const labels: { [key: string]: string } = {
      'ph': 'ค่า pH',
      'nitrogen': 'ไนโตรเจน',
      'phosphorus': 'ฟอสฟอรัส',
      'potassium': 'โพแทสเซียม',
      'moisture': 'ความชื้น',
      'temperature': 'อุณหภูมิ'
    };
    return labels[key] || key;
  }

  getStatusClass(status: string): string {
    if (status.includes('ขาดมาก') || status.includes('กรดมาก') || status.includes('ด่างมาก') || status.includes('แห้งมาก') || status.includes('ชื้นมาก')) {
      return 'status-critical';
    } else if (status.includes('ขาดเล็กน้อย') || status.includes('กรดเล็กน้อย') || status.includes('ด่างเล็กน้อย') || status.includes('แห้งเล็กน้อย')) {
      return 'status-warning';
    } else if (status.includes('เหมาะสม') || status.includes('เป็นกลาง')) {
      return 'status-good';
    } else if (status.includes('เกินความต้องการ') || status.includes('ร้อน')) {
      return 'status-excess';
    }
    return 'status-normal';
  }

  // ✅ ฟังก์ชันแนะนำพืชที่เหมาะสม
  recommendCrops(area: AreaGroup | null): string[] {
    if (!area || !area.averages) {
      return ['ไม่สามารถแนะนำได้ เนื่องจากไม่มีข้อมูลการวัด'];
    }
    const { temperature, moisture, nitrogen, phosphorus, potassium, ph } = area.averages;
    const crops: string[] = [];
    // วิเคราะห์ตามสภาพดิน
    if (ph >= 6.0 && ph <= 7.5) {
      if (moisture >= 50 && moisture <= 80) {
        if (temperature >= 20 && temperature <= 35) {
          crops.push('ข้าว', 'ข้าวโพด', 'อ้อย');
        }
        if (nitrogen >= 20 && phosphorus >= 15) {
          crops.push('ถั่วเหลือง', 'ถั่วลิสง');
        }
        if (potassium >= 15) {
          crops.push('มันสำปะหลัง', 'ยางพารา');
        }
      }
    }
    // เพิ่มพืชที่เหมาะสมตามสภาพทั่วไป
    if (crops.length === 0) {
      crops.push('พืชผักสวนครัว', 'ไม้ดอกไม้ประดับ');
    }
    return crops;
  }
  // ✅ ฟังก์ชันแสดงแผนที่ในรายละเอียดพื้นที่
  showMapInAreaDetails() {
    console.log('🗺️ showMapInAreaDetails called');
    console.log('🗺️ selectedArea:', this.selectedArea);
    
    if (!this.selectedArea) {
      console.log('⚠️ No selectedArea');
      return;
    }
    
    // ✅ แสดงแผนที่แม้ไม่มี measurements
    if (!this.selectedArea.measurements.length) {
      console.log('⚠️ No measurements, showing empty map');
      this.showEmptyMap();
      return;
    }
    
    console.log('🗺️ measurements:', this.selectedArea.measurements);
    
    // ใช้ setTimeout เพื่อให้ DOM อัปเดตก่อน
    setTimeout(() => {
      const mapContainer = document.querySelector('#mapContainer') as HTMLElement;
      console.log('🗺️ mapContainer:', mapContainer);
      
      if (!mapContainer) {
        console.log('❌ Map container not found');
        return;
      }
      
      // ล้างแผนที่เก่า (ถ้ามี)
      mapContainer.innerHTML = '';
      console.log('🗺️ Map container cleared');
      
      // Creating MapTiler map
      
      // Processing measurements for map
      
      // Debug: ดูข้อมูล measurements ที่มี lat/lng
      const measurementsWithCoords = this.selectedArea!.measurements.filter(m => m.lat && m.lng);
      console.log('🗺️ measurementsWithCoords:', measurementsWithCoords.length);
      
      // Debug: ดูข้อมูล measurements ที่มี lat/lng และไม่เป็น 0
      const measurementsWithValidCoords = this.selectedArea!.measurements.filter(m => {
        const lat = parseFloat(String(m.lat || '0'));
        const lng = parseFloat(String(m.lng || '0'));
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      });
      console.log('🗺️ measurementsWithValidCoords:', measurementsWithValidCoords.length);
      
      // คำนวณจุดกึ่งกลางของพื้นที่
      const validMeasurements = this.selectedArea!.measurements.filter(m => {
        const lat = parseFloat(String(m.lat || '0'));
        const lng = parseFloat(String(m.lng || '0'));
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      });
      
      console.log('🗺️ validMeasurements:', validMeasurements.length);
      
      if (validMeasurements.length === 0) {
        console.log('⚠️ No valid measurements with coordinates, showing simple map');
        this.showSimpleMap(mapContainer);
        return;
      }
      
      const centerLat = validMeasurements.reduce((sum, m) => sum + parseFloat(String(m.lat || '0')), 0) / validMeasurements.length;
      const centerLng = validMeasurements.reduce((sum, m) => sum + parseFloat(String(m.lng || '0')), 0) / validMeasurements.length;
      
      console.log('🗺️ Map center:', [centerLng, centerLat]);
      
      // สร้างแผนที่แบบ MapTiler SDK - ใช้พิกัดจากหน้า measurement
      try {
        this.map = new Map({
          container: mapContainer,
          style: `https://api.maptiler.com/maps/satellite/style.json?key=${environment.mapTilerApiKey}`,
          center: [centerLng, centerLat], // ✅ ใช้พิกัดที่คำนวณได้
          zoom: 17, // ✅ ขยายให้เห็นรายละเอียดของคณะ
          pitch: 0,
          bearing: 0
        });
        
        console.log('🗺️ Map created successfully');
        
        const bounds = new LngLatBounds();
        let hasPoint = false;
        
        // สร้าง markers สำหรับแต่ละจุดวัด
        const markers: any[] = [];
        console.log('🗺️ Creating markers for validMeasurements:', validMeasurements.length);
        validMeasurements.forEach((measurement, index) => {
          // ✅ ใช้พิกัดจริงจาก database แทนพิกัดปลอม
          const lat = parseFloat(String(measurement.lat || '0'));
          const lng = parseFloat(String(measurement.lng || '0'));
          
          console.log(`🗺️ Processing measurement ${index + 1}:`, { 
            lat, 
            lng, 
            measurementid: measurement['measurementid'],
            areasid: measurement['areasid'],
            point_id: measurement['point_id'],
            temperature: measurement['temperature'],
            moisture: measurement['moisture']
          });
          
          // ✅ ตรวจสอบพิกัดจริงจาก database
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            // สร้าง marker แบบ MapTiler SDK
            const marker = new Marker({ 
              color: '#4ecdc4',
              scale: 1.5
            }).setLngLat([lng, lat]).addTo(this.map!);
            
            console.log(`🗺️ Marker ${index + 1} created at:`, [lng, lat]);
            
            // เพิ่ม popup แบบเรียบง่าย - Simple Clean Design
            marker.setPopup(new Popup({
              offset: [0, -15],
              closeButton: true,
              closeOnClick: false,
              maxWidth: '300px',
              className: 'simple-popup'
            }).setHTML(`
                <div style="font-family: Arial, sans-serif; padding: 10px;">
                  <div style="font-weight: bold; margin-bottom: 8px; font-size: 13px;">
                    จุดวัดที่ ${measurement['point_id'] || index + 1}
                  </div>
                  
                  <div style="font-size: 11px; line-height: 1.6;">
                    <div>อุณหภูมิ: ${this.formatNumber(parseFloat(String(measurement['temperature'] || '0')) || 0)}°C</div>
                    <div>ความชื้น: ${this.formatNumber(parseFloat(String(measurement['moisture'] || '0')) || 0)}%</div>
                    <div>pH: ${this.formatNumber(parseFloat(String(measurement['ph'] || '0')) || 0, 1)}</div>
                    <div>ไนโตรเจน: ${this.formatNumber(parseFloat(String(measurement['nitrogen'] || '0')) || 0)}</div>
                    <div>ฟอสฟอรัส: ${this.formatNumber(parseFloat(String(measurement['phosphorus'] || '0')) || 0)}</div>
                    <div>โพแทสเซียม: ${this.formatNumber(parseFloat(String(measurement['potassium'] || '0')) || 0)}</div>
                    
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd;">
                      <div>วันที่: ${measurement['measurement_date'] || 'ไม่ระบุ'}</div>
                      <div>เวลา: ${measurement['measurement_time'] || 'ไม่ระบุ'}</div>
                      <div style="font-size: 10px; color: #666; margin-top: 4px;">
                        ${lat.toFixed(6)}, ${lng.toFixed(6)}
                      </div>
                    </div>
                  </div>
                </div>
              `));
            
            bounds.extend([lng, lat]);
            hasPoint = true;
            markers.push(marker);
            console.log(`🗺️ Marker ${index + 1} added to map`);
          }
        });
        
        // เก็บ reference ของ markers
        this.markers = markers;
        console.log('🗺️ Total markers created:', markers.length);
        
        this.map.once('load', () => {
          console.log('🗺️ Map loaded');
          if (hasPoint) {
            console.log('🗺️ Fitting bounds');
            this.map!.fitBounds(bounds, { padding: 40, maxZoom: 17, duration: 0 });
          }
        });
        
        console.log('🗺️ MapTiler map initialized successfully');
        
      } catch (error) {
        console.error('❌ Error creating map:', error);
        this.showSimpleMap(mapContainer);
      }
      
    }, 100);
  }

  // ✅ ฟังก์ชันแสดงแผนที่ว่าง (เมื่อไม่มี measurements)
  showEmptyMap() {
    console.log('🗺️ showEmptyMap called');
    
    setTimeout(() => {
      const mapContainer = document.querySelector('#mapContainer') as HTMLElement;
      console.log('🗺️ mapContainer for empty map:', mapContainer);
      
      if (!mapContainer) {
        console.log('❌ Map container not found for empty map');
        return;
      }
      
      // ล้างแผนที่เก่า (ถ้ามี)
      mapContainer.innerHTML = '';
      console.log('🗺️ Map container cleared for empty map');
      
      try {
        // สร้างแผนที่แบบ MapTiler SDK - ใช้พิกัดเริ่มต้น
        this.map = new Map({
          container: mapContainer,
          style: `https://api.maptiler.com/maps/satellite/style.json?key=${environment.mapTilerApiKey}`,
          center: [103.25013790, 16.24645040], // ✅ พิกัดเริ่มต้น
          zoom: 15, // ✅ ขยายให้เห็นพื้นที่
          pitch: 0,
          bearing: 0
        });
        
        console.log('🗺️ Empty map created successfully');
        
        // เพิ่มข้อความแจ้งเตือน
        this.map.once('load', () => {
          console.log('🗺️ Empty map loaded');
          
          // สร้าง marker แสดงข้อความแจ้งเตือน
          const infoMarker = new Marker({ 
            color: '#ff9800',
            scale: 1.5
          }).setLngLat([103.25013790, 16.24645040]).addTo(this.map!);
          
          infoMarker.setPopup(new Popup({
            offset: [0, -15],
            closeButton: true,
            closeOnClick: false,
            maxWidth: '300px',
            className: 'info-popup'
          }).setHTML(`
            <div style="font-family: Arial, sans-serif; padding: 15px; text-align: center;">
              <div style="font-weight: bold; margin-bottom: 10px; font-size: 14px; color: #ff9800;">
                <i class="fas fa-info-circle"></i> ไม่มีข้อมูลการวัด
              </div>
              <div style="font-size: 12px; line-height: 1.6; color: #666;">
                <div>พื้นที่: ${this.selectedArea?.areaName || 'ไม่ระบุ'}</div>
                <div>จำนวนจุดวัด: 0 จุด</div>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd;">
                  <div>กรุณาไปที่หน้าวัดค่าเพื่อเพิ่มข้อมูลการวัด</div>
                </div>
              </div>
            </div>
          `));
          
          // เปิด popup โดยอัตโนมัติ
          infoMarker.togglePopup();
        });
        
        console.log('🗺️ Empty map initialized successfully');
        
      } catch (error) {
        console.error('❌ Error creating empty map:', error);
        this.showSimpleMap(mapContainer);
      }
      
    }, 100);
  }

  // ✅ ฟังก์ชันแสดงแผนที่แบบง่าย (เมื่อไม่มี Leaflet)
  showSimpleMap(container: HTMLElement) {
    console.log('🗺️ showSimpleMap called');
    console.log('🗺️ container:', container);
    
    const measurements = this.selectedArea!.measurements;
    console.log('🗺️ measurements for simple map:', measurements);
    
    let mapHtml = '<div style="background: #f0f0f0; padding: 20px; border-radius: 8px;">';
    mapHtml += '<h4>จุดวัดในพื้นที่</h4>';
    
    if (measurements.length === 0) {
      mapHtml += '<p>ไม่มีข้อมูลการวัดในพื้นที่นี้</p>';
    } else {
      measurements.forEach((measurement, index) => {
        console.log(`🗺️ Processing measurement ${index + 1} for simple map:`, measurement);
        
        if (measurement.lat && measurement.lng) {
          mapHtml += `
            <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 5px; border-left: 4px solid #4CAF50;">
              <strong>จุดที่ ${measurement.measurementPoint || index + 1}</strong><br>
              <small>พิกัด: ${measurement.lat}, ${measurement.lng}</small><br>
              <small>วันที่: ${measurement['measurement_date'] || measurement.date || 'ไม่ระบุ'}</small><br>
              <small>อุณหภูมิ: ${this.formatNumber(parseFloat(String(measurement.temperature || '0')) || 0)}°C</small><br>
              <small>ความชื้น: ${this.formatNumber(parseFloat(String(measurement.moisture || '0')) || 0)}%</small>
            </div>
          `;
        } else {
          mapHtml += `
            <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 5px; border-left: 4px solid #ff9800;">
              <strong>จุดที่ ${measurement.measurementPoint || index + 1}</strong><br>
              <small>ไม่มีข้อมูลพิกัด</small><br>
              <small>วันที่: ${measurement['measurement_date'] || measurement.date || 'ไม่ระบุ'}</small>
            </div>
          `;
        }
      });
    }
    
    mapHtml += '</div>';
    container.innerHTML = mapHtml;
    console.log('🗺️ Simple map HTML set');
  }
  
  // ✅ คำนวณพื้นที่จาก polygon bounds
  calculateAreaFromBounds(bounds: [number, number][]): number {
    if (bounds.length < 3) return 0;
    
    // ใช้ Shoelace formula
    let area = 0;
    const n = bounds.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += bounds[i][0] * bounds[j][1];
      area -= bounds[j][0] * bounds[i][1];
    }
    area = Math.abs(area) / 2;
    
    // แปลงจาก degrees เป็น meters
    const latToMeters = 111000;
    const lngToMeters = 111000 * Math.cos(bounds[0][1] * Math.PI / 180);
    const areaInSquareMeters = area * latToMeters * lngToMeters;
    
    // แปลงเป็นไร่ (1 ไร่ = 1,600 ตารางเมตร)
    return areaInSquareMeters / 1600;
  }
  
  // ✅ แปลงพื้นที่เป็นหน่วยไทย
  formatAreaToThaiUnits(areaInRai: number): string {
    if (areaInRai === 0) return '0.00 ไร่';
    
    const rai = Math.floor(areaInRai);
    const remainingArea = (areaInRai - rai) * 1600;
    const ngan = Math.floor(remainingArea / 400);
    const remainingAfterNgan = remainingArea % 400;
    const squareWa = Math.floor(remainingAfterNgan / 4);
    const squareMeters = Math.round(remainingAfterNgan % 4);
    
    let result = '';
    if (rai > 0) result += `${rai} ไร่`;
    if (ngan > 0) result += (result ? ' ' : '') + `${ngan} งาน`;
    if (squareWa > 0) result += (result ? ' ' : '') + `${squareWa} ตารางวา`;
    if (squareMeters > 0) result += (result ? ' ' : '') + `${squareMeters} ตารางเมตร`;
    
    return result || '0.00 ไร่';
  }


  // ✅ คำนวณค่าเฉลี่ยจาก measurements จริง
  calculateAveragesFromMeasurements(measurements: any[]): {
    temperature: number;
    moisture: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    ph: number;
  } {
    if (measurements.length === 0) {
      return {
        temperature: 0,
        moisture: 0,
        nitrogen: 0,
        phosphorus: 0,
        potassium: 0,
        ph: 0
      };
    }

    const totals = measurements.reduce((acc, measurement) => ({
      temperature: acc.temperature + (measurement.temperature || 0),
      moisture: acc.moisture + (measurement.moisture || 0),
      nitrogen: acc.nitrogen + (measurement.nitrogen || 0),
      phosphorus: acc.phosphorus + (measurement.phosphorus || 0),
      potassium: acc.potassium + (measurement.potassium || 0),
      ph: acc.ph + (measurement.ph || 0)
    }), { temperature: 0, moisture: 0, nitrogen: 0, phosphorus: 0, potassium: 0, ph: 0 });

    const count = measurements.length;
    return {
      temperature: totals.temperature / count,
      moisture: totals.moisture / count,
      nitrogen: totals.nitrogen / count,
      phosphorus: totals.phosphorus / count,
      potassium: totals.potassium / count,
      ph: totals.ph / count
    };
  }

  // ✅ ฟังก์ชันทดสอบข้อมูล measurements
  testMeasurementsData() {
    console.log('🧪 Testing measurements data...');
    console.log('🧪 selectedArea:', this.selectedArea);
    
    if (this.selectedArea && this.selectedArea.measurements) {
      console.log('🧪 measurements count:', this.selectedArea.measurements.length);
      this.selectedArea.measurements.forEach((measurement, index) => {
        console.log(`🧪 Measurement ${index + 1}:`, {
          measurementid: measurement['measurementid'],
          id: measurement['id'],
          measurement_id: measurement['measurement_id'],
          areasid: measurement['areasid'],
          point_id: measurement['point_id'],
          lat: measurement['lat'],
          lng: measurement['lng'],
          temperature: measurement['temperature'],
          moisture: measurement['moisture'],
          ph: measurement['ph'],
          nitrogen: measurement['nitrogen'],
          phosphorus: measurement['phosphorus'],
          potassium: measurement['potassium'],
          measurement_date: measurement['measurement_date'],
          measurement_time: measurement['measurement_time']
        });
      });
    } else {
      console.log('🧪 No measurements data found');
    }
  }

  // ✅ แสดงช่วง Measurement ID
  getMeasurementIdRange(area: AreaGroup): string {
    console.log('🔍 getMeasurementIdRange called for area:', area.areasid);
    console.log('🔍 area.measurements:', area.measurements);
    
    if (!area.measurements || area.measurements.length === 0) {
      console.log('⚠️ No measurements found');
      return 'ไม่มีข้อมูล';
    }

    const measurementIds = area.measurements
      .map(m => {
        console.log('🔍 Processing measurement:', m);
        const id = m['measurementid'] || m['id'] || m['measurement_id'];
        console.log('🔍 Found ID:', id);
        console.log('🔍 Measurement object keys:', Object.keys(m));
        console.log('🔍 Measurement object values:', Object.values(m));
        return id;
      })
      .filter(id => id != null && id !== 'null' && id !== 'undefined' && id !== '')
      .sort((a, b) => Number(a) - Number(b));

    console.log('🔍 Filtered measurement IDs:', measurementIds);

    if (measurementIds.length === 0) {
      console.log('⚠️ No valid measurement IDs found');
      return 'ไม่มี ID';
    }

    if (measurementIds.length === 1) {
      console.log('✅ Single measurement ID:', measurementIds[0]);
      return measurementIds[0].toString();
    }

    const minId = measurementIds[0];
    const maxId = measurementIds[measurementIds.length - 1];
    
    if (minId === maxId) {
      console.log('✅ Same measurement ID:', minId);
      return minId.toString();
    }

    console.log('✅ Measurement ID range:', `${minId}-${maxId}`);
    return `${minId}-${maxId}`;
  }
}
