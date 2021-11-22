export const headersToJson = (headers: Headers & { entries: () => [string, string][] }): Record<string, string> => {
  const entries = [ ...(headers?.entries?.() || Object.entries(headers || {}))];

  return entries.reduce((json, [key, value]: [string, string]) => {
    json[key] = value;

    return json;
  }, {});
}

export const jsonToHeaders = (headers: Record<string, string>): Headers => {
  const out = new Headers();

  Object.entries(headers).forEach(([key, value]) => {
    out.append(key, value);
  });

  return out;
}
