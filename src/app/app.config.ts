import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { HttpClientModule, provideHttpClient } from '@angular/common/http';
import { IMAGE_CONFIG } from '@angular/common';

export const appConfig: ApplicationConfig = {
  providers: 
  [{
    provide: IMAGE_CONFIG,
    useValue: {
      disableImageSizeWarning: true, 
      disableImageLazyLoadWarning: true
    }
  },
    provideRouter(routes), 
    provideAnimationsAsync(),
    provideHttpClient(),
    HttpClientModule, provideAnimationsAsync(), provideAnimationsAsync()
  ]
};