import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [],
  templateUrl: './detail.component.html',
  styleUrl: './detail.component.scss'
})
export class DetailComponent implements OnInit{
device: any = null;

  constructor(private router: Router) {}

  ngOnInit(): void {
    const savedDevice = localStorage.getItem('selectedDevice');
    if (savedDevice) {
      this.device = JSON.parse(savedDevice);
    } else {
      alert('ไม่พบข้อมูลอุปกรณ์');
      this.router.navigate(['/adminmain']);
    }
  }

  goBack() {
    this.router.navigate(['/adminmain']);
  }
}
