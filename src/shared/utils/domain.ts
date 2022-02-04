export function toDomain(inp: string): string {
  const url = new URL(inp);

  return url.host;
}

export function toPath(inp: string): string {
  const url = new URL(inp);

  return url.pathname;

}
