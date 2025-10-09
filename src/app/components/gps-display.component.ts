import { Component, OnInit } from '@angular/core';
import { GpsService, GPSData } from '../service/gps.service';
import { DeviceService } from '../service/device.service';

declare const maplibregl: any;

@Component({
  selector: 'app-gps-display',
  template: `
    <div class="gps-container">
      <h2>📍 GPS Location</h2>
      
      <div *ngIf="gpsData" class="gps-info">
        <div class="coordinates">
          <h3>🗺️ Coordinates</h3>
          <p><strong>Latitude:</strong> {{ gpsData.coordinates.lat | number:'1.6-6' }}</p>
          <p><strong>Longitude:</strong> {{ gpsData.coordinates.lng | number:'1.6-6' }}</p>
        </div>
        
        <div class="measurement">
          <h3>📊 Latest Measurement</h3>
          <p><strong>Date:</strong> {{ gpsData.measurement.date }}</p>
          <p><strong>Time:</strong> {{ gpsData.measurement.time }}</p>
          <p><strong>Temperature:</strong> {{ gpsData.measurement.temperature }}°C</p>
          <p><strong>Moisture:</strong> {{ gpsData.measurement.moisture }}%</p>
          <p><strong>pH:</strong> {{ gpsData.measurement.ph }}</p>
        </div>
        
        <div class="map-container">
          <h3>🗺️ Map View</h3>
          <div id="map" class="map"></div>
        </div>
      </div>
      
      <div *ngIf="!gpsData && !loading" class="no-data">
        <p>❌ No GPS coordinates available</p>
        <p>Make sure the device has GPS signal and has sent measurements</p>
      </div>
      
      <div *ngIf="loading" class="loading">
        <p>⏳ Loading GPS data...</p>
      </div>
    </div>
  `,
  styles: [`
    .gps-container {
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    .gps-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 20px;
    }
    
    .coordinates, .measurement {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #007bff;
    }
    
    .map-container {
      grid-column: 1 / -1;
      margin-top: 20px;
    }
    
    .map {
      width: 100%;
      height: 400px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }
    
    .no-data, .loading {
      text-align: center;
      padding: 40px;
      color: #666;
    }
    
    h2, h3 {
      color: #333;
      margin-bottom: 10px;
    }
    
    p {
      margin: 5px 0;
    }
  `]
})
export class GpsDisplayComponent implements OnInit {
  gpsData: GPSData | null = null;
  loading = false;

  constructor(
    private gpsService: GpsService,
    private deviceService: DeviceService
  ) { }

  ngOnInit() {
    this.loadGPSData();
  }

  loadGPSData() {
    this.loading = true;
    
    // Get current device from device service
    const currentDevice = this.deviceService.getCurrentDevice();
    if (currentDevice && currentDevice.deviceName) {
      this.gpsService.getDeviceGPS(currentDevice.deviceName).subscribe({
        next: (data) => {
          this.gpsData = data;
          this.loading = false;
          this.initMap();
        },
        error: (error) => {
          console.error('Error loading GPS data:', error);
          this.loading = false;
        }
      });
    } else {
      this.loading = false;
    }
  }

  initMap() {
    if (!this.gpsData) return;
    
    // Initialize MapTiler map
    const map = new maplibregl.Map({
      container: 'map',
      style: 'https://api.maptiler.com/maps/streets/style.json?key=gMPRNdZ7nFG7TFsWmEQr',
      center: [this.gpsData.coordinates.lng, this.gpsData.coordinates.lat],
      zoom: 15
    });
    
    // Add marker
    new maplibregl.Marker({
      color: '#ff0000'
    })
    .setLngLat([this.gpsData.coordinates.lng, this.gpsData.coordinates.lat])
    .addTo(map);
    
    // Add popup
    const popup = new maplibregl.Popup()
      .setHTML(`
        <div>
          <h4>📍 ${this.gpsData.deviceName}</h4>
          <p><strong>Coordinates:</strong> ${this.gpsData.coordinates.lat}, ${this.gpsData.coordinates.lng}</p>
          <p><strong>Last Measurement:</strong> ${this.gpsData.measurement.date}</p>
          <p><strong>Temperature:</strong> ${this.gpsData.measurement.temperature}°C</p>
          <p><strong>Moisture:</strong> ${this.gpsData.measurement.moisture}%</p>
          <p><strong>pH:</strong> ${this.gpsData.measurement.ph}</p>
        </div>
      `);
    
    new maplibregl.Marker({
      color: '#ff0000'
    })
    .setLngLat([this.gpsData.coordinates.lng, this.gpsData.coordinates.lat])
    .setPopup(popup)
    .addTo(map);
  }
}