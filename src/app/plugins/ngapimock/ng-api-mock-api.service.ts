import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IData } from '@shared/type';
import {
  NgApiMockSettings,
  NgApimockSettingsService
} from './ng-apimock-settings.service';
import mockToNgApiMock from './dto/mockToNgApiMock.dto';
@Injectable({
  providedIn: 'root'
})
export class NgApiMockApiService {
  private settings: NgApiMockSettings;
  constructor(
    private ngApiSettings: NgApimockSettingsService,
    private http: HttpClient
  ) {}

  async getSettings(): Promise<NgApiMockSettings | false> {
    return await this.ngApiSettings
      .getSettings()
      .then((settings) => (this.settings = settings))
      .catch(() => false);
  }	

  async postNewMock(mock: IData, name: string): Promise<unknown> {
    await this.getSettings();

    const APIMOCK = mockToNgApiMock(mock, name);
    return this.http
      .post(
        `${this.settings.ngApiMockHost}/${this.settings.ngApiMockBasePath}/mocks`,
        APIMOCK,
        { responseType: 'text' }
      )
      .toPromise();
  }
}
