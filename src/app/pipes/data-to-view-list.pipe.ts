import { Pipe, PipeTransform } from '@angular/core';
import { IOhDataView } from '../app.types';
import { IData } from '@shared/type';

@Pipe({
  name: 'dataToViewList'
})
export class DataToViewListPipe implements PipeTransform {

  transform(value: string[] = [], data: Record<string, IData> = {}): IOhDataView[] {
    if (value === null) {
      return [];
    }

    const out = Object.values(data)
      .filter(d => value.includes(d.id))
      .sort((a, b) => a.lastHit > b.lastHit ? 1 : -1)
      .map(data => ({
        ...data,
        urlStart: data.url.substring(0, data.url.length / 2),
        urlEnd: data.url.substring(data.url.length / 2)
      })) || [];

    return out;
  }
}
