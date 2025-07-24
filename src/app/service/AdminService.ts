import { Injectable } from '@angular/core';
import { Database, ref, get, set, remove, push, child, update } from '@angular/fire/database';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private db: Database) {}

  async getDevices(): Promise<any[]> {
    const snapshot = await get(ref(this.db, 'devices'));
    if (snapshot.exists()) {
      return Object.values(snapshot.val());
    } else {
      return [];
    }
  }

  async addDevice(deviceName: string, user: string): Promise<void> {
  const deviceRef = ref(this.db, `devices/${deviceName}`);
  await set(deviceRef, { name: deviceName, user });

  const userDeviceRef = ref(this.db, `users/${user}/devices/${deviceName}`);
  await set(userDeviceRef, true);
}

  async deleteDevice(deviceName: string): Promise<void> {
    const deviceRef = ref(this.db, `devices/${deviceName}`);
    return remove(deviceRef);
  }
  async getAllUsers(): Promise<any[]> {
  const snapshot = await get(ref(this.db, 'users'));
  if (snapshot.exists()) {
    return Object.values(snapshot.val());
  }
  return [];
}

}
