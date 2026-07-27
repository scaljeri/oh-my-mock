/**
 * `HeadersInit` has three shapes and the injected script forwards whatever the
 * page handed to `fetch()`, so all three really occur — the previous signature
 * (`Headers & { entries: ... }`) claimed only one while the body already fell
 * back to `Object.entries()` for plain objects.
 *
 * `Headers` is duck-typed rather than checked with `instanceof`: the object can
 * originate in the page realm while this code runs in the content script realm,
 * where `instanceof Headers` is false. Arrays are tested first because arrays
 * have an `entries()` method too.
 */
export const headersToJson = (headers?: HeadersInit | null): Record<string, string> => {
  let entries: Iterable<[string, string]>;

  if (!headers) {
    entries = [];
  } else if (Array.isArray(headers)) {
    entries = headers.map(([key, value]) => [key, value] as [string, string]);
  } else if (typeof (headers as Headers).entries === 'function') {
    entries = (headers as Headers).entries();
  } else {
    entries = Object.entries(headers as Record<string, string>);
  }

  return [...entries].reduce<Record<string, string>>((json, [key, value]) => {
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
