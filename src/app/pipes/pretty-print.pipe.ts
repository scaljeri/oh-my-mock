import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'prettyPrint'
})
export class PrettyPrintPipe implements PipeTransform {
  transform(value: Record<string, string> | string, indent = 4): string {
    if (value === null || value === undefined) {
      return '';
    }

    let obj = value;

    if (typeof value === 'string') {
      try {
        obj = JSON.parse(value);
      } catch {
        return value;
      }
    }

    return JSON.stringify(obj, null, indent);
  }
}
