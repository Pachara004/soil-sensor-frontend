import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface NotificationData {
  show: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  showActions: boolean;
  confirmText: string;
  confirmCallback: (() => void) | null;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new BehaviorSubject<NotificationData>({
    show: false,
    type: 'info',
    title: '',
    message: '',
    showActions: false,
    confirmText: '',
    confirmCallback: null
  });

  public notification$ = this.notificationSubject.asObservable();

  showNotification(
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    showActions: boolean = false,
    confirmText: string = '',
    confirmCallback: (() => void) | null = null
  ) {
    this.notificationSubject.next({
      show: true,
      type,
      title,
      message,
      showActions,
      confirmText,
      confirmCallback
    });
  }

  closeNotification() {
    this.notificationSubject.next({
      show: false,
      type: 'info',
      title: '',
      message: '',
      showActions: false,
      confirmText: '',
      confirmCallback: null
    });
  }

  onNotificationConfirm() {
    const current = this.notificationSubject.value;
    if (current.confirmCallback) {
      current.confirmCallback();
    }
    this.closeNotification();
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'success': return 'fas fa-check-circle';
      case 'error': return 'fas fa-exclamation-circle';
      case 'warning': return 'fas fa-exclamation-triangle';
      case 'info': return 'fas fa-info-circle';
      default: return 'fas fa-info-circle';
    }
  }
}
