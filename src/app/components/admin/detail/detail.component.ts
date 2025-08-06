import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { Database, ref, onValue } from '@angular/fire/database';
import { Map, Marker, LngLatBounds, config } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { environment } from '../../../service/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSpinner } from '@angular/material/progress-spinner';

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
  styleUrl: './detail.component.scss'
})
export class DetailComponent implements OnInit, AfterViewInit, OnDestroy {
  device: any = null;
  measurements: Measurement[] = [];
  isLoading = false;
  map: Map | undefined;
  @ViewChild('mapContainer') private mapContainer!: ElementRef<HTMLElement>;

  constructor(private router: Router, private db: Database) {
    config.apiKey = environment.mapTilerApiKey;
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

  loadMeasurements() {
    if (!this.device?.id) return;
    this.isLoading = true;
    const measurementRef = ref(this.db, `measurements/${this.device.id}`);
    onValue(
      measurementRef,
      snapshot => {
        const data = snapshot.val();
        if (data) {
          this.measurements = Object.entries(data).map(([key, value]: [string, any]) => ({
            id: key,
            location: value.location || 'ไม่ระบุสถานที่',
            date: value.date || new Date().toISOString().split('T')[0],
            temperature: value.temperature || 0,
            moisture: value.moisture || 0,
            nitrogen: value.nitrogen || 0,
            phosphorus: value.phosphorus || 0,
            potassium: value.potassium || 0,
            ph: value.ph || 0,
            lat: value.lat,
            lng: value.lng,
            measurementPoint: value.measurementPoint
          }));
        } else {
          this.measurements = [];
        }
        this.isLoading = false;
        if (this.map) {
          this.addMeasurementMarkers();
          this.fitMapToBounds();
        }
      },
      error => {
        console.error('ข้อผิดพลาดในการโหลดการวัด:', error);
        this.measurements = [];
        this.isLoading = false;
      }
    );
  }

  initializeMap() {
    if (!this.mapContainer) {
      console.log('Map container not available');
      return;
    }

    try {
      this.map = new Map({
        container: this.mapContainer.nativeElement,
        style: 'satellite',
        center: [100.5018, 13.7563], // Default center (Bangkok, Thailand)
        zoom: 10
      });

      this.map.on('load', () => {
        this.addMeasurementMarkers();
        this.fitMapToBounds();
      });

      this.map.on('error', (error) => {
        console.error('Map error:', error);
        this.mapContainer.nativeElement.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f5f5f5; color: #666;">
            <p>ไม่สามารถโหลดแผนที่ได้</p>
          </div>
        `;
      });
    } catch (error) {
      console.error('Error initializing map:', error);
      this.mapContainer.nativeElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f5f5f5; color: #666;">
          <p>ไม่สามารถโหลดแผนที่ได้</p>
        </div>
      `;
    }
  }

  addMeasurementMarkers() {
    if (!this.map) return;

    const validMeasurements = this.measurements.filter(m => 
      m.lat !== undefined && m.lng !== undefined && 
      !isNaN(m.lat) && !isNaN(m.lng)
    );

    validMeasurements.forEach((measurement, index) => {
      const markerElement = document.createElement('div');
      markerElement.style.backgroundColor = '#FF4444';
      markerElement.style.color = 'white';
      markerElement.style.width = '30px';
      markerElement.style.height = '30px';
      markerElement.style.borderRadius = '50%';
      markerElement.style.display = 'flex';
      markerElement.style.alignItems = 'center';
      markerElement.style.justifyContent = 'center';
      markerElement.style.fontSize = '12px';
      markerElement.style.fontWeight = 'bold';
      markerElement.style.border = '3px solid white';
      markerElement.style.cursor = 'pointer';
      markerElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      markerElement.textContent = (measurement.measurementPoint || (index + 1)).toString();

      const marker = new Marker({ element: markerElement })
        .setLngLat([measurement.lng!, measurement.lat!])
        .addTo(this.map!);

      markerElement.addEventListener('click', () => {
        this.showMeasurementPopup(measurement);
      });
    });
  }

  fitMapToBounds() {
    if (!this.map || this.measurements.length === 0) return;

    const validMeasurements = this.measurements.filter(m => 
      m.lat !== undefined && m.lng !== undefined && 
      !isNaN(m.lat) && !isNaN(m.lng)
    );

    if (validMeasurements.length === 0) {
      this.mapContainer.nativeElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f5f5f5; color: #666;">
          <p>ไม่พบข้อมูลตำแหน่งของจุดวัด</p>
        </div>
      `;
      return;
    }

    const lats = validMeasurements.map(m => m.lat!);
    const lngs = validMeasurements.map(m => m.lng!);

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