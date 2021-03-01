import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EncodePipe } from './encode.pipe';
import { PrettyPrintPipe } from './pretty-print.pipe';


@NgModule({
  declarations: [EncodePipe, PrettyPrintPipe],
  imports: [
    CommonModule
  ],
  providers: [PrettyPrintPipe],
  exports: [EncodePipe, PrettyPrintPipe]
})
export class PipesModule { }
