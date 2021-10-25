export function strip(ct = ''): string {
  return ct.match(/^[^;]+/)[0];
}

export function update(source: string, update: string): string {
  return source.replace(/^[^;]+/, update);
}
