export function convertToDomain(inp: string): string {
  const url = new URL(inp);

  return url.host;
}
