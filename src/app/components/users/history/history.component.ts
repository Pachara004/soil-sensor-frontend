import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Database, ref, onValue, get } from '@angular/fire/database';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Map, Marker, config, LngLatBounds } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { environment } from '../../../service/environment';

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
  styleUrl: './history.component.scss'
})
export class HistoryComponent implements OnInit, AfterViewInit, OnDestroy {
  username: string = '';
  deviceId: string = '';
  devices: string[] = [];
  history: Measurement[] = [];
  areaGroups: AreaGroup[] = [];
  selectedAreaId: string = '';
  showAreaDetails: boolean = false;
  selectedArea: AreaGroup | null = null;
  isLoading = false;

  // Map related properties
  map: Map | undefined;
  @ViewChild('mapContainer') private mapContainer!: ElementRef<HTMLElement>;

  constructor(
    private router: Router,
    private location: Location,
    private db: Database
  ) {
    config.apiKey = environment.mapTilerApiKey;
  }

  async ngOnInit() {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user: UserData = JSON.parse(userData);
      this.username = user.username || 'ไม่พบชื่อผู้ใช้';
      await this.loadDevices();
      if (this.devices.length > 0) {
        this.deviceId = localStorage.getItem('selectedDevice') || this.devices[0];
        this.loadHistory();
      }
    } else {
      alert('กรุณาล็อกอินก่อน');
      this.router.navigate(['/']);
    }
  }

  ngAfterViewInit() {}

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  async loadDevices() {
    this.isLoading = true;
    try {
      const userRef = ref(this.db, `users/${this.username}/devices`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        this.devices = Object.keys(snapshot.val());
        if (this.devices.length === 0) {
          alert('ไม่พบอุปกรณ์ที่เชื่อมโยง');
          this.devices = ['NPK0001'];
        }
      } else {
        alert('ไม่พบข้อมูลอุปกรณ์');
        this.devices = ['NPK0001'];
      }
    } catch (error) {
      console.error('ข้อผิดพลาดในการโหลดอุปกรณ์:', error);
      this.devices = ['NPK0001'];
    } finally {
      this.isLoading = false;
    }
  }

  loadHistory() {
    if (!this.deviceId) return;
    this.isLoading = true;
    const measurementRef = ref(this.db, `measurements/${this.deviceId}`);
    onValue(
      measurementRef,
      snapshot => {
        const data = snapshot.val();
        if (data) {
          this.history = Object.entries(data).map(([key, value]: [string, any]) => {
            let areaName = this.createMeaningfulAreaName(value, key);
            return {
              id: key,
              location: value.location || 'ไม่ระบุสถานที่',
              date: value.date || new Date().toISOString().split('T')[0],
              temperature: value.temperature || 0,
              moisture: value.moisture || 0,
              nitrogen: value.nitrogen || 0,
              phosphorus: value.phosphorus || 0,
              potassium: value.potassium || 0,
              ph: value.ph || 0,
              areaId: value.areaId,
              measurementPoint: value.measurementPoint,
              lat: value.lat,
              lng: value.lng,
              derivedAreaName: areaName,
              ...value
            };
          });
          this.groupByArea();
        } else {
          this.history = [];
          this.areaGroups = [];
        }
        this.isLoading = false;
      },
      error => {
        console.error('ข้อผิดพลาดในการโหลดประวัติ:', error);
        this.history = [];
        this.areaGroups = [];
        this.isLoading = false;
      }
    );
  }

  private createMeaningfulAreaName(value: any, measurementId: string): string {
    if (value['customLocationName'] && value['customLocationName'] !== 'Unknown Location' && value['customLocationName'].trim() !== '') {
      return value['customLocationName'];
    }
    if (value['autoLocationName'] && value['autoLocationName'] !== 'Unknown Location' && value['autoLocationName'].trim() !== '') {
      return value['autoLocationName'];
    }
    if (value.location && value.location !== 'ไม่ระบุสถานที่' && value.location !== 'Unknown Location' && value.location.trim() !== '') {
      const locationName = value.location.split(' (')[0].trim();
      if (locationName && locationName !== 'Unknown Location') {
        return locationName;
      }
    }
    if (value.areaId && value.areaId !== 'no-area') {
      if (value.areaId.includes('_')) {
        const parts = value.areaId.split('_');
        const lastPart = parts[parts.length - 1];
        return `พื้นที่ ${lastPart}`;
      }
      return `พื้นที่ ${value.areaId}`;
    }
    if (value.date) {
      const date = new Date(value.date);
      const dateStr = date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
      return `พื้นที่ ${dateStr}`;
    }
    const shortId = measurementId.substring(0, 6);
    return `พื้นที่ ${shortId}`;
  }

private async groupByArea() {
  const areaMap: { [key: string]: Measurement[] } = {};
  
  this.history.forEach(measurement => {
    let groupKey = measurement.areaId || 'no-area';
    
    // Extract main area ID (remove sub-area suffixes)
    if (groupKey !== 'no-area') {
      // If areaId contains hyphen followed by letters/numbers (like -OY1AK), remove it
      // Keep only the main numeric part
      const mainAreaMatch = groupKey.match(/^(\d+)/);
      if (mainAreaMatch) {
        groupKey = mainAreaMatch[1]; // Use only the numeric part
      }
    }
    
    // If still no proper area, use derived name grouping
    if (groupKey === 'no-area' && measurement['derivedAreaName']) {
      groupKey = `area_${measurement['derivedAreaName']}`;
    }
    
    if (!areaMap[groupKey]) {
      areaMap[groupKey] = [];
    }
    areaMap[groupKey].push(measurement);
  });

  const areaEntries = Object.keys(areaMap).map(key => [key, areaMap[key]] as [string, Measurement[]]);

  const areaGroupsWithPolygons = await Promise.all(
    areaEntries.map(async ([areaId, measurements]: [string, Measurement[]]) => {
      const sortedMeasurements = measurements.sort((a: Measurement, b: Measurement) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const averages = this.calculateAverages(measurements);
      const areaName = this.getAreaName(areaId, measurements);
      
      let polygonBounds: [number, number][] | undefined;
      try {
        if (areaId !== 'no-area' && !areaId.startsWith('area_')) {
          const areaRef = ref(this.db, `areas/${areaId}`);
          const areaSnap = await get(areaRef);
          if (areaSnap.exists()) {
            const areaData = Object.values(areaSnap.val())[0] as any;
            polygonBounds = areaData.polygonBounds;
          }
        }
      } catch (error) {
        console.error('Error loading polygon bounds:', error);
      }

      return {
        areaId,
        areaName,
        measurements: sortedMeasurements,
        totalMeasurements: measurements.length,
        averages,
        lastMeasurementDate: sortedMeasurements[0]?.date || '',
        polygonBounds
      };
    })
  );

  // Show only areas with multiple measurement points (2 or more)
  this.areaGroups = areaGroupsWithPolygons
    .filter(area => area.totalMeasurements > 1)
    .sort((a: AreaGroup, b: AreaGroup) => 
      new Date(b.lastMeasurementDate).getTime() - new Date(a.lastMeasurementDate).getTime()
    );
}

  private calculateAverages(measurements: Measurement[]) {
    if (measurements.length === 0) {
      return {
        temperature: 0,
        moisture: 0,
        nitrogen: 0,
        phosphorus: 0,
        potassium: 0,
        ph: 0
      };
    }

    const totals = measurements.reduce((acc, measurement) => {
      acc.temperature += measurement.temperature || 0;
      acc.moisture += measurement.moisture || 0;
      acc.nitrogen += measurement.nitrogen || 0;
      acc.phosphorus += measurement.phosphorus || 0;
      acc.potassium += measurement.potassium || 0;
      acc.ph += measurement.ph || 0;
      return acc;
    }, {
      temperature: 0,
      moisture: 0,
      nitrogen: 0,
      phosphorus: 0,
      potassium: 0,
      ph: 0
    });

    const count = measurements.length;
    return {
      temperature: parseFloat((totals.temperature / count).toFixed(2)),
      moisture: parseFloat((totals.moisture / count).toFixed(2)),
      nitrogen: parseFloat((totals.nitrogen / count).toFixed(2)),
      phosphorus: parseFloat((totals.phosphorus / count).toFixed(2)),
      potassium: parseFloat((totals.potassium / count).toFixed(2)),
      ph: parseFloat((totals.ph / count).toFixed(2))
    };
  }

  recommendSoilImprovement(area: AreaGroup): { message: string, fertilizers: FertilizerRecommendation[] } {
    const recommendations: string[] = [];
    const fertilizers: FertilizerRecommendation[] = [];
    const { temperature, moisture, nitrogen, phosphorus, potassium, ph } = area.averages;

    // pH recommendations
    if (ph < 5.5) {
      recommendations.push('ดินมีสภาพกรดจัด แนะนำให้ใส่ปูนขาว 1–2 ตัน/ไร่ เพื่อเพิ่มค่า pH');
      fertilizers.push({ formula: 'ปูนขาว', amount: '1–2 ตัน/ไร่', description: 'ปรับ pH ดินให้เหมาะสม' });
    } else if (ph > 7.5) {
      recommendations.push('ดินมีสภาพด่าง แนะนำให้ใส่กำมะถัน 50–100 กก./ไร่ เพื่อลดค่า pH');
      fertilizers.push({ formula: 'กำมะถัน', amount: '50–100 กก./ไร่', description: 'ลด pH ดิน' });
    }

    // Nitrogen recommendations
    if (nitrogen < 20) {
      recommendations.push('ดินขาดไนโตรเจน แนะนำให้ใส่ปุ๋ยยูเรีย (46-0-0) หรือปุ๋ยอินทรีย์');
      fertilizers.push({ formula: '46-0-0', amount: '20–30 กก./ไร่', description: 'เพิ่มไนโตรเจนในดิน' });
    } else if (nitrogen > 40) {
      recommendations.push('ไนโตรเจนในดินสูงเกินไป ควรลดการใช้ปุ๋ยไนโตรเจน');
    }

    // Phosphorus recommendations
    if (phosphorus < 15) {
      recommendations.push('ดินขาดฟอสฟอรัส แนะนำให้ใส่ปุ๋ยซูเปอร์ฟอสเฟต (0-20-0)');
      fertilizers.push({ formula: '0-20-0', amount: '20–30 กก./ไร่', description: 'เพิ่มฟอสฟอรัสในดิน' });
    } else if (phosphorus > 30) {
      recommendations.push('ฟอสฟอรัสในดินสูงเกินไป ควรควบคุมการใช้ปุ๋ยฟอสฟอรัส');
    }

    // Potassium recommendations
    if (potassium < 100) {
      recommendations.push('ดินขาดโพแทสเซียม แนะนำให้ใส่ปุ๋ยโพแทสเซียมคลอไรด์ (0-0-60)');
      fertilizers.push({ formula: '0-0-60', amount: '15–25 กก./ไร่', description: 'เพิ่มโพแทสเซียมในดิน' });
    } else if (potassium > 200) {
      recommendations.push('โพแทสเซียมในดินสูงเกินไป ควรลดการใช้ปุ๋ยโพแทสเซียม');
    }

    // Moisture recommendations
    if (moisture < 20) {
      recommendations.push('ดินแห้งเกินไป แนะนำให้เพิ่มการชลประทานหรือสารอินทรีย์ เช่น ปุ๋ยคอก 2–3 ตัน/ไร่');
      fertilizers.push({ formula: 'ปุ๋ยคอก', amount: '2–3 ตัน/ไร่', description: 'เพิ่มความชื้นและสารอินทรีย์' });
    } else if (moisture > 50) {
      recommendations.push('ดินชื้นเกินไป แนะนำให้ปรับปรุงระบบระบายน้ำ');
    }

    // Temperature recommendations
    if (temperature < 15) {
      recommendations.push('อุณหภูมิต่ำเกินไป แนะนำให้ปลูกพืชเมืองหนาวหรือใช้โรงเรือน');
    } else if (temperature > 30) {
      recommendations.push('อุณหภูมิสูงเกินไป แนะนำให้ปลูกพืชเมืองร้อน');
    }

    // Recommend combined fertilizer if multiple nutrients are deficient
    if (nitrogen < 20 && phosphorus < 15 && potassium < 100) {
      fertilizers.push({ formula: '15-15-15', amount: '20–30 กก./ไร่', description: 'เพิ่ม N, P, K พร้อมกัน' });
      recommendations.push('ดินขาด N, P, K แนะนำให้ใช้ปุ๋ยสูตร 15-15-15');
    }

    return {
      message: recommendations.length > 0 ? recommendations.join('\n') : 'ดินอยู่ในสภาพเหมาะสมสำหรับการเพาะปลูกทั่วไป',
      fertilizers
    };
  }

  recommendCrops(area: AreaGroup): string[] {
    const crops: string[] = [];
    const { temperature, moisture, ph } = area.averages;

    if (ph >= 5.5 && ph <= 7.0) {
      crops.push('ข้าวโพด', 'ถั่วเหลือง', 'ผักกาดหอม', 'มะเขือเทศ');
    } else if (ph < 5.5) {
      crops.push('มันสำปะหลัง', 'สับปะรด', 'ชา');
    } else if (ph > 7.0) {
      crops.push('หน่อไม้ฝรั่ง', 'บีทรูท');
    }

    if (moisture > 50) {
      crops.push('ข้าว', 'บัว', 'ผักบุ้ง');
    }

    if (temperature > 30) {
      crops.push('ข้าว', 'มะม่วง', 'ทุเรียน');
    } else if (temperature < 15) {
      crops.push('ผักกาดหอม', 'สตรอว์เบอร์รี่');
    }

    return crops.length > 0 ? [...new Set(crops)] : ['ไม่มีพืชแนะนำสำหรับสภาพดินนี้'];
  }

  getDisplayAreaName(area: AreaGroup): string {
    if (!area.areaName || area.areaName === 'Unknown Location' || area.areaName.trim() === '') {
      if (area.areaId && area.areaId !== 'no-area') {
        if (area.areaId.includes('_')) {
          const parts = area.areaId.split('_');
          const lastPart = parts[parts.length - 1];
          return `พื้นที่ ${lastPart}`;
        }
        return `พื้นที่ ${area.areaId.substring(0, 8)}`;
      }
      if (area.lastMeasurementDate) {
        const date = new Date(area.lastMeasurementDate);
        const dateStr = date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' });
        return `พื้นที่ ${dateStr}`;
      }
      return `พื้นที่ที่ ${area.totalMeasurements}`;
    }
    return area.areaName;
  }

  private getAreaName(areaId: string, measurements: Measurement[]): string {
    if (areaId === 'no-area') {
      return 'ไม่มีการกำหนดพื้นที่';
    }
    const firstMeasurement = measurements[0];
    if (firstMeasurement && firstMeasurement['derivedAreaName']) {
      return firstMeasurement['derivedAreaName'];
    }
    if (areaId.includes('_')) {
      const parts = areaId.split('_');
      const lastPart = parts[parts.length - 1];
      return `พื้นที่ ${lastPart}`;
    }
    return `พื้นที่ ${areaId.substring(0, 8)}`;
  }

  onDeviceChange() {
    localStorage.setItem('selectedDevice', this.deviceId);
    this.loadHistory();
    this.showAreaDetails = false;
    this.selectedArea = null;
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
  }

  viewAreaDetails(area: AreaGroup) {
    this.selectedArea = area;
    this.showAreaDetails = true;
    setTimeout(() => {
      this.initializeAreaMap();
    }, 100);
  }

  private initializeAreaMap() {
    if (!this.selectedArea || !this.mapContainer) {
      console.log('Map container or selected area not available');
      return;
    }
    if (this.map) {
      this.map.remove();
    }
    const validMeasurements = this.selectedArea.measurements.filter(m => 
      m.lat !== undefined && m.lng !== undefined && 
      !isNaN(m.lat!) && !isNaN(m.lng!)
    );
    if (validMeasurements.length === 0) {
      console.log('No valid coordinates found for area');
      this.mapContainer.nativeElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f5f5f5; color: #666;">
          <p>ไม่พบข้อมูลตำแหน่งของจุดวัดในพื้นที่นี้</p>
        </div>
      `;
      return;
    }
    const lats = validMeasurements.map(m => m.lat!);
    const lngs = validMeasurements.map(m => m.lng!);
    const centerLat = lats.reduce((a, b) => a + b) / lats.length;
    const centerLng = lngs.reduce((a, b) => a + b) / lngs.length;

    try {
      this.map = new Map({
        container: this.mapContainer.nativeElement,
        style: 'satellite',
        center: [centerLng, centerLat],
        zoom: 16
      });
      this.map.on('load', () => {
        this.addMeasurementMarkers();
        this.drawAreaPolygon();
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

  private addMeasurementMarkers() {
    if (!this.map || !this.selectedArea) return;
    const validMeasurements = this.selectedArea.measurements.filter(m => 
      m.lat !== undefined && m.lng !== undefined && 
      !isNaN(m.lat!) && !isNaN(m.lng!)
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

  private drawAreaPolygon() {
    if (!this.map || !this.selectedArea?.polygonBounds || this.selectedArea.polygonBounds.length < 3) {
      return;
    }
    const polygonCoords = [
      ...this.selectedArea.polygonBounds.map(p => [p[1], p[0]]),
      [this.selectedArea.polygonBounds[0][1], this.selectedArea.polygonBounds[0][0]]
    ];
    const geoJsonData = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [polygonCoords]
      }
    };
    this.map.addSource('area-polygon', {
      type: 'geojson',
      data: geoJsonData
    });
    this.map.addLayer({
      id: 'area-polygon-fill',
      type: 'fill',
      source: 'area-polygon',
      paint: {
        'fill-color': '#FF4444',
        'fill-opacity': 0.2
      }
    });
    this.map.addLayer({
      id: 'area-polygon-line',
      type: 'line',
      source: 'area-polygon',
      paint: {
        'line-color': '#FF4444',
        'line-width': 3
      }
    });
  }

  private fitMapToBounds() {
    if (!this.map || !this.selectedArea) return;
    const validMeasurements = this.selectedArea.measurements.filter(m => 
      m.lat !== undefined && m.lng !== undefined && 
      !isNaN(m.lat!) && !isNaN(m.lng!)
    );
    if (validMeasurements.length === 0) return;
    const lats = validMeasurements.map(m => m.lat!);
    const lngs = validMeasurements.map(m => m.lng!);
    const bounds = new LngLatBounds(
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)]
    );
    this.map.fitBounds(bounds, { padding: 50, maxZoom: 18 });
  }

  private showMeasurementPopup(measurement: Measurement) {
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