import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'prettyPrint'
})
export class PrettyPrintPipe implements PipeTransform {
  transform(value: Record<string, string> | string, indent = 4): string {
    if (value === null || value === undefined) {
      return '';
    }

    let dataStr = value as Record<string, string>;

    if (typeof value === 'string') {
      dataStr = JSON.parse(value);
    }

    return JSON.stringify(dataStr, null, indent);
  }
}
