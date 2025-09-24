import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Constants } from '../config/constants';
import { catchError, throwError } from 'rxjs'; // เพิ่มสำหรับจัดการ error

interface Device {
  id: string;
  display_name: string;
  status: string;
  user_id: number;
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

  constructor(private http: HttpClient, private constants: Constants) {
    this.apiUrl = this.constants.API_ENDPOINT; // ใช้ instance ของ Constants
  }

  getDevices(): Promise<Device[]> {
    return this.http
      .get<Device[]>(`${this.apiUrl}/api/admin/devices`)
      .pipe(
        catchError((error) => {
          console.error('Error fetching devices:', error);
          return throwError(() => new Error('Failed to fetch devices'));
        })
      )
      .toPromise()
      .then((res) => res || []); // รับรองว่าได้ array ว่างถ้าไม่มีข้อมูล
  }

  addDevice(deviceName: string, user: string): Promise<void> {
    return this.http
      .post(`${this.apiUrl}/api/admin/devices`, { deviceName, user })
      .pipe(
        catchError((error) => {
          console.error('Error adding device:', error);
          return throwError(() => new Error('Failed to add device'));
        })
      )
      .toPromise()
      .then(() => {}); // คืนค่า void
  }

  deleteDevice(deviceName: string): Promise<void> {
    return this.http
      .delete(`${this.apiUrl}/api/admin/devices/${deviceName}`)
      .pipe(
        catchError((error) => {
          console.error('Error deleting device:', error);
          return throwError(() => new Error('Failed to delete device'));
        })
      )
      .toPromise()
      .then(() => {}); // คืนค่า void
  }

  getAllUsers(): Promise<User[]> {
    return this.http
      .get<User[]>(`${this.apiUrl}/api/admin/users`)
      .pipe(
        catchError((error) => {
          console.error('Error fetching users:', error);
          return throwError(() => new Error('Failed to fetch users'));
        })
      )
      .toPromise()
      .then((res) => res || []); // รับรองว่าได้ array ว่างถ้าไม่มีข้อมูล
  }

  updateUser(username: string, updateData: any): Promise<void> {
    return this.http
      .put(`${this.apiUrl}/api/admin/users/${username}`, updateData)
      .pipe(
        catchError((error) => {
          console.error('Error updating user:', error);
          return throwError(() => new Error('Failed to update user'));
        })
      )
      .toPromise()
      .then(() => {}); // คืนค่า void
  }

  deleteUser(username: string): Promise<void> {
    return this.http
      .delete(`${this.apiUrl}/api/admin/users/${username}`)
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
