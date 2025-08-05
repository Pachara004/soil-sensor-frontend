import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Database, ref, onValue, push, get } from '@angular/fire/database';
import { Map, Marker, config, LngLatBounds } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { environment } from '../../../service/environment';
import { HttpClient } from '@angular/common/http';

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
  location: string;
  lat: number;
  lng: number;
  date: string;
  timestamp: number;
  locationNameType?: 'custom' | 'auto';
  customLocationName?: string | null;
  autoLocationName?: string | null;
  areaId?: string; // เพิ่ม areaId เพื่อกลุ่มข้อมูลตามพื้นที่
  measurementPoint?: number; // ลำดับจุดที่วัดในพื้นที่นี้
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

@Component({
  selector: 'app-measure',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './measure.component.html',
  styleUrl: './measure.component.scss'
})
export class MeasureComponent implements OnInit, AfterViewInit, OnDestroy {
  customLocationName: string = ''; // ชื่อสถานที่ที่ผู้ใช้ตั้งเอง
  autoLocationName: string = ''; // ชื่อสถานที่จาก API geocoding
  useCustomName: boolean = false; // เลือกว่าจะใช้ชื่อที่ตั้งเองหรือชื่อจาก API
  locationDetail: string = '';
  username: string = '';
  deviceId: string = '';
  devices: string[] = [];
  temperature: number = 0;
  moisture: number = 0;
  nitrogen: number = 0;
  phosphorus: number = 0;
  potassium: number = 0;
  ph: number = 0;
  isLoading = false;
  map: Map | undefined; // แผนที่หลักสำหรับวัด
  popupMap: Map | undefined; // แผนที่ใน popup สำหรับเลือก 4 จุด
  initialLat = 13.7563; // กรุงเทพฯ
  initialLng = 100.5018;
  bounds: LngLatBounds | null = null; // Keep for backward compatibility but use polygon for actual area
  polygonBounds: [number, number][] = []; // Actual polygon boundary points
  points: [number, number][] = []; // เก็บจุดทั้งหมดที่ผู้ใช้เลือก (lat, lng)
  showPopup = false; // ควบคุมการแสดง popup
  markers: Marker[] = []; // เก็บ markers ทั้งหมดในป๊อปอัพ
  private clickTimeout: any = null; // For debouncing clicks
  private isProcessingClick = false; // Prevent multiple rapid clicks

  // เพิ่มตัวแปรสำหรับจัดการพื้นที่
  currentAreaId: string = '';
  areaName: string = '';
  currentArea: Area | null = null;
  measurementCount: number = 0;
  showAreaStats: boolean = false;

  @ViewChild('mapContainer') private mapContainer!: ElementRef<HTMLElement>;
  @ViewChild('mapPopupContainer') private mapPopupContainer!: ElementRef<HTMLElement>;

  constructor(
    private router: Router,
    private location: Location,
    private db: Database,
    private http: HttpClient
  ) {
    config.apiKey = environment.mapTilerApiKey;
  }

  ngOnInit() {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user: UserData = JSON.parse(userData);
      this.username = user.username || 'ไม่พบชื่อผู้ใช้';
      
      // โหลด devices ก่อน แล้วค่อยกำหนด deviceId
      this.loadDevices().then(() => {
        // หลังจากโหลด devices เสร็จแล้ว ค่อยกำหนด deviceId
        const savedDevice = localStorage.getItem('selectedDevice');
        
        if (savedDevice && this.devices.includes(savedDevice)) {
          // ใช้ device ที่บันทึกไว้ถ้ามีในรายการ devices ของ user
          this.deviceId = savedDevice;
        } else if (this.devices.length > 0) {
          // ใช้ device แรกในรายการถ้าไม่มีการบันทึกไว้หรือ device ที่บันทึกไว้ไม่อยู่ในรายการ
          this.deviceId = this.devices[0];
          // บันทึกค่าใหม่ลง localStorage
          localStorage.setItem('selectedDevice', this.deviceId);
        } else {
          // fallback case ถ้าไม่มี devices เลย
          this.deviceId = 'NPK0001';
        }
        
        // โหลดข้อมูล sensor หลังจากกำหนด deviceId แล้ว
        this.loadSensorData();
      });
    } else {
      alert('กรุณาล็อกอินก่อน');
      this.router.navigate(['/']);
    }
  }

  ngAfterViewInit() {
    this.initializeMapWithDefault();
    // Don't initialize popup map here, wait until popup is actually shown
    this.openPopup(); // เปิด popup ทันทีเมื่อโหลดหน้า
  }

  ngOnDestroy() {
    // Clear any pending timeouts
    if (this.clickTimeout) {
      clearTimeout(this.clickTimeout);
    }
    
    if (this.map) {
      this.map.remove();
    }
    if (this.popupMap) {
      this.popupMap.remove();
    }
  }

  private initializeMapWithDefault() {
    if (this.mapContainer) {
      this.map = new Map({
        container: this.mapContainer.nativeElement,
        style: 'satellite',
        center: [this.initialLng, this.initialLat],
        zoom: 10
      });

      this.map.on('click', async (e) => {
        // Check if point is inside the custom polygon (not just rectangular bounds)
        if (this.polygonBounds.length >= 3 && this.isPointInPolygon([e.lngLat.lat, e.lngLat.lng], this.polygonBounds)) {
          await this.updateLocationDetail(e.lngLat.lat, e.lngLat.lng);
          if (this.map) {
            new Marker({ color: '#FF0000' })
              .setLngLat([e.lngLat.lng, e.lngLat.lat])
              .addTo(this.map);
            this.drawBoundsAsPolygon(); // วาดเส้นตีกรอบเมื่อคลิก
          }
        } else if (this.polygonBounds.length === 0) {
          alert('กรุณากำหนดพื้นที่วัดก่อนโดยเลือกจุดต่างๆ!');
        } else {
          alert('กรุณาเลือกตำแหน่งภายในพื้นที่ที่กำหนด!');
        }
      });
    }
  }

  private initializePopupMap() {
    // This method is no longer used - popup map is initialized when popup opens
  }

  openPopup() {
    console.log('Opening popup...');
    this.showPopup = true;
    this.points = [];
    this.markers = [];
    
    // Wait for DOM to update and popup to be visible
    setTimeout(() => {
      this.initializePopupMapWhenVisible();
    }, 100);
  }

  private initializePopupMapWhenVisible() {
    if (this.mapPopupContainer && this.mapPopupContainer.nativeElement) {
      console.log('Initializing popup map...');
      
      // Clean up existing popup map if any
      if (this.popupMap) {
        this.popupMap.remove();
        this.popupMap = undefined;
      }

      try {
        this.popupMap = new Map({
          container: this.mapPopupContainer.nativeElement,
          style: 'satellite',
          center: [this.initialLng, this.initialLat],
          zoom: 10
        });

        this.popupMap.on('load', () => {
          console.log('Popup map loaded successfully');
          // Set crosshair cursor to indicate clickable area
          if (this.popupMap && this.popupMap.getCanvas()) {
            this.popupMap.getCanvas().style.cursor = 'crosshair';
          }
          this.setupPopupMapClickHandler();
        });

        // Also setup click handler after a delay as backup
        setTimeout(() => {
          this.setupPopupMapClickHandler();
        }, 1000);

      } catch (error) {
        console.error('Error initializing popup map:', error);
      }
    } else {
      console.log('Map container not ready, retrying...');
      setTimeout(() => this.initializePopupMapWhenVisible(), 200);
    }
  }

  private setupPopupMapClickHandler() {
    if (!this.popupMap) return;

    console.log('Setting up popup map click handler');
    
    const clickHandler = (e: any) => {
      // Reduce debounce time and make it more responsive
      if (this.isProcessingClick) {
        console.log('Click ignored - already processing');
        return;
      }

      // Much shorter timeout for better responsiveness
      if (this.clickTimeout) {
        clearTimeout(this.clickTimeout);
      }

      this.isProcessingClick = true;

      // Immediate processing with shorter debounce
      this.clickTimeout = setTimeout(() => {
        this.handleMapClick(e);
        this.isProcessingClick = false;
      }, 50); // Reduced from 200ms to 50ms
    };
    
    // Remove any existing listeners and add new one
    // this.popupMap.off('click');
    this.popupMap.on('click', clickHandler);
    
    // Also listen for double-click and treat as single click
    this.popupMap.on('dblclick', (e: any) => {
      e.preventDefault();
      if (!this.isProcessingClick) {
        this.handleMapClick(e);
      }
    });
  }

  private handleMapClick(e: any) {
    console.log('🎯 Processing map click at:', e.lngLat.lat, e.lngLat.lng, 'Total points:', this.points.length);
    
    // Add point to array
    this.points.push([e.lngLat.lat, e.lngLat.lng]);
    
    if (this.popupMap) {
      // Create marker with number label for easier tracking
      const markerElement = document.createElement('div');
      markerElement.style.backgroundColor = '#FF4444';
      markerElement.style.color = 'white';
      markerElement.style.width = '25px';
      markerElement.style.height = '25px';
      markerElement.style.borderRadius = '50%';
      markerElement.style.display = 'flex';
      markerElement.style.alignItems = 'center';
      markerElement.style.justifyContent = 'center';
      markerElement.style.fontSize = '12px';
      markerElement.style.fontWeight = 'bold';
      markerElement.style.border = '2px solid white';
      markerElement.textContent = this.points.length.toString();
      
      const marker = new Marker({ 
        element: markerElement
      })
        .setLngLat([e.lngLat.lng, e.lngLat.lat])
        .addTo(this.popupMap);
      
      // Store marker for cleanup
      this.markers.push(marker);
      
      // Visual feedback
      if (this.popupMap.getCanvas()) {
        const canvas = this.popupMap.getCanvas();
        canvas.style.cursor = 'wait';
        setTimeout(() => {
          canvas.style.cursor = 'crosshair';
        }, 100);
      }
    }
    
    console.log(`✅ Point ${this.points.length} added successfully`);
    
    // Draw temporary polygon if we have at least 3 points
    if (this.points.length >= 3) {
      this.drawTemporaryPolygon();
    }
  }

  private drawTemporaryPolygon() {
    if (!this.popupMap || this.points.length < 3) return;

    // Create polygon coordinates (close the polygon by adding first point at the end)
    const polygonCoords = [...this.points.map(p => [p[1], p[0]]), [this.points[0][1], this.points[0][0]]];

    const geoJsonData = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [polygonCoords]
      }
    };

    // Remove existing polygon if any
    if (this.popupMap.getSource('temp-polygon')) {
      this.popupMap.removeLayer('temp-polygon-fill');
      this.popupMap.removeLayer('temp-polygon-line');
      this.popupMap.removeSource('temp-polygon');
    }

    // Add new polygon
    this.popupMap.addSource('temp-polygon', {
      type: 'geojson',
      data: geoJsonData
    });

    // Add fill layer
    this.popupMap.addLayer({
      id: 'temp-polygon-fill',
      type: 'fill',
      source: 'temp-polygon',
      paint: {
        'fill-color': '#FF4444',
        'fill-opacity': 0.2
      }
    });

    // Add outline layer
    this.popupMap.addLayer({
      id: 'temp-polygon-line',
      type: 'line',
      source: 'temp-polygon',
      paint: {
        'line-color': '#FF4444',
        'line-width': 2
      }
    });
  }

  async confirmArea() {
    if (this.points.length < 3) {
      alert('กรุณาเลือกอย่างน้อย 3 จุดเพื่อสร้างพื้นที่');
      return;
    }

    // ถ้ายังไม่ได้ตั้งชื่อพื้นที่
    if (!this.areaName.trim()) {
      this.areaName = prompt('กรุณาตั้งชื่อพื้นที่วัด:') || '';
      if (!this.areaName.trim()) {
        alert('กรุณาตั้งชื่อพื้นที่');
        return;
      }
    }

    console.log('Confirming area with', this.points.length, 'points');
    
    try {
      // สร้าง Area ID ใหม่
      this.currentAreaId = `${this.username}_${this.deviceId}_${Date.now()}`;
      
      // Store the polygon boundary points (copy of points)
      this.polygonBounds = [...this.points];
      
      // สร้างข้อมูล Area
      const areaData: Area = {
        id: this.currentAreaId,
        name: this.areaName,
        deviceId: this.deviceId,
        username: this.username,
        polygonBounds: this.polygonBounds,
        createdDate: new Date().toISOString().split('T')[0],
        createdTimestamp: Date.now(),
        totalMeasurements: 0
      };

      // บันทึก Area ลง Firebase
      const areaRef = ref(this.db, `areas/${this.currentAreaId}`);
      await push(areaRef, areaData);
      
      this.currentArea = areaData;
      this.measurementCount = 0;
      this.showAreaStats = true;

      // Create rectangular bounds for map fitting (still needed for fitBounds)
      this.createBoundsFromPoints();
      
      // Close popup
      this.showPopup = false;
      
      // Show the area on main map
      if (this.map && this.bounds) {
        this.map.fitBounds(this.bounds, { padding: 50 });
        this.drawBoundsAsPolygon();
      }

      alert(`สร้างพื้นที่ "${this.areaName}" เรียบร้อยแล้ว\nตีค่อนคลิกในพื้นที่เพื่อเริ่มวัด`);

    } catch (error) {
      console.error('Error creating area:', error);
      alert('เกิดข้อผิดพลาดในการสร้างพื้นที่');
    }
  }

  testAddPoint() {
    // Add a test point at map center for debugging
    const testPoint: [number, number] = [this.initialLat, this.initialLng];
    console.log('🧪 Adding test point:', testPoint);
    
    this.points.push(testPoint);
    
    if (this.popupMap) {
      const markerElement = document.createElement('div');
      markerElement.style.backgroundColor = '#00FF00';
      markerElement.style.color = 'white';
      markerElement.style.width = '25px';
      markerElement.style.height = '25px';
      markerElement.style.borderRadius = '50%';
      markerElement.style.display = 'flex';
      markerElement.style.alignItems = 'center';
      markerElement.style.justifyContent = 'center';
      markerElement.style.fontSize = '12px';
      markerElement.style.fontWeight = 'bold';
      markerElement.style.border = '2px solid white';
      markerElement.textContent = 'T';
      
      const marker = new Marker({ element: markerElement })
        .setLngLat([testPoint[1], testPoint[0]])
        .addTo(this.popupMap);
      
      this.markers.push(marker);
    }
    
    if (this.points.length >= 3) {
      this.drawTemporaryPolygon();
    }
  }

  clearMarks() {
    console.log('Clearing all marks');
    
    // Clear any pending click timeout
    if (this.clickTimeout) {
      clearTimeout(this.clickTimeout);
      this.clickTimeout = null;
    }
    
    // Reset processing flag
    this.isProcessingClick = false;
    
    this.points = [];
    
    // Remove all markers
    this.markers.forEach(marker => marker.remove());
    this.markers = [];
    
    // Remove temporary polygon if exists
    if (this.popupMap && this.popupMap.getSource('temp-polygon')) {
      this.popupMap.removeLayer('temp-polygon-fill');
      this.popupMap.removeLayer('temp-polygon-line');
      this.popupMap.removeSource('temp-polygon');
    }
  }

  private createBoundsFromPoints() {
    if (this.points.length >= 3) {
      const lats = this.points.map(p => p[0]);
      const lngs = this.points.map(p => p[1]);
      
      this.bounds = new LngLatBounds(
        [Math.min(...lngs), Math.min(...lats)], // southwest
        [Math.max(...lngs), Math.max(...lats)]  // northeast
      );
      
      console.log('Bounds created:', this.bounds);
    }
  }

  private drawBoundsAsPolygon() {
    if (this.map && this.polygonBounds.length >= 3) {
      // Create polygon coordinates (close the polygon)
      const polygonCoords = [...this.polygonBounds.map(p => [p[1], p[0]]), [this.polygonBounds[0][1], this.polygonBounds[0][0]]];

      const geoJsonData = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Polygon' as const,
          coordinates: [polygonCoords]
        }
      };

      // Remove existing bounds if any
      if (this.map.getSource('bounds')) {
        this.map.removeLayer('bounds-fill');
        this.map.removeLayer('bounds-line');
        this.map.removeSource('bounds');
      }

      // Add polygon source
      this.map.addSource('bounds', {
        type: 'geojson',
        data: geoJsonData
      });

      // Add fill layer
      this.map.addLayer({
        id: 'bounds-fill',
        type: 'fill',
        source: 'bounds',
        paint: {
          'fill-color': '#FF0000',
          'fill-opacity': 0.2
        }
      });

      // Add outline layer
      this.map.addLayer({
        id: 'bounds-line',
        type: 'line',
        source: 'bounds',
        paint: {
          'line-color': '#FF0000',
          'line-width': 3
        }
      });

      // Add markers for each point on main map
      this.polygonBounds.forEach((point, index) => {
        new Marker({ 
          color: '#FF0000',
          scale: 0.6
        })
          .setLngLat([point[1], point[0]])
          .addTo(this.map!);
      });
    }
  }

  // Point-in-polygon algorithm (Ray casting) - improved version
  private isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    if (polygon.length < 3) return false;
    
    const [lat, lng] = point;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [lati, lngi] = polygon[i];
      const [latj, lngj] = polygon[j];
      
      if (((lati > lat) !== (latj > lat)) &&
          (lng < (lngj - lngi) * (lat - lati) / (latj - lati) + lngi)) {
        inside = !inside;
      }
    }
    
    console.log(`Point [${lat}, ${lng}] is ${inside ? 'INSIDE' : 'OUTSIDE'} polygon with ${polygon.length} vertices`);
    return inside;
  }

  reopenPopup() {
    console.log('Manually reopening popup');
    
    // รีเซ็ตข้อมูลพื้นที่
    this.bounds = null;
    this.polygonBounds = [];
    this.points = [];
    this.markers = [];
    this.currentAreaId = '';
    this.areaName = '';
    this.currentArea = null;
    this.measurementCount = 0;
    this.showAreaStats = false;
    
    // Clean up existing popup map
    if (this.popupMap) {
      this.popupMap.remove();
      this.popupMap = undefined;
    }
    
    // Clear main map polygon
    if (this.map && this.map.getSource('bounds')) {
      this.map.removeLayer('bounds-fill');
      this.map.removeLayer('bounds-line');
      this.map.removeSource('bounds');
    }
    
    this.openPopup();
  }

  closePopup() {
    console.log('Closing popup');
    
    // Clear any pending click timeout
    if (this.clickTimeout) {
      clearTimeout(this.clickTimeout);
      this.clickTimeout = null;
    }
    
    // Reset processing flag
    this.isProcessingClick = false;
    
    this.showPopup = false;
    
    // Clean up popup map when closing
    if (this.popupMap) {
      this.popupMap.remove();
      this.popupMap = undefined;
    }
    
    // Reset markers array
    this.markers = [];
    
    // Reset if not confirmed
    if (this.points.length < 3) {
      this.points = [];
      this.bounds = null;
    }
  }

  stopPropagation(event: Event) {
    event.stopPropagation();
  }

  private async updateLocationDetail(lat: number, lng: number) {
    try {
      const response = await this.http.get<any>(`https://api.maptiler.com/geocoding/${lat},${lng}.json?key=${environment.mapTilerApiKey}`).toPromise();
      const placeName = response.features[0]?.place_name || 'Unknown Location';
      
      // เก็บชื่อจาก API แยกไว้
      this.autoLocationName = placeName;
      
      // ถ้าผู้ใช้เลือกใช้ชื่อที่ตั้งเอง
      if (this.useCustomName && this.customLocationName.trim()) {
        this.locationDetail = `${this.customLocationName.trim()} (Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)})`;
      } else {
        // ใช้ชื่อจาก API
        this.locationDetail = `${placeName} (Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)})`;
      }
    } catch (error) {
      console.error('Error fetching location details:', error);
      
      // ถ้าเกิดข้อผิดพลาดและผู้ใช้ตั้งชื่อเอง
      if (this.useCustomName && this.customLocationName.trim()) {
        this.locationDetail = `${this.customLocationName.trim()} (Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)})`;
      } else {
        this.locationDetail = `Unknown Location (Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)})`;
      }
    }
  }

  private drawBounds() {
    if (this.map && this.bounds) {
      const boundsCoords = [
        [this.bounds.getWest(), this.bounds.getSouth()],
        [this.bounds.getEast(), this.bounds.getSouth()],
        [this.bounds.getEast(), this.bounds.getNorth()],
        [this.bounds.getWest(), this.bounds.getNorth()],
        [this.bounds.getWest(), this.bounds.getSouth()] // ปิดกรอบ
      ];

      const geoJsonData = {
        type: 'Feature' as const,
        properties: {}, // Add required properties field
        geometry: {
          type: 'Polygon' as const,
          coordinates: [boundsCoords]
        }
      };

      if (!this.map.getSource('bounds')) {
        this.map.addSource('bounds', {
          type: 'geojson',
          data: geoJsonData
        });

        this.map.addLayer({
          id: 'bounds-layer',
          type: 'line',
          source: 'bounds',
          paint: {
            'line-color': '#FF0000',
            'line-width': 2
          }
        });
      } else {
        const source = this.map.getSource('bounds') as any;
        if (source && source.setData) {
          source.setData(geoJsonData);
        }
      }
    }
  }

  async loadDevices(): Promise<void> {
    this.isLoading = true;
    try {
      const userDevicesRef = ref(this.db, `users/${this.username}/devices`);
      const devicesSnapshot = await get(userDevicesRef);
      if (devicesSnapshot.exists()) {
        this.devices = Object.keys(devicesSnapshot.val());
        if (this.devices.length === 0) {
          console.warn('ไม่พบอุปกรณ์ในระบบ');
          this.devices = ['NPK0001']; // fallback
        }
      } else {
        console.warn('ไม่พบข้อมูลอุปกรณ์');
        this.devices = ['NPK0001']; // fallback
      }
    } catch (error) {
      console.error('ข้อผิดพลาดในการโหลดอุปกรณ์:', error);
      this.devices = ['NPK0001']; // fallback
    } finally {
      this.isLoading = false;
    }
  }

  async loadSensorData() {
    this.isLoading = true;
    try {
      const sensorRef = ref(this.db, `devices/${this.deviceId}/sensor`);
      const sensorSnap = await get(sensorRef);
      if (sensorSnap.exists()) {
        const sensor = sensorSnap.val();
        this.temperature = sensor.temperature || 0;
        this.moisture = sensor.moisture || 0;
        this.nitrogen = sensor.nitrogen || 0;
        this.phosphorus = sensor.phosphorus || 0;
        this.potassium = sensor.potassium || 0;
        this.ph = sensor.ph || 0;
      } else {
        console.log('ไม่พบข้อมูล sensor');
      }
    } catch (error) {
      console.error('ข้อผิดพลาดในการโหลดข้อมูลเซ็นเซอร์:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onDeviceChange() {
    localStorage.setItem('selectedDevice', this.deviceId);
    this.loadSensorData();
  }

  // ฟังก์ชันสำหรับเปลี่ยนโหมดการตั้งชื่อสถานที่
  onLocationNameModeChange() {
    // ถ้ามี locationDetail อยู่แล้ว ให้อัปเดตชื่อใหม่
    if (this.locationDetail) {
      const coords = this.locationDetail.match(/Lat: ([\d.-]+), Lng: ([\d.-]+)/);
      if (coords) {
        const lat = parseFloat(coords[1]);
        const lng = parseFloat(coords[2]);
        this.updateLocationDetailWithMode(lat, lng);
      }
    }
  }

  // ฟังก์ชันสำหรับอัปเดตชื่อสถานที่ตามโหมดที่เลือก
  private updateLocationDetailWithMode(lat: number, lng: number) {
    if (this.useCustomName && this.customLocationName.trim()) {
      this.locationDetail = `${this.customLocationName.trim()} (Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)})`;
    } else if (this.autoLocationName) {
      this.locationDetail = `${this.autoLocationName} (Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)})`;
    }
  }

  // ฟังก์ชันเมื่อผู้ใช้พิมพ์ชื่อสถานที่
  onCustomLocationNameChange() {
    if (this.useCustomName && this.locationDetail) {
      const coords = this.locationDetail.match(/Lat: ([\d.-]+), Lng: ([\d.-]+)/);
      if (coords) {
        const lat = parseFloat(coords[1]);
        const lng = parseFloat(coords[2]);
        this.updateLocationDetailWithMode(lat, lng);
      }
    }
  }

  async saveMeasurement() {
    // ตรวจสอบว่าต้องมี Area ที่กำหนดแล้ว
    if (!this.currentAreaId || this.polygonBounds.length < 3) {
      alert('กรุณากำหนดพื้นที่วัดก่อนบันทึก');
      return;
    }

    // ตรวจสอบว่าต้องมีชื่อสถานที่ (ไม่ว่าจะเป็นชื่อที่ตั้งเองหรือจาก API)
    if (!this.locationDetail) {
      alert('กรุณาเลือกตำแหน่งในพื้นที่ก่อนบันทึก');
      return;
    }

    // ถ้าเลือกใช้ชื่อที่ตั้งเองแต่ไม่ได้ใส่ชื่อ
    if (this.useCustomName && !this.customLocationName.trim()) {
      alert('กรุณาใส่ชื่อสถานที่');
      return;
    }

    this.isLoading = true;
    try {
      const [placeName, coords] = this.locationDetail.split(' (');
      const [latStr, lngStr] = coords.replace(')', '').split(', ');
      const lat = parseFloat(latStr.split(': ')[1]);
      const lng = parseFloat(lngStr.split(': ')[1]);

      // เพิ่มลำดับจุดวัด
      this.measurementCount++;

      const data: Measurement = {
        deviceId: this.deviceId,
        temperature: this.temperature,
        moisture: this.moisture,
        nitrogen: this.nitrogen,
        phosphorus: this.phosphorus,
        potassium: this.potassium,
        ph: this.ph,
        location: this.locationDetail,
        lat,
        lng,
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now(),
        // เพิ่มข้อมูลประเภทชื่อสถานที่
        locationNameType: this.useCustomName ? 'custom' : 'auto',
        customLocationName: this.useCustomName ? this.customLocationName.trim() : null,
        autoLocationName: this.autoLocationName || null,
        // เพิ่มข้อมูลพื้นที่
        areaId: this.currentAreaId,
        measurementPoint: this.measurementCount
      };

      // บันทึกข้อมูลการวัดแยกตาม Device เท่านั้น
      const measureRef = ref(this.db, `measurements/${this.deviceId}`);
      await push(measureRef, data);

      // อัปเดต Area statistics
      await this.updateAreaStatistics();

      alert(`บันทึกข้อมูลจุดที่ ${this.measurementCount} สำเร็จ!\nพื้นที่: ${this.areaName}`);
      
      // รีเซ็ตค่าหลังบันทึก (เฉพาะตำแหน่ง ไม่รีเซ็ตพื้นที่)
      this.locationDetail = '';
      this.customLocationName = '';
      this.autoLocationName = '';
      this.useCustomName = false;

      // โหลดข้อมูลเซ็นเซอร์ใหม่สำหรับการวัดครั้งต่อไป
      await this.loadSensorData();

    } catch (err) {
      console.error('ข้อผิดพลาดในการบันทึก:', err);
      alert('บันทึกไม่สำเร็จ');
    } finally {
      this.isLoading = false;
    }
  }

  // ฟังก์ชันคำนวณและอัปเดตค่าเฉลี่ยของพื้นที่
  private async updateAreaStatistics() {
    if (!this.currentAreaId) return;

    try {
      // ดึงข้อมูลการวัดทั้งหมดในพื้นที่นี้
      const measureRef = ref(this.db, `measurements/${this.currentAreaId}`);
      const measureSnap = await get(measureRef);
      
      if (!measureSnap.exists()) return;

      const measurements = Object.values(measureSnap.val()) as Measurement[];
      const count = measurements.length;

      if (count === 0) return;

      // คำนวณค่าเฉลี่ย
      const totals = measurements.reduce((acc, measurement) => {
        acc.temperature += measurement.temperature;
        acc.moisture += measurement.moisture;
        acc.nitrogen += measurement.nitrogen;
        acc.phosphorus += measurement.phosphorus;
        acc.potassium += measurement.potassium;
        acc.ph += measurement.ph;
        return acc;
      }, {
        temperature: 0,
        moisture: 0,
        nitrogen: 0,
        phosphorus: 0,
        potassium: 0,
        ph: 0
      });

      const averages = {
        temperature: parseFloat((totals.temperature / count).toFixed(2)),
        moisture: parseFloat((totals.moisture / count).toFixed(2)),
        nitrogen: parseFloat((totals.nitrogen / count).toFixed(2)),
        phosphorus: parseFloat((totals.phosphorus / count).toFixed(2)),
        potassium: parseFloat((totals.potassium / count).toFixed(2)),
        ph: parseFloat((totals.ph / count).toFixed(2))
      };

      // อัปเดต Area ใน Firebase
      const areaRef = ref(this.db, `areas/${this.currentAreaId}`);
      const areaSnap = await get(areaRef);
      
      if (areaSnap.exists()) {
        const areaKey = Object.keys(areaSnap.val())[0];
        const updateRef = ref(this.db, `areas/${this.currentAreaId}/${areaKey}`);
        
        await push(updateRef, {
          totalMeasurements: count,
          averages: averages,
          lastUpdated: Date.now()
        });

        // อัปเดต currentArea ในหน้า
        if (this.currentArea) {
          this.currentArea.totalMeasurements = count;
          this.currentArea.averages = averages;
        }
      }

      console.log('Area statistics updated:', averages);

    } catch (error) {
      console.error('Error updating area statistics:', error);
    }
  }

  // ฟังก์ชันแสดงสถิติของพื้นที่
  showAreaStatistics() {
    if (!this.currentArea || !this.currentArea.averages) {
      alert('ยังไม่มีข้อมูลสถิติของพื้นที่นี้');
      return;
    }

    const stats = this.currentArea.averages;
    const message = `สถิติพื้นที่: ${this.currentArea.name}
จำนวนจุดวัด: ${this.currentArea.totalMeasurements} จุด

ค่าเฉลี่ย:
• อุณหภูมิ: ${stats.temperature}°C
• ความชื้น: ${stats.moisture}%
• ไนโตรเจน: ${stats.nitrogen} mg/kg
• ฟอสฟอรัส: ${stats.phosphorus} mg/kg
• โพแทสเซียม: ${stats.potassium} mg/kg
• ค่า pH: ${stats.ph}`;

    alert(message);
  }

  // ฟังก์ชันสำหรับเริ่มพื้นที่ใหม่
  startNewArea() {
    if (this.measurementCount > 0) {
      const confirm = window.confirm(`คุณมีข้อมูลการวัด ${this.measurementCount} จุดในพื้นที่ "${this.areaName}"\nต้องการเริ่มพื้นที่ใหม่หรือไม่?`);
      if (!confirm) return;
    }

    this.reopenPopup();
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
}