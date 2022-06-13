import { Component, OnInit } from '@angular/core';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';
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

  public settingsForm: UntypedFormGroup;
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
    this.settingsForm = new UntypedFormGroup({
      integrate: new UntypedFormControl(this.apiMockSettings.integrate),
      ngApiMockHost: new UntypedFormControl(this.apiMockSettings.ngApiMockHost),
      ngApiMockBasePath: new UntypedFormControl(
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

  get integrate(): UntypedFormControl {
    return this.settingsForm.get('integrate') as UntypedFormControl;
  }

  get ngApiMockHost(): UntypedFormControl {
    return this.settingsForm.get('ngApiMockHost') as UntypedFormControl;
  }

  get ngApiMockBasePath(): UntypedFormControl {
    return this.settingsForm.get('ngApiMockBasePath') as UntypedFormControl;
  }
}
