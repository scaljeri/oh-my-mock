import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EncodePipe } from './encode.pipe';


@NgModule({
  declarations: [EncodePipe],
  imports: [
    CommonModule
  ],
  exports: [EncodePipe]
})
export class PipesModule { }
