import { IData } from '@shared/type';
import { arrayAddItem, arrayRemoveItem } from '@shared/utils/array';

export const init = (data: IData[]): number[] => {
  return data.map((_, i) => i);
}

export const add = (index: number, view: number[], position = 0): number[] => {
  const clone = view.map(v => v >= index ? v + 1 : v)

  return arrayAddItem(clone, index, position);
}

export const remove = (dataPos: number, view: number[]): number[] => {
  const index = view.indexOf(dataPos);
  return arrayRemoveItem(view.map(v => v >= index ? v - 1 : v), index)[0];
}

