import { JSONPath } from 'jsonpath-plus';

export function update<T>(path: string, json: T, key: string, value: unknown): T {
  JSONPath({
    path,
    json: json as any,
    parent: false,
    callback: (base) => base[key] = value
  }) ;

  return json;
}
