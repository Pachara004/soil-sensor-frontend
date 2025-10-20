import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Constants } from '../config/constants';
import { catchError, throwError } from 'rxjs'; // เพิ่มสำหรับจัดการ error
import { Auth } from '@angular/fire/auth';
interface Device {
  id?: string;
  deviceid?: string;
  display_name?: string;
  name?: string;
  status?: string;
  user_id?: number;
  userid?: number;
  created_at?: string;
  [key: string]: any; // ✅ เพิ่มเพื่อรองรับ fields อื่นๆ
}
interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  phone_number: string;
  type: string;
}
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly apiUrl: string;
  constructor(
    private http: HttpClient, 
    private constants: Constants,
    private auth: Auth // ✅ เพิ่ม Auth service
  ) {
    this.apiUrl = this.constants.API_ENDPOINT; // ใช้ instance ของ Constants
  }
  // ✅ ฟังก์ชันช่วยสร้าง headers พร้อม Authorization
  private async getAuthHeaders(): Promise<HttpHeaders> {
    const user = this.auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      return new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });
    }
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }
  async getDevices(): Promise<Device[]> {
    try {
      const headers = await this.getAuthHeaders();
      const result = await this.http
        .get<any>(`${this.apiUrl}/api/admin/devices`, { headers })
        .pipe(
          catchError((error) => {
            console.error('❌ Error fetching devices:', error);
            return throwError(() => new Error('Failed to fetch devices'));
          })
        )
        .toPromise();
      // ✅ ตรวจสอบรูปแบบ response และดึง devices array
      let devicesArray: Device[] = [];
      if (Array.isArray(result)) {
        // ถ้า result เป็น array โดยตรง
        devicesArray = result;
      } else if (result && Array.isArray(result.devices)) {
        // ถ้า result มี property devices ที่เป็น array
        devicesArray = result.devices;
      } else if (result && Array.isArray(result.data)) {
        // ถ้า result มี property data ที่เป็น array
        devicesArray = result.data;
      } else {
        return [];
      }
      console.log('📋 Devices data:', devicesArray);
      return devicesArray;
    } catch (error) {
      console.error('❌ getDevices() failed:', error);
      return []; // ส่งคืน array ว่างเมื่อเกิด error
    }
  }
  async addDevice(deviceName: string, user: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    return this.http
      .post(`${this.apiUrl}/api/devices`, { 
        deviceId: deviceName,
        device_name: deviceName,
        user: user,
        status: 'offline', // ✅ ตั้งสถานะเป็น offline สำหรับอุปกรณ์ทั่วไป
        device_type: true, // ✅ true = production device
        description: 'อุปกรณ์ทั่วไป'
      }, { headers })
      .pipe(
        catchError((error) => {
          console.error('Error adding device:', error);
          return throwError(() => new Error('Failed to add device'));
        })
      )
      .toPromise()
      .then(() => {}); // คืนค่า void
  }
  async deleteDevice(deviceName: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    return this.http
      .delete(`${this.apiUrl}/api/devices/${deviceName}`, { headers })
      .pipe(
        catchError((error) => {
          console.error('Error deleting device:', error);
          return throwError(() => new Error('Failed to delete device'));
        })
      )
      .toPromise()
      .then(() => {}); // คืนค่า void
  }
  async getAllUsers(): Promise<User[]> {
    try {
      const headers = await this.getAuthHeaders();
      const result = await this.http
        .get<any>(`${this.apiUrl}/api/users`, { headers })
        .pipe(
          catchError((error) => {
            console.error('❌ Error fetching users:', error);
            return throwError(() => new Error('Failed to fetch users'));
          })
        )
        .toPromise();
      // ✅ ตรวจสอบรูปแบบ response และดึง users array
      let usersArray: User[] = [];
      if (Array.isArray(result)) {
        // ถ้า result เป็น array โดยตรง
        usersArray = result;
      } else if (result && Array.isArray(result.users)) {
        // ถ้า result มี property users ที่เป็น array
        usersArray = result.users;
      } else if (result && Array.isArray(result.data)) {
        // ถ้า result มี property data ที่เป็น array
        usersArray = result.data;
      } else {
        return [];
      }
      console.log('📋 Users data:', usersArray);
      return usersArray;
    } catch (error) {
      console.error('❌ getAllUsers() failed:', error);
      return []; // ส่งคืน array ว่างเมื่อเกิด error
    }
  }
  // ✅ ฟังก์ชันดึงข้อมูล users เฉพาะ role = 'user'
  async getRegularUsers(): Promise<User[]> {
    try {
      const headers = await this.getAuthHeaders();
      const result = await this.http
        .get<any>(`${this.apiUrl}/api/users/regular`, { headers })
        .pipe(
          catchError((error) => {
            console.error('❌ Error fetching regular users:', error);
            return throwError(() => new Error('Failed to fetch regular users'));
          })
        )
        .toPromise();
      // ✅ ตรวจสอบรูปแบบ response และดึง users array
      let usersArray: User[] = [];
      if (Array.isArray(result)) {
        // ถ้า result เป็น array โดยตรง
        usersArray = result;
      } else if (result && Array.isArray(result.users)) {
        // ถ้า result มี property users ที่เป็น array
        usersArray = result.users;
      } else if (result && Array.isArray(result.data)) {
        // ถ้า result มี property data ที่เป็น array
        usersArray = result.data;
      } else {
        return [];
      }
      console.log('📋 Regular users data:', usersArray);
      return usersArray;
    } catch (error) {
      console.error('❌ getRegularUsers() failed:', error);
      return []; // ส่งคืน array ว่างเมื่อเกิด error
    }
  }
  async updateUser(username: string, updateData: any): Promise<void> {
    const headers = await this.getAuthHeaders();
    return this.http
      .put(`${this.apiUrl}/api/users/${username}`, updateData, { headers })
      .pipe(
        catchError((error) => {
          console.error('Error updating user:', error);
          return throwError(() => new Error('Failed to update user'));
        })
      )
      .toPromise()
      .then(() => {}); // คืนค่า void
  }
  async deleteUser(username: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    return this.http
      .delete(`${this.apiUrl}/api/users/${username}`, { headers })
      .pipe(
        catchError((error) => {
          console.error('Error deleting user:', error);
          return throwError(() => new Error('Failed to delete user'));
        })
      )
      .toPromise()
      .then(() => {}); // คืนค่า void
  }
}
