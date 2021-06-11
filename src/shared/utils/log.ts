export const logging = (prefix: string) => {
  return (msg, ...data) => {
    // eslint-disable-next-line no-console
    ('__OH_MY_SHOW_DEBUG__' as any) !== 'false' && console.log(`${prefix}: ${msg}`, ...data)
  }
};
