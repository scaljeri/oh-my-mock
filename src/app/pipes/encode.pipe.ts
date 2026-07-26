import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  standalone: false,
  name: 'encode'
})
export class EncodePipe implements PipeTransform {
  transform(value: string): string {
    return encodeURIComponent(value);
  }
}
