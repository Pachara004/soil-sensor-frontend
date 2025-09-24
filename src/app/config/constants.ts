import { Injectable } from '@angular/core';
import { environment } from '../service/environment';

@Injectable({
  providedIn: 'root',
})
export class Constants {
  public readonly API_ENDPOINT: string = environment.apiBaseUrl;
}
