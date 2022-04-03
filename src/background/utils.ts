export const patchUrl = (url: string, host: string): string => {
  return url[0] === '/' ? host + url : url;
}
