import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { child, Database, get, ref } from 'firebase/database';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  userID: string = '';
  deviceName: string = '';

  constructor(
    private router: Router,
    private db: Database
  ) {}
  async ngOnInit() {
    // ✅ 1) ลองดึงจาก LocalStorage ก่อน
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      this.userID = user.userID || 'ไม่พบข้อมูล';
      // ดึงชื่ออุปกรณ์จาก Realtime DB สมมติ path: devices/{userID}
      const snapshot = await get(child(ref(this.db), `devices/${this.userID}`));
      if (snapshot.exists()) {
        const device = snapshot.val();
        this.deviceName = device.name || 'ไม่มีชื่ออุปกรณ์';
      } else {
        this.deviceName = 'ไม่มีอุปกรณ์';
      }
    } else {
      alert('ไม่พบข้อมูลผู้ใช้');
      this.router.navigate(['/']);
    }
  }

  logout() {
    localStorage.removeItem('user');  // หรือล้างทั้งหมดก็ได้ด้วย localStorage.clear()
    this.router.navigate(['/']); // กลับไปหน้า login
  }
  goToProfile() {
    this.router.navigate(['/profile']);
  }
  goToMeasure() {
    this.router.navigate(['/measure']);
  }
  goToContactAdmin() {
    this.router.navigate(['/reports']); 
  }
  goToHistory() {
    this.router.navigate(['/history']); 
  }
}