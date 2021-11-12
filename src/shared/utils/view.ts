import { arrayMoveItem, arrayRemoveItem } from './array';

export const remove = (list: string[], id: string): string[] => {
  return arrayRemoveItem(list, list.indexOf(id))[0];
}

export const move = (list: string[], id: string, index: number): string[] => {
  const currentIndex = list.indexOf(id);

  return arrayMoveItem<string>(list, currentIndex, index);
}

export const add = (list: string[], id: string): string[] => {
  return [id, ...list];
}
