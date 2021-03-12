import { Injectable } from '@angular/core';

export interface NgApiMockSettings {
  integrate: boolean;
  ngApiMockHost: string;
  ngApiMockBasePath: string;
}
@Injectable({
  providedIn: 'root',
})
export class NgApimockSettingsService {
  private settings: NgApiMockSettings;
  private settingKey = 'ngApiMockSettings';
  constructor() {}

  getSettings(): Promise<NgApiMockSettings> {
    return new Promise((resolve, reject) => {
      if (this.settings) {
        return resolve(this.settings);
      }
      chrome.storage.local.get([this.settingKey],
        (result) => result[this.settingKey] ? resolve(result[this.settingKey]) : reject('no settings'));
    });
  }

  storeSettings(newSettings: NgApiMockSettings): Promise<boolean> {
    this.settings = newSettings;
    return new Promise((resolve) => {
      chrome.storage.local.set({[this.settingKey]:  newSettings}, () => resolve(true));
    });
  }
}
