import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environment';

export interface GPSCoordinates {
  lng: number;
  lat: number;
}

export interface GPSMeasurement {
  date: string;
  time: string;
  temperature: number;
  moisture: number;
  ph: number;
  phosphorus?: number;
  potassium?: number;
  nitrogen?: number;
}

export interface GPSData {
  deviceName: string;
  coordinates: GPSCoordinates;
  measurement: GPSMeasurement;
  lastUpdated: string;
}

export interface GPSHistory {
  deviceName: string;
  coordinates: Array<{
    coordinates: GPSCoordinates;
    measurement: GPSMeasurement;
    timestamp: string;
  }>;
  count: number;
}

@Injectable({
  providedIn: 'root'
})
export class GpsService {
  private apiUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) { }

  // Get GPS coordinates for a specific device
  getDeviceGPS(deviceName: string): Observable<GPSData> {
    return this.http.get<GPSData>(`${this.apiUrl}/api/gps/device/${deviceName}`);
  }

  // Get GPS history for a device
  getDeviceGPSHistory(deviceName: string, limit: number = 50): Observable<GPSHistory> {
    return this.http.get<GPSHistory>(`${this.apiUrl}/api/gps/device/${deviceName}/history?limit=${limit}`);
  }

  // Get all devices with GPS coordinates
  getAllDevicesGPS(): Observable<{ devices: GPSData[], count: number }> {
    return this.http.get<{ devices: GPSData[], count: number }>(`${this.apiUrl}/api/gps/devices`);
  }
}
