import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

import { MockComponent } from './mock.component';
import { MockHeaderComponent } from './mock-header/mock-header.component';
import { ComponentsModule } from 'src/app/components/components.module';

@NgModule({
  declarations: [MockComponent, MockHeaderComponent],
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatSlideToggleModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    ComponentsModule,
  ],
})
export class MockModule {}
