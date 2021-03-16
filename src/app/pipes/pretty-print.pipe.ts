import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'prettyPrint'
})
export class PrettyPrintPipe implements PipeTransform {
  transform(value: Record<string, string> | string, indent = 4): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      try {
        return JSON.stringify(JSON.parse(value), null, indent);
      } catch {
        return value;
      }
    }
  }
}
