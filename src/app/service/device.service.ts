import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface SelectedDeviceData {
  deviceId: string;
  deviceName: string;
  deviceStatus: 'online' | 'offline';
  deviceType?: boolean;
  lastUpdated: string;
}

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private selectedDeviceSubject = new BehaviorSubject<SelectedDeviceData | null>(null);
  public selectedDevice$ = this.selectedDeviceSubject.asObservable();

  constructor() {
    // โหลดข้อมูลอุปกรณ์จาก localStorage เมื่อเริ่มต้น service
    this.loadSelectedDeviceFromStorage();
  }

  // เก็บข้อมูลอุปกรณ์ที่เลือกใน localStorage และ BehaviorSubject
  setSelectedDevice(deviceData: SelectedDeviceData | null): void {
    if (deviceData) {
      // อัปเดต timestamp
      deviceData.lastUpdated = new Date().toISOString();
      
      // เก็บใน localStorage
      localStorage.setItem('selectedDeviceId', deviceData.deviceId);
      localStorage.setItem('selectedDevice', JSON.stringify(deviceData));
      
      console.log('💾 Device data saved to localStorage via DeviceService:', deviceData);
    } else {
      // ลบข้อมูลจาก localStorage
      localStorage.removeItem('selectedDeviceId');
      localStorage.removeItem('selectedDevice');
      
      console.log('🗑️ Device data removed from localStorage via DeviceService');
    }

    // อัปเดต BehaviorSubject เพื่อแจ้งให้ components อื่นทราบ
    this.selectedDeviceSubject.next(deviceData);
  }

  // ดึงข้อมูลอุปกรณ์ที่เลือกจาก localStorage
  getSelectedDevice(): SelectedDeviceData | null {
    try {
      const deviceData = localStorage.getItem('selectedDevice');
      if (deviceData) {
        const parsed = JSON.parse(deviceData);
        
        // ตรวจสอบว่าข้อมูลไม่เก่าเกินไป (เก่ากว่า 1 ชั่วโมง)
        const lastUpdated = new Date(parsed.lastUpdated);
        const now = new Date();
        const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff > 1) {
          console.log('⚠️ Device data is too old, removing from localStorage');
          this.setSelectedDevice(null);
          return null;
        }
        
        return parsed;
      }
    } catch (error) {
      console.error('❌ Error parsing device data from localStorage:', error);
      // ลบข้อมูลที่เสียหายออก
      this.setSelectedDevice(null);
    }
    
    return null;
  }

  // ดึงเฉพาะ deviceId จาก localStorage (สำหรับ backward compatibility)
  getSelectedDeviceId(): string | null {
    return localStorage.getItem('selectedDeviceId');
  }

  // โหลดข้อมูลอุปกรณ์จาก localStorage และอัปเดต BehaviorSubject
  private loadSelectedDeviceFromStorage(): void {
    const deviceData = this.getSelectedDevice();
    this.selectedDeviceSubject.next(deviceData);
  }

  // อัปเดตสถานะอุปกรณ์
  updateDeviceStatus(status: 'online' | 'offline'): void {
    const currentDevice = this.selectedDeviceSubject.value;
    if (currentDevice) {
      const updatedDevice = {
        ...currentDevice,
        deviceStatus: status,
        lastUpdated: new Date().toISOString()
      };
      this.setSelectedDevice(updatedDevice);
    }
  }

  // ตรวจสอบว่ามีอุปกรณ์ที่เลือกหรือไม่
  hasSelectedDevice(): boolean {
    return this.selectedDeviceSubject.value !== null;
  }

  // ดึงข้อมูลอุปกรณ์ปัจจุบันแบบ synchronous
  getCurrentDevice(): SelectedDeviceData | null {
    return this.selectedDeviceSubject.value;
  }

  // เคลียร์ข้อมูลอุปกรณ์ทั้งหมด
  clearSelectedDevice(): void {
    this.setSelectedDevice(null);
  }
}
