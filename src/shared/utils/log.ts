export const PREFIX_STYLES = ['background: black;color: white', 'background: inherit; color: inherit'];

/* eslint-disable no-console */

export const logging = (prefix: string, force = false) => {
  return (msg, ...data) => {
    const str = `%c${prefix}%c: `;

    if (('__OH_MY_SHOW_DEBUG__' as any) !== 'false' || force) {
      console.log(`${str}${msg}`, ...PREFIX_STYLES, ...data)
    }
  }
};
