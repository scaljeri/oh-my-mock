import { getTabId } from './active-tab';

/**
 * The fallback used to ask the popup's *own* window for its *inactive* tabs —
 * an empty list, since the popup window holds one tab and it is active — and
 * then index into it. These specs pin the corrected question: the active tab
 * of the last focused normal window, skipping the app itself.
 */
describe('getTabId', () => {
  const withFocusedWindow = (tabs: Partial<chrome.tabs.Tab>[]) => {
    (window.chrome as { windows?: unknown }).windows = {
      getLastFocused: (
        _options: unknown,
        callback: (focused: unknown) => void
      ) => callback({ tabs })
    };
  };

  afterEach(() => {
    delete (window.chrome as { windows?: unknown }).windows;
  });

  it('prefers the tab id from the query string', async () => {
    expect(await getTabId({ tabid: '42' })).toBe(42);
  });

  it('falls back to the active tab of the last focused normal window', async () => {
    withFocusedWindow([
      { id: 1, active: false, url: 'https://one.example/' },
      { id: 2, active: true, url: 'https://two.example/page' }
    ]);

    expect(await getTabId()).toBe(2);
  });

  it('never answers with a tab of the app itself', async () => {
    // Served as a plain tab (`ng serve`, the e2e suite) the app can be the
    // active tab of its own window; the tab being mocked is the other one.
    withFocusedWindow([
      { id: 9, active: true, url: `${location.origin}/oh-my-mock/index.html` },
      { id: 3, active: false, url: 'https://site.example/' }
    ]);

    expect(await getTabId()).toBe(3);
  });

  it('answers undefined when there is no tab to talk to', async () => {
    // A single-tab window holding only the app. The old code threw here.
    withFocusedWindow([
      { id: 9, active: true, url: `${location.origin}/oh-my-mock/index.html` }
    ]);

    expect(await getTabId()).toBeUndefined();
  });
});
