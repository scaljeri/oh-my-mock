import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'prettyPrint'
})
export class PrettyPrintPipe implements PipeTransform {
  transform(value: Record<string, unknown>, indent = 4): string {
    return (value === null || value === undefined) ? '' : JSON.stringify(value, null, indent);
  }
}
