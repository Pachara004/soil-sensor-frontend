import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Map, Marker, config, LngLatBounds } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { environment } from '../../../service/environment';
import { Constants } from '../../../config/constants';

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
  areaId?: string;
  measurementPoint?: number;
  lat?: number;
  lng?: number;
  [key: string]: any;
}

interface AreaGroup {
  areaId: string;
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
  amount: string;
  description: string;
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
  deviceId: string | null = null;
  devices: string[] = [];
  areas: AreaGroup[] = [];
  areaGroups: AreaGroup[] = [];
  selectedArea: AreaGroup | null = null;
  showAreaDetails = false;
  isLoading = true;
  map: Map | undefined;
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLElement>;
  private apiUrl: string;

  constructor(
    private router: Router,
    private location: Location,
    private http: HttpClient,
    private constants: Constants
  ) {
    this.apiUrl = this.constants.API_ENDPOINT;
    config.apiKey = environment.mapTilerApiKey;
  }

  ngOnInit(): void {
    const userData =
      localStorage.getItem('user') || localStorage.getItem('admin');
    if (userData) {
      const user: UserData = JSON.parse(userData);
      this.username = user.username;
      this.deviceId = Object.keys(user.devices || {})[0] || null;
      this.devices = Object.keys(user.devices || {});
    }
    // Minimal stub data to avoid template errors
    this.areaGroups = [];
    this.loadAreas();
  }

  ngAfterViewInit() {
    this.initializeMap();
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  onDeviceChange() {
    // no-op stub; would reload data for selected device
  }

  async loadAreas() {
    this.isLoading = true;
    try {
      const response = await this.http
        .get<{ [key: string]: AreaGroup }>(
          `${this.apiUrl}/api/measurements/areas`
        )
        .toPromise();
      const list = Object.values(response || {}).map((area) => ({
        ...area,
        measurements: area.measurements || [],
      }));
      this.areas = list;
      this.areaGroups = list;
      this.isLoading = false;
    } catch (error) {
      console.error('Error loading areas:', error);
      this.isLoading = false;
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

  viewAreaDetails(area: AreaGroup) {
    this.selectedArea = area;
    this.showAreaDetails = true;
    this.initializeMap();
    this.fitMapToBounds();
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
      • อุณหภูมิ: ${stats.temperature}°C
      • ความชื้น: ${stats.moisture}%
      • ไนโตรเจน: ${stats.nitrogen} mg/kg
      • ฟอสฟอรัส: ${stats.phosphorus} mg/kg
      • โพแทสเซียม: ${stats.potassium} mg/kg
      • ค่า pH: ${stats.ph}`;
    alert(message);
  }

  viewMeasurementDetail(item: Measurement) {
    const measurementData = { ...item, deviceId: this.deviceId };
    localStorage.setItem('selectedMeasurement', JSON.stringify(measurementData));
    this.router.navigate(['/history-detail']);
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
}
