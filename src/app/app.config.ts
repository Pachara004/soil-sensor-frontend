import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { HttpClientModule, provideHttpClient } from '@angular/common/http';
import { IMAGE_CONFIG } from '@angular/common';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideDatabase, getDatabase } from '@angular/fire/database';
import { provideStorage, getStorage } from '@angular/fire/storage';

// ✅✅ Config ของโปรเจกต์คุณ
export const firebaseConfig = {
  apiKey: "AIzaSyCcRt14sMrziPLXMkOm3BCAMAWRCKkHWpI",
  authDomain: "tripbooking-ajtawan.firebaseapp.com",
  databaseURL: "https://tripbooking-ajtawan-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tripbooking-ajtawan",
  storageBucket: "tripbooking-ajtawan.appspot.com",
  messagingSenderId: "273977760323",
  appId: "1:273977760323:web:880946a1071fb9fc7812f6",
  measurementId: "G-SL75K9D520"
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideDatabase(() => getDatabase()),
    provideStorage(() => getStorage()),
    provideHttpClient(),
  ]
};