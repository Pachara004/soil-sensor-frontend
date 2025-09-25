import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { NotificationService, NotificationData } from '../../service/notification.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Notification Popup -->
    <div class="notification-overlay" *ngIf="notification.show" (click)="closeNotification()">
      <div class="notification-popup" (click)="$event.stopPropagation()">
        <div class="notification-header" [ngClass]="notification.type">
          <i class="notification-icon" [ngClass]="getNotificationIcon()"></i>
          <h3 class="notification-title">{{ notification.title }}</h3>
          <button class="close-btn" (click)="closeNotification()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="notification-body">
          <p class="notification-message">{{ notification.message }}</p>
          <div class="notification-actions" *ngIf="notification.showActions">
            <button class="btn-secondary" (click)="closeNotification()">ปิด</button>
            <button class="btn-primary" (click)="onNotificationConfirm()" *ngIf="notification.confirmText">
              {{ notification.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    // Notification Popup Styles
    .notification-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(5px);
      animation: fadeInOverlay 0.3s ease-out;

      .notification-popup {
        background: white;
        border-radius: 20px;
        width: 90%;
        max-width: 450px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        animation: slideInPopup 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

        .notification-header {
          padding: 25px 30px 20px;
          position: relative;
          display: flex;
          align-items: center;
          gap: 15px;

          &.success {
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
          }

          &.error {
            background: linear-gradient(135deg, #f44336, #d32f2f);
            color: white;
          }

          &.warning {
            background: linear-gradient(135deg, #ff9800, #f57c00);
            color: white;
          }

          &.info {
            background: linear-gradient(135deg, #2196F3, #1976D2);
            color: white;
          }

          .notification-icon {
            font-size: 24px;
            flex-shrink: 0;
          }

          .notification-title {
            margin: 0;
            font-size: 20px;
            font-weight: 600;
            flex: 1;
          }

          .close-btn {
            background: none;
            border: none;
            color: inherit;
            cursor: pointer;
            padding: 8px;
            border-radius: 50%;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;

            &:hover {
              background: rgba(255, 255, 255, 0.2);
              transform: scale(1.1);
            }

            i {
              font-size: 16px;
            }
          }
        }

        .notification-body {
          padding: 25px 30px 30px;

          .notification-message {
            margin: 0 0 25px 0;
            font-size: 16px;
            line-height: 1.6;
            color: #333;
            white-space: pre-line;
          }

          .notification-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;

            button {
              padding: 12px 24px;
              border: none;
              border-radius: 25px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
              min-width: 100px;

              &.btn-primary {
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;

                &:hover {
                  background: linear-gradient(135deg, #45a049, #3d8b40);
                  transform: translateY(-2px);
                  box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
                }
              }

              &.btn-secondary {
                background: #f5f5f5;
                color: #666;
                border: 1px solid #ddd;

                &:hover {
                  background: #e0e0e0;
                  transform: translateY(-2px);
                  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                }
              }
            }
          }
        }
      }
    }

    // Animations
    @keyframes fadeInOverlay {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes slideInPopup {
      from {
        opacity: 0;
        transform: scale(0.8) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    // Responsive Design for Notification
    @media (max-width: 768px) {
      .notification-overlay {
        padding: 20px;

        .notification-popup {
          max-width: 100%;

          .notification-header {
            padding: 20px 25px 15px;

            .notification-title {
              font-size: 18px;
            }

            .notification-icon {
              font-size: 20px;
            }
          }

          .notification-body {
            padding: 20px 25px 25px;

            .notification-message {
              font-size: 15px;
            }

            .notification-actions {
              flex-direction: column;

              button {
                width: 100%;
                min-width: auto;
              }
            }
          }
        }
      }
    }
  `]
})
export class NotificationComponent implements OnInit, OnDestroy {
  notification: NotificationData = {
    show: false,
    type: 'info',
    title: '',
    message: '',
    showActions: false,
    confirmText: '',
    confirmCallback: null
  };

  private subscription: Subscription = new Subscription();

  constructor(private notificationService: NotificationService) {}

  ngOnInit() {
    this.subscription = this.notificationService.notification$.subscribe(
      (notification) => {
        this.notification = notification;
      }
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  closeNotification() {
    this.notificationService.closeNotification();
  }

  onNotificationConfirm() {
    this.notificationService.onNotificationConfirm();
  }

  getNotificationIcon(): string {
    return this.notificationService.getNotificationIcon(this.notification.type);
  }
}
