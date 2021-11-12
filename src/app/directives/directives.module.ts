import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { OhMyForDirective } from './for.directive';

const list = [OhMyForDirective];

@NgModule({
  declarations: list,
  exports: list,
  imports: [
    CommonModule
  ]
})
export class OhMyDirectivesModule { }
