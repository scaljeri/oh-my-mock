import { JSONPath } from 'jsonpath-plus';

// `T extends object`: JSONPath walks the value, so a primitive has nothing for
// it to write `key` into. The constraint is what the `as any` stood in for.
export function update<T extends object>(path: string, json: T, key: string, value: unknown): T {
  JSONPath({
    path,
    json,
    parent: false,
    callback: (base) => {
      if (value === undefined) {
        delete base[key];
      } else {
        base[key] = value
      }
    }
  }) ;

  return json;
}
