export const logging = (prefix: string, force = false) => {
  return (msg, ...data) => {
    // eslint-disable-next-line no-console
    (('__OH_MY_SHOW_DEBUG__' as any) !== 'false' || force) && console.log(`${prefix}: ${msg}`, ...data)
  }
};
