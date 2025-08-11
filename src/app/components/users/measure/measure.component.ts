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
  areaId?: string;
  measurementPoint?: number;
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
  customLocationName: string = '';
  autoLocationName: string = '';
  useCustomName: boolean = false;
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
  map: Map | undefined;
  popupMap: Map | undefined;
  initialLat = 13.7563;
  initialLng = 100.5018;
  bounds: LngLatBounds | null = null;
  polygonBounds: [number, number][] = [];
  points: [number, number][] = [];
  showPopup = false;
  markers: Marker[] = [];
  private clickTimeout: any = null;
  private isProcessingClick = false;

  currentAreaId: string = '';
  areaName: string = '';
  currentArea: Area | null = null;
  measurementCount: number = 0;
  showAreaStats: boolean = false;

  // 🔥 NEW: ตัวเลิกสมัคร live
  private liveUnsub: (() => void) | null = null;

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

      this.loadDevices().then(() => {
        const savedDevice = localStorage.getItem('selectedDevice');

        if (savedDevice && this.devices.includes(savedDevice)) {
          this.deviceId = savedDevice;
        } else if (this.devices.length > 0) {
          this.deviceId = this.devices[0];
          localStorage.setItem('selectedDevice', this.deviceId);
        } else {
          this.deviceId = 'NPK0001';
        }

        // โหลดค่าเริ่มต้นหนึ่งครั้ง (fallback)
        this.loadSensorData();
        // 🔥 NEW: เปิด live stream ของอุปกรณ์
        this.startLiveStream();
      });
    } else {
      alert('กรุณาล็อกอินก่อน');
      this.router.navigate(['/']);
    }
  }

  ngAfterViewInit() {
    this.initializeMapWithDefault();
    this.openPopup(); // เปิด popup เลือกพื้นที่ทันทีตามโค้ดเดิม
  }

  ngOnDestroy() {
    if (this.clickTimeout) clearTimeout(this.clickTimeout);
    if (this.map) this.map.remove();
    if (this.popupMap) this.popupMap.remove();
    // 🔥 NEW: ปิด live subscription
    if (this.liveUnsub) { this.liveUnsub(); this.liveUnsub = null; }
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
        if (this.polygonBounds.length >= 3 && this.isPointInPolygon([e.lngLat.lat, e.lngLat.lng], this.polygonBounds)) {
          await this.updateLocationDetail(e.lngLat.lat, e.lngLat.lng);
          if (this.map) {
            new Marker({ color: '#FF0000' })
              .setLngLat([e.lngLat.lng, e.lngLat.lat])
              .addTo(this.map);
            this.drawBoundsAsPolygon();
          }
          // 👉 เลือกตำแหน่งแล้วก็โอเค ให้โชว์ค่าจาก live ต่อเนื่องอยู่แล้ว
          // (เราเปิด live ตั้งแต่ต้น หากอยากเริ่มหลัง confirmArea ให้ย้าย startLiveStream() ไปตอน confirmArea())
        } else if (this.polygonBounds.length === 0) {
          alert('กรุณากำหนดพื้นที่วัดก่อนโดยเลือกจุดต่างๆ!');
        } else {
          alert('กรุณาเลือกตำแหน่งภายในพื้นที่ที่กำหนด!');
        }
      });
    }
  }

  openPopup() {
    this.showPopup = true;
    this.points = [];
    this.markers = [];
    setTimeout(() => {
      this.initializePopupMapWhenVisible();
    }, 100);
  }

  private initializePopupMapWhenVisible() {
    if (this.mapPopupContainer && this.mapPopupContainer.nativeElement) {
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
          if (this.popupMap && this.popupMap.getCanvas()) {
            this.popupMap.getCanvas().style.cursor = 'crosshair';
          }
          this.setupPopupMapClickHandler();
        });

        setTimeout(() => {
          this.setupPopupMapClickHandler();
        }, 1000);

      } catch (error) {
        console.error('Error initializing popup map:', error);
      }
    } else {
      setTimeout(() => this.initializePopupMapWhenVisible(), 200);
    }
  }

  private setupPopupMapClickHandler() {
    if (!this.popupMap) return;

    const clickHandler = (e: any) => {
      if (this.isProcessingClick) return;
      if (this.clickTimeout) clearTimeout(this.clickTimeout);
      this.isProcessingClick = true;
      this.clickTimeout = setTimeout(() => {
        this.handleMapClick(e);
        this.isProcessingClick = false;
      }, 50);
    };

    this.popupMap.on('click', clickHandler);
    this.popupMap.on('dblclick', (e: any) => {
      e.preventDefault();
      if (!this.isProcessingClick) this.handleMapClick(e);
    });
  }

  private handleMapClick(e: any) {
    this.points.push([e.lngLat.lat, e.lngLat.lng]);

    if (this.popupMap) {
      const el = document.createElement('div');
      el.style.backgroundColor = '#FF4444';
      el.style.color = 'white';
      el.style.width = '25px';
      el.style.height = '25px';
      el.style.borderRadius = '50%';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = '12px';
      el.style.fontWeight = 'bold';
      el.style.border = '2px solid white';
      el.textContent = this.points.length.toString();

      const marker = new Marker({ element: el })
        .setLngLat([e.lngLat.lng, e.lngLat.lat])
        .addTo(this.popupMap);
      this.markers.push(marker);

      if (this.popupMap.getCanvas()) {
        const canvas = this.popupMap.getCanvas();
        canvas.style.cursor = 'wait';
        setTimeout(() => { canvas.style.cursor = 'crosshair'; }, 100);
      }
    }

    if (this.points.length >= 3) this.drawTemporaryPolygon();
  }

  private drawTemporaryPolygon() {
    if (!this.popupMap || this.points.length < 3) return;

    const polygonCoords = [...this.points.map(p => [p[1], p[0]]), [this.points[0][1], this.points[0][0]]];

    const geoJsonData = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [polygonCoords]
      }
    };

    if (this.popupMap.getSource('temp-polygon')) {
      this.popupMap.removeLayer('temp-polygon-fill');
      this.popupMap.removeLayer('temp-polygon-line');
      this.popupMap.removeSource('temp-polygon');
    }

    this.popupMap.addSource('temp-polygon', { type: 'geojson', data: geoJsonData });
    this.popupMap.addLayer({
      id: 'temp-polygon-fill',
      type: 'fill',
      source: 'temp-polygon',
      paint: { 'fill-color': '#FF4444', 'fill-opacity': 0.2 }
    });
    this.popupMap.addLayer({
      id: 'temp-polygon-line',
      type: 'line',
      source: 'temp-polygon',
      paint: { 'line-color': '#FF4444', 'line-width': 2 }
    });
  }

  async confirmArea() {
    if (this.points.length < 3) {
      alert('กรุณาเลือกอย่างน้อย 3 จุดเพื่อสร้างพื้นที่');
      return;
    }
    if (!this.areaName.trim()) {
      this.areaName = prompt('กรุณาตั้งชื่อพื้นที่วัด:') || '';
      if (!this.areaName.trim()) { alert('กรุณาตั้งชื่อพื้นที่'); return; }
    }

    try {
      this.currentAreaId = `${this.username}_${this.deviceId}_${Date.now()}`;
      this.polygonBounds = [...this.points];

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

      const areaRef = ref(this.db, `areas/${this.currentAreaId}`);
      await push(areaRef, areaData);

      this.currentArea = areaData;
      this.measurementCount = 0;
      this.showAreaStats = true;

      this.createBoundsFromPoints();
      this.showPopup = false;

      if (this.map && this.bounds) {
        this.map.fitBounds(this.bounds, { padding: 50 });
        this.drawBoundsAsPolygon();
      }

      // 🔥 ถ้าอยากเริ่ม live หลังยืนยันพื้นที่ คอมเมนต์บรรทัดใน ngOnInit แล้วมาเปิดตรงนี้แทน
      // this.startLiveStream();

      alert(`สร้างพื้นที่ "${this.areaName}" เรียบร้อยแล้ว\nแตะในพื้นที่เพื่อเริ่มวัด`);
    } catch (error) {
      console.error('Error creating area:', error);
      alert('เกิดข้อผิดพลาดในการสร้างพื้นที่');
    }
  }

  testAddPoint() {
    const testPoint: [number, number] = [this.initialLat, this.initialLng];
    this.points.push(testPoint);

    if (this.popupMap) {
      const el = document.createElement('div');
      el.style.backgroundColor = '#00FF00';
      el.style.color = 'white';
      el.style.width = '25px';
      el.style.height = '25px';
      el.style.borderRadius = '50%';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = '12px';
      el.style.fontWeight = 'bold';
      el.style.border = '2px solid white';
      el.textContent = 'T';

      const marker = new Marker({ element: el })
        .setLngLat([testPoint[1], testPoint[0]])
        .addTo(this.popupMap);
      this.markers.push(marker);
    }

    if (this.points.length >= 3) this.drawTemporaryPolygon();
  }

  clearMarks() {
    if (this.clickTimeout) { clearTimeout(this.clickTimeout); this.clickTimeout = null; }
    this.isProcessingClick = false;
    this.points = [];
    this.markers.forEach(m => m.remove());
    this.markers = [];
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
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)]
      );
    }
  }

  private drawBoundsAsPolygon() {
    if (this.map && this.polygonBounds.length >= 3) {
      const polygonCoords = [...this.polygonBounds.map(p => [p[1], p[0]]), [this.polygonBounds[0][1], this.polygonBounds[0][0]]];

      const geoJsonData = {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Polygon' as const, coordinates: [polygonCoords] }
      };

      if (this.map.getSource('bounds')) {
        this.map.removeLayer('bounds-fill');
        this.map.removeLayer('bounds-line');
        this.map.removeSource('bounds');
      }

      this.map.addSource('bounds', { type: 'geojson', data: geoJsonData });
      this.map.addLayer({ id: 'bounds-fill', type: 'fill', source: 'bounds', paint: { 'fill-color': '#FF0000', 'fill-opacity': 0.2 } });
      this.map.addLayer({ id: 'bounds-line', type: 'line', source: 'bounds', paint: { 'line-color': '#FF0000', 'line-width': 3 } });

      this.polygonBounds.forEach((point) => {
        new Marker({ color: '#FF0000', scale: 0.6 })
          .setLngLat([point[1], point[0]])
          .addTo(this.map!);
      });
    }
  }

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
    return inside;
    }

  reopenPopup() {
    this.bounds = null;
    this.polygonBounds = [];
    this.points = [];
    this.markers = [];
    this.currentAreaId = '';
    this.areaName = '';
    this.currentArea = null;
    this.measurementCount = 0;
    this.showAreaStats = false;

    if (this.popupMap) { this.popupMap.remove(); this.popupMap = undefined; }
    if (this.map && this.map.getSource('bounds')) {
      this.map.removeLayer('bounds-fill');
      this.map.removeLayer('bounds-line');
      this.map.removeSource('bounds');
    }
    this.openPopup();
  }

  closePopup() {
    if (this.clickTimeout) { clearTimeout(this.clickTimeout); this.clickTimeout = null; }
    this.isProcessingClick = false;
    this.showPopup = false;
    if (this.popupMap) { this.popupMap.remove(); this.popupMap = undefined; }
    this.markers = [];
    if (this.points.length < 3) {
      this.points = [];
      this.bounds = null;
    }
  }

  stopPropagation(event: Event) { event.stopPropagation(); }

  private async updateLocationDetail(lat: number, lng: number) {
    try {
      const response = await this.http.get<any>(`https://api.maptiler.com/geocoding/${lat},${lng}.json?key=${environment.mapTilerApiKey}`).toPromise();
      const placeName = response?.features?.[0]?.place_name || 'Unknown Location';
      this.autoLocationName = placeName;

      if (this.useCustomName && this.customLocationName.trim()) {
        this.locationDetail = `${this.customLocationName.trim()} (Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)})`;
      } else {
        this.locationDetail = `${placeName} (Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)})`;
      }
    } catch {
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
        [this.bounds.getWest(), this.bounds.getSouth()]
      ];

      const geoJsonData = {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Polygon' as const, coordinates: [boundsCoords] }
      };

      if (!this.map.getSource('bounds')) {
        this.map.addSource('bounds', { type: 'geojson', data: geoJsonData });
        this.map.addLayer({ id: 'bounds-layer', type: 'line', source: 'bounds', paint: { 'line-color': '#FF0000', 'line-width': 2 } });
      } else {
        const source = this.map.getSource('bounds') as any;
        if (source?.setData) source.setData(geoJsonData);
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
          this.devices = ['NPK0001'];
        }
      } else {
        this.devices = ['NPK0001'];
      }
    } catch {
      this.devices = ['NPK0001'];
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
      }
    } catch (error) {
      console.error('ข้อผิดพลาดในการโหลดข้อมูลเซ็นเซอร์:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // 🔥 NEW: Subscribe live/{deviceId} แบบเรียลไทม์
  private startLiveStream() {
    // ปิดของเดิมก่อนสลับอุปกรณ์
    if (this.liveUnsub) { this.liveUnsub(); this.liveUnsub = null; }

    const liveRef = ref(this.db, `live/${this.deviceId}`);
    this.liveUnsub = onValue(liveRef, (snap) => {
      if (!snap.exists()) return;
      const v = snap.val() || {};
      // ESP32 PATCH live ส่ง key เป็น temperature, ph, moisture, nitrogen, phosphorus, potassium
      // อัปเดตหน้าจอให้ตรงกับอุปกรณ์
      if (typeof v.temperature === 'number') this.temperature = v.temperature;
      if (typeof v.moisture === 'number') this.moisture = v.moisture;
      if (typeof v.nitrogen === 'number') this.nitrogen = v.nitrogen;
      if (typeof v.phosphorus === 'number') this.phosphorus = v.phosphorus;
      if (typeof v.potassium === 'number') this.potassium = v.potassium;
      if (typeof v.ph === 'number') this.ph = v.ph;
      // (ถ้าอยากใช้ progress แสดงแถบสถานะ ก็อ่าน v.progress ได้)
    }, (err) => {
      console.error('live onValue error', err);
    });
  }

  onDeviceChange() {
    localStorage.setItem('selectedDevice', this.deviceId);
    this.loadSensorData();   // ค่า fallback ครั้งแรก
    this.startLiveStream();  // 🔥 เปลี่ยนไปฟัง live ของอุปกรณ์ตัวใหม่ทันที
  }

  onLocationNameModeChange() {
    if (this.locationDetail) {
      const coords = this.locationDetail.match(/Lat: ([\d.-]+), Lng: ([\d.-]+)/);
      if (coords) {
        const lat = parseFloat(coords[1]);
        const lng = parseFloat(coords[2]);
        this.updateLocationDetailWithMode(lat, lng);
      }
    }
  }

  private updateLocationDetailWithMode(lat: number, lng: number) {
    if (this.useCustomName && this.customLocationName.trim()) {
      this.locationDetail = `${this.customLocationName.trim()} (Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)})`;
    } else if (this.autoLocationName) {
      this.locationDetail = `${this.autoLocationName} (Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)})`;
    }
  }

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
    if (!this.currentAreaId || this.polygonBounds.length < 3) {
      alert('กรุณากำหนดพื้นที่วัดก่อนบันทึก');
      return;
    }
    if (!this.locationDetail) {
      alert('กรุณาเลือกตำแหน่งในพื้นที่ก่อนบันทึก');
      return;
    }
    if (this.useCustomName && !this.customLocationName.trim()) {
      alert('กรุณาใส่ชื่อสถานที่');
      return;
    }

    this.isLoading = true;
    try {
      const [_, coords] = this.locationDetail.split(' (');
      const [latStr, lngStr] = coords.replace(')', '').split(', ');
      const lat = parseFloat(latStr.split(': ')[1]);
      const lng = parseFloat(lngStr.split(': ')[1]);

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
        lat, lng,
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now(),
        locationNameType: this.useCustomName ? 'custom' : 'auto',
        customLocationName: this.useCustomName ? this.customLocationName.trim() : null,
        autoLocationName: this.autoLocationName || null,
        areaId: this.currentAreaId,
        measurementPoint: this.measurementCount
      };

      // บันทึกแยกตาม Device (ตามโค้ดเดิมของคุณ)
      const measureRef = ref(this.db, `measurements/${this.deviceId}`);
      await push(measureRef, data);

      await this.updateAreaStatistics();

      alert(`บันทึกข้อมูลจุดที่ ${this.measurementCount} สำเร็จ!\nพื้นที่: ${this.areaName}`);

      this.locationDetail = '';
      this.customLocationName = '';
      this.autoLocationName = '';
      this.useCustomName = false;

      // ไม่ต้องดึงค่าอีก เพราะมี live อัปเดตอยู่แล้ว
    } catch (err) {
      console.error('ข้อผิดพลาดในการบันทึก:', err);
      alert('บันทึกไม่สำเร็จ');
    } finally {
      this.isLoading = false;
    }
  }

  private async updateAreaStatistics() {
    if (!this.currentAreaId) return;

    try {
      const measureRef = ref(this.db, `measurements/${this.currentAreaId}`);
      const measureSnap = await get(measureRef);
      if (!measureSnap.exists()) return;

      const measurements = Object.values(measureSnap.val()) as Measurement[];
      const count = measurements.length;
      if (count === 0) return;

      const totals = measurements.reduce((acc, m) => {
        acc.temperature += m.temperature;
        acc.moisture += m.moisture;
        acc.nitrogen += m.nitrogen;
        acc.phosphorus += m.phosphorus;
        acc.potassium += m.potassium;
        acc.ph += m.ph;
        return acc;
      }, { temperature: 0, moisture: 0, nitrogen: 0, phosphorus: 0, potassium: 0, ph: 0 });

      const averages = {
        temperature: parseFloat((totals.temperature / count).toFixed(2)),
        moisture: parseFloat((totals.moisture / count).toFixed(2)),
        nitrogen: parseFloat((totals.nitrogen / count).toFixed(2)),
        phosphorus: parseFloat((totals.phosphorus / count).toFixed(2)),
        potassium: parseFloat((totals.potassium / count).toFixed(2)),
        ph: parseFloat((totals.ph / count).toFixed(2))
      };

      const areaRef = ref(this.db, `areas/${this.currentAreaId}`);
      const areaSnap = await get(areaRef);
      if (areaSnap.exists()) {
        const areaKey = Object.keys(areaSnap.val())[0];
        const updateRef = ref(this.db, `areas/${this.currentAreaId}/${areaKey}`);
        await push(updateRef, {
          totalMeasurements: count,
          averages,
          lastUpdated: Date.now()
        });

        if (this.currentArea) {
          this.currentArea.totalMeasurements = count;
          this.currentArea.averages = averages;
        }
      }
    } catch (error) {
      console.error('Error updating area statistics:', error);
    }
  }

  showAreaStatistics() {
    if (!this.currentArea || !this.currentArea.averages) {
      alert('ยังไม่มีข้อมูลสถิติของพื้นที่นี้');
      return;
    }
    const s = this.currentArea.averages;
    alert(`สถิติพื้นที่: ${this.currentArea.name}
จำนวนจุดวัด: ${this.currentArea.totalMeasurements} จุด

ค่าเฉลี่ย:
• อุณหภูมิ: ${s.temperature}°C
• ความชื้น: ${s.moisture}%
• ไนโตรเจน: ${s.nitrogen} mg/kg
• ฟอสฟอรัส: ${s.phosphorus} mg/kg
• โพแทสเซียม: ${s.potassium} mg/kg
• ค่า pH: ${s.ph}`);
  }

  startNewArea() {
    if (this.measurementCount > 0) {
      const confirm = window.confirm(`คุณมีข้อมูลการวัด ${this.measurementCount} จุดในพื้นที่ "${this.areaName}"\nต้องการเริ่มพื้นที่ใหม่หรือไม่?`);
      if (!confirm) return;
    }
    this.reopenPopup();
  }

  goBack() { this.location.back(); }
  goToProfile() { this.router.navigate(['/profile']); }
  goToContactAdmin() { this.router.navigate(['/reports']); }
  goToHistory() { this.router.navigate(['/history']); }
}
