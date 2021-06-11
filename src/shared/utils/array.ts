export const arrayMoveItem = <T>(list: T[], from: number, to: number): T[] => {

  if (from >= list.length) {
    // eslint-disable-next-line no-console
    console.warn(`Cannot move entry in array. 'from' >= list.length (${from} > ${list.length})`);
    return list;
  }

  if (from === to) {
    return list;
  }

  const [clone, entry] = arrayRemoveItem(list, from);
  return [...clone.slice(0, to), entry, ...clone.slice(to)];
}

export const arrayRemoveItem = <T = unknown>(list: T[], index: number): [T[], T] => {
  const clone = [...list];
  const item = clone.splice(index, 1)[0];

  return [clone, item];
}

export const arrayAddItem = <T>(list: T[], value: T, index?: number): T[] => {
  index ??= list.length;
  return [...list.slice(0, index), value, ...list.slice(index)];
}
