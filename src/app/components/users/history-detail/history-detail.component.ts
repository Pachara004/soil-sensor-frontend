import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { SafePipe } from '../../../shared/safe.pipe';

@Component({
  selector: 'app-history-detail',
  standalone: true,
  imports: [CommonModule, SafePipe],
  templateUrl: './history-detail.component.html',
  styleUrl: './history-detail.component.scss'
})
export class HistoryDetailComponent implements OnInit {
  username: string = '';
  deviceId: string = '';
  measureDate: string = '';
  measureTime: string = '';

  temperature = 0;
  moisture = 0;
  nitrogen = 0;
  phosphorus = 0;
  potassium = 0;
  ph = 0;
  locationDetail: string = '';
  mapUrl: string = '';

  constructor(private location: Location, private router: Router) {}

  ngOnInit() {
    const data = JSON.parse(localStorage.getItem('selectedMeasurement') || '{}');

    this.username = localStorage.getItem('user')
      ? JSON.parse(localStorage.getItem('user')!).username || 'Unknown'
      : 'Unknown';

    this.deviceId = data.deviceId || 'ไม่ระบุอุปกรณ์';

    if (data.date) {
      const ts = new Date(data.date);
      this.measureDate = ts.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
      this.measureTime = ts.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    } else {
      this.measureDate = 'ไม่ระบุวันที่';
      this.measureTime = 'ไม่ระบุเวลา';
    }

    this.temperature = data.temperature ?? 0;
    this.moisture = data.moisture ?? 0;
    this.nitrogen = data.nitrogen ?? 0;
    this.phosphorus = data.phosphorus ?? 0;
    this.potassium = data.potassium ?? 0;
    this.ph = data.ph ?? 0;
    this.locationDetail = data.location || 'ไม่ระบุสถานที่';

    if (data.location) {
      const coords = data.location.match(/(-?\d+(\.\d+)?)/g);
      if (coords && coords.length >= 2) {
        this.mapUrl = `https://maps.google.com/maps?q=${coords[0]},${coords[1]}&output=embed`;
      } else {
        this.mapUrl = '';
      }
    }
  }

  goBack() {
    this.location.back();
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }
}