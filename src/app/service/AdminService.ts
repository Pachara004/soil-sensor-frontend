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
async updateUser(username: string, updateData: any): Promise<void> {
  try {
    const userRef = ref(this.db, `users/${username}`);
    await update(userRef, updateData);
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

async deleteUser(username: string): Promise<void> {
  try {
    // ลบผู้ใช้จาก users node
    const userRef = ref(this.db, `users/${username}`);
    await remove(userRef);
    
    // ค้นหาและลบอุปกรณ์ที่เชื่อมโยงกับผู้ใช้นี้
    const devicesRef = ref(this.db, 'devices');
    const devicesSnapshot = await get(devicesRef);
    
    if (devicesSnapshot.exists()) {
      const devices = devicesSnapshot.val();
      const deletePromises: Promise<void>[] = [];
      
      Object.keys(devices).forEach(deviceKey => {
        if (devices[deviceKey].user === username) {
          const deviceRef = ref(this.db, `devices/${deviceKey}`);
          deletePromises.push(remove(deviceRef));
        }
      });
      
      // ลบอุปกรณ์ทั้งหมดที่เชื่อมโยง
      await Promise.all(deletePromises);
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}
}
