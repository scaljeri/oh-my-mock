import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  NgApimockSettingsService,
  NgApiMockSettings
} from '../ng-apimock-settings.service';

@Component({
  selector: 'app-ng-apimock-settings',
  templateUrl: './ng-apimock-settings.component.html',
  styleUrls: ['./ng-apimock-settings.component.scss']
})
export class NgApimockSettingsComponent implements OnInit {
  private apiMockSettings: NgApiMockSettings = {} as NgApiMockSettings;

  public settingsForm: FormGroup;
  public loading = true;

  constructor(
    private ngApimockSettingsService: NgApimockSettingsService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.ngApimockSettingsService
      .getSettings()
      .then((settings) => {
        this.apiMockSettings = settings;
        this.generateForm();
        this.loading = false;
      })
      .catch(() => {
        this.generateForm();
        this.loading = false;
      });
  }

  generateForm(): void {
    this.settingsForm = new FormGroup({
      integrate: new FormControl(this.apiMockSettings.integrate),
      ngApiMockHost: new FormControl(this.apiMockSettings.ngApiMockHost),
      ngApiMockBasePath: new FormControl(
        this.apiMockSettings.ngApiMockBasePath || 'ngapimock'
      )
    });
  }

  storeSettings(): void {
    this.ngApimockSettingsService.storeSettings(this.settingsForm.value).then(() => {
      this.snackBar.open('Settings stored', 'ngApiMockSettings', { verticalPosition: 'top', duration: 3000});
    });
    this.ngApimockSettingsService
      .storeSettings(this.settingsForm.value)
      .then(() => {
        this.snackBar.open('Settings stored', 'ngApiMockSettings', {
          verticalPosition: 'top',
          duration: 3000
        });
      });
  }

  get integrate(): FormControl {
    return this.settingsForm.get('integrate') as FormControl;
  }

  get ngApiMockHost(): FormControl {
    return this.settingsForm.get('ngApiMockHost') as FormControl;
  }

  get ngApiMockBasePath(): FormControl {
    return this.settingsForm.get('ngApiMockBasePath') as FormControl;
  }
}
