/**
 * The `chrome.runtime` message type the offscreen document answers.
 *
 * Its own file because both ends need it and neither should import the other:
 * the background sends it, the offscreen document is the only thing that may
 * reply to it.
 */
export const OH_MY_EVAL_MESSAGE = 'oh-my-mock;eval-in-sandbox';
