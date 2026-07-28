import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EncodePipe } from './encode.pipe';
import { PrettyPrintPipe } from './pretty-print.pipe';
import { StatusCodeTonePipe } from './status-code-tone.pipe';
import { CookieExpiryPipe } from './cookie-expiry.pipe';
import { CookieTagsPipe } from './cookie-tags.pipe';

const pipes = [
  EncodePipe,
  PrettyPrintPipe,
  StatusCodeTonePipe,
  CookieExpiryPipe,
  CookieTagsPipe
];

@NgModule({
  declarations: [...pipes],
  imports: [CommonModule],
  providers: [PrettyPrintPipe],
  exports: [...pipes]
})
export class PipesModule {}
