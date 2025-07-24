import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Database, ref, onValue, push, get } from '@angular/fire/database';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SafeUrlPipe } from '../../../service/safe-url.pipe';

@Component({
  selector: 'app-measure',
  standalone: true,
  imports: [CommonModule, FormsModule,  SafeUrlPipe],
  templateUrl: './measure.component.html',
  styleUrl: './measure.component.scss'
})
export class MeasureComponent implements OnInit {
  locationDetail: string = '';
  username: string = JSON.parse(localStorage.getItem('user')!).username;

  temperature: number = 0;
  moisture: number = 0;
  nitrogen: number = 0;
  phosphorus: number = 0;
  potassium: number = 0;
  ph: number = 0;

  deviceId: string = '';
  mapUrl: SafeResourceUrl | null = null;
  constructor(
    private router: Router,
    private location: Location,
    private db: Database,
    private sanitizer: DomSanitizer
  ) {}

  async ngOnInit() {
    const userData = JSON.parse(localStorage.getItem('user')!);
    this.username = userData.username;

    // ✅ 1) ดึง devices ของ user
    const userDevicesRef = ref(this.db, `users/${this.username}/devices`);
    const devicesSnapshot = await get(userDevicesRef);

    
    if (devicesSnapshot.exists()) {
      const devices = devicesSnapshot.val();
      const keys = Object.keys(devices);
      if (keys.length > 0) {
        this.deviceId = keys[0];
        console.log('Device:', this.deviceId);
      } else {
        alert('ไม่พบอุปกรณ์');
      }
    }

    // ✅ ดึงค่าจาก sensor path (สมมุติว่าเก็บแบบนี้)
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
  }

 openMapPicker() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // ฝัง iframe Google Maps
        const url = `https://www.google.com/maps?q=${lat},${lng}&hl=th&z=16&output=embed`;
        this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);

        this.locationDetail = `Lat: ${lat}, Lng: ${lng}`;
      }, error => {
        alert('ไม่สามารถดึงตำแหน่งได้');
      });
    } else {
      alert('อุปกรณ์ไม่รองรับ GPS');
    }
  }

  async saveMeasurement() {
    if (!this.locationDetail) {
      alert('กรุณาระบุตำแหน่งก่อนบันทึก');
      return;
    }

    const data = {
      deviceId: this.deviceId,
      temperature: this.temperature,
      moisture: this.moisture,
      nitrogen: this.nitrogen,
      phosphorus: this.phosphorus,
      potassium: this.potassium,
      ph: this.ph,
      location: this.locationDetail,
      timestamp: Date.now()
    };

    try {
      const measureRef = ref(this.db, `measurements/${this.deviceId}`);
      await push(measureRef, {
        temperature: this.temperature,
        moisture: this.moisture,
        nitrogen: this.nitrogen,
        phosphorus: this.phosphorus,
        potassium: this.potassium,
        ph: this.ph,
        location: this.locationDetail,
        timestamp: Date.now()
      });

      alert('บันทึกข้อมูลสำเร็จ!');
      this.locationDetail = '';
    } catch (err) {
      console.error(err);
      alert('บันทึกไม่สำเร็จ');
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
