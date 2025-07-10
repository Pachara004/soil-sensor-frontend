import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-measure',
  standalone: true,
  imports: [CommonModule,  FormsModule],
  templateUrl: './measure.component.html',
  styleUrl: './measure.component.scss'
})
export class MeasureComponent {
  locationDetail: string = '';
  constructor(private router: Router) {}
  openMapPicker() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      this.locationDetail = `Lat: ${lat}, Lng: ${lng}`;
    }, error => {
      alert('ไม่สามารถดึงตำแหน่งได้');
    });
  } else {
    alert('อุปกรณ์ไม่รองรับ GPS');
  }
}
goBack() {
    this.router.navigate(['/main']);
  }
  goToProfile() {
    this.router.navigate(['/profile']);
  }
}
