export const logging = (prefix: string) => {
  return (msg, ...data) => console.log(`${prefix}: ${msg}`, ...data);
}
