import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EncodePipe } from './encode.pipe';
import { PrettyPrintPipe } from './pretty-print.pipe';
import { DataToViewListPipe } from './data-to-view-list.pipe';
import { StatusCodeTonePipe } from './status-code-tone.pipe';

@NgModule({
  declarations: [EncodePipe, PrettyPrintPipe, DataToViewListPipe, StatusCodeTonePipe],
  imports: [CommonModule],
  providers: [PrettyPrintPipe],
  exports: [EncodePipe, PrettyPrintPipe, DataToViewListPipe, StatusCodeTonePipe]
})
export class PipesModule {}
