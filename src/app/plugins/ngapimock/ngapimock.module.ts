import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { StoreMockComponent } from './store-mock/store-mock.component';
import { NgApimockSettingsComponent } from './ng-apimock-settings/ng-apimock-settings.component';
import { ReactiveFormsModule } from '@angular/forms';
import { NgApiMockCreateMockDialogWrapperComponent } from './dialog/ng-api-mock-create-mock-dialog-wrapper/ng-api-mock-create-mock-dialog-wrapper.component';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [
    StoreMockComponent,
    NgApimockSettingsComponent,
    NgApiMockCreateMockDialogWrapperComponent
  ],
  imports: [
    CommonModule,
    HttpClientModule,
    MatIconModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    ReactiveFormsModule
  ]
})
export class NgApimockPluginModule {}
