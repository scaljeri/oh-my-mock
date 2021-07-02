export const PREFIX_STYLES = ['background: black;color: white', 'background: inherit; color: inherit'];

export const logging = (prefix: string, force = false) => {
  return (msg, ...data) => {
    // eslint-disable-next-line no-console
    const str = `%c${prefix}%c: `;

    if (('__OH_MY_SHOW_DEBUG__' as any) !== 'false' || force) {
      console.log(`${str}${msg}`, ...PREFIX_STYLES, ...data)
    }
  }
};
