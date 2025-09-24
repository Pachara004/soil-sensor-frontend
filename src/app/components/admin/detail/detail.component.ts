import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Constants } from '../../../config/constants'; // ปรับ path ตามโครงสร้าง
import { Map, Marker, LngLatBounds, config } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { environment } from '../../../service/environment'; // ใช้ path มาตรฐานของ Angular
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSpinner } from '@angular/material/progress-spinner';

interface Measurement {
  id: number;
  location: string;
  date: string;
  temperature?: number;
  moisture?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  ph?: number;
  lat?: number;
  lng?: number;
  measurementPoint?: number;
  [key: string]: any;
}

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSpinner],
  templateUrl: './detail.component.html',
  styleUrl: './detail.component.scss',
})
export class DetailComponent implements OnInit, AfterViewInit, OnDestroy {
  device: any = null;
  measurements: Measurement[] = [];
  isLoading = false;
  map: Map | undefined;
  @ViewChild('mapContainer') private mapContainer!: ElementRef<HTMLElement>;
  private apiUrl: string;

  constructor(
    private router: Router,
    private http: HttpClient,
    private constants: Constants // Inject Constants
  ) {
    config.apiKey = environment.mapTilerApiKey;
    this.apiUrl = this.constants.API_ENDPOINT; // ใช้ instance ของ Constants
  }

  ngOnInit(): void {
    const savedDevice = localStorage.getItem('selectedDevice');
    if (savedDevice) {
      this.device = JSON.parse(savedDevice);
      this.loadMeasurements();
    } else {
      alert('ไม่พบข้อมูลอุปกรณ์');
      this.router.navigate(['/adminmain']);
    }
  }

  ngAfterViewInit() {
    this.initializeMap();
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  async loadMeasurements() {
    if (!this.device?.id) return;
    this.isLoading = true;
    try {
      const response = await this.http
        .get<Measurement[]>(`${this.apiUrl}/api/measurements/${this.device.id}`)
        .toPromise();
      this.measurements = response || [];
      this.isLoading = false;
      this.initializeMap();
      this.fitMapToBounds();
    } catch (error) {
      console.error('Error loading measurements:', error);
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูลวัด');
      this.isLoading = false;
    }
  }

  initializeMap() {
    if (!this.mapContainer) return;
    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: 'streets-v2',
      center: [100.5018, 13.7563], // ค่าเริ่มต้น (กรุงเทพ)
      zoom: 10,
    });
  }

  fitMapToBounds() {
    if (!this.map || this.measurements.length === 0) return;

    const validMeasurements = this.measurements.filter(
      (m) =>
        m.lat !== undefined &&
        m.lng !== undefined &&
        !isNaN(m.lat) &&
        !isNaN(m.lng)
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

  showMeasurementPopup(measurement: Measurement) {
    const details = `จุดที่: ${measurement.measurementPoint || 'ไม่ระบุ'}
วันที่: ${measurement.date}
อุณหภูมิ: ${measurement.temperature}°C
ความชื้น: ${measurement.moisture}%
ไนโตรเจน: ${measurement.nitrogen} mg/kg
ฟอสฟอรัส: ${measurement.phosphorus} mg/kg
โพแทสเซียม: ${measurement.potassium} mg/kg
pH: ${measurement.ph}
ตำแหน่ง: ${measurement.location}`;

    alert(details);
  }

  goBack() {
    this.router.navigate(['/adminmain']);
  }
}
