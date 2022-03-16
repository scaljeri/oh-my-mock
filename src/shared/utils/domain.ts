export function toDomain(inp: string): string {
  const url = new URL(inp);

  return url.host;
}

export function toPath(inp: string, sourceDomain?: string): string {
  const url = new URL(inp);

  if (url.host === sourceDomain) {
    return url.pathname;
  } else {
    return inp;
  }
}
