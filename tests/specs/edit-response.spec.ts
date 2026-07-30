/**
 * Editing a mock in the popup while the site is open next to it.
 *
 * The rest of the suite seeds storage and asserts what the page gets; these two
 * do the other half — they change the mock the way a developer does, through the
 * popup, and then ask the page what it is served now. That is the round trip the
 * extension exists for, and nothing else covered it: the popup was smoke-tested
 * and the interception was tested from seeded state, so an editor that saved
 * nothing would have passed both.
 *
 * Each test asserts three things in order, and the order is the point:
 *
 *  1. what the page gets *before* the edit — so a test that mocks nothing at all
 *     cannot pass by accident,
 *  2. that the edit reached storage — which separates "the popup saved it" from
 *     "the content script serves it" when one of them breaks,
 *  3. what the page gets after, plus the hit count, because a body that looks
 *     right proves nothing if the request also went to the server.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup, replaceEditorContent } from '../fixtures/popup';

/** What the mock holds when the popup opens. */
const RECORDED = { source: 'recorded', users: 2 };

/** What is typed over it. */
const EDITED = { source: 'edited-in-popup', users: 0 };

test.describe('editing a response from the popup', () => {
  test('a body typed into the editor is what the page is served next', async ({
    context,
    extensionId,
    ohMy,
    site,
    server
  }) => {
    const { mockId } = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: RECORDED
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    // Everything up and running: the seeded mock is being served.
    const before = await site.request({ url: '/api/json', responseType: 'json' });
    expect(before.json).toEqual(RECORDED);

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await popup.locator('[x-test="list-request-item"]').first().click();
    await replaceEditorContent(popup, JSON.stringify(EDITED));

    // The edit travels popup -> background -> storage, so it is not there the
    // moment the editor loses focus.
    await expect
      .poll(() => ohMy.getResponseBody(mockId))
      .toBe(JSON.stringify(EDITED));

    const after = await site.request({ url: '/api/json', responseType: 'json' });

    expect(after.json).toEqual(EDITED);
    // Neither request left the browser — not the one before the edit either.
    expect(await server.hitCount('GET /api/json')).toBe(0);

    await popup.close();
  });

  test('a saved response added with a new status code serves that code once picked', async ({
    context,
    extensionId,
    ohMy,
    site,
    server
  }) => {
    const { dataId, mockId } = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      statusCode: 200,
      response: RECORDED
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const before = await site.request({ url: '/api/json', responseType: 'json' });
    expect(before.status).toBe(200);
    expect(before.ok).toBe(true);

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await popup.locator('[x-test="list-request-item"]').first().click();

    // A second saved response, from the + Add dialog — the status code is typed
    // rather than picked from the datalist, which a headless browser cannot open.
    await popup.locator('[x-test="add-saved-response"]').click();
    await popup.locator('[x-test="new-response-status-code"]').fill('503');
    await popup.locator('[x-test="new-response-label"]').fill('maintenance');
    await popup.locator('[x-test="new-response-save"]').click();
    await expect(popup.locator('mat-dialog-container')).toHaveCount(0);

    const added = popup.locator('[x-test="saved-response"]', {
      hasText: '503'
    });
    await expect(added).toBeVisible();

    // Adding one does not serve it: `DataUtils.addResponse` only points
    // `selected` at a new response when it is the request's only one. Until the
    // chip is clicked the page still gets the 200.
    const untouched = await site.request({
      url: '/api/json',
      responseType: 'json'
    });
    expect(untouched.status).toBe(200);
    expect(await ohMy.getSelectedMockId(dataId)).toBe(mockId);

    await added.click();
    await expect.poll(() => ohMy.getSelectedMockId(dataId)).not.toBe(mockId);
    await expect(added).toHaveClass(/is-selected/);

    const after = await site.request({ url: '/api/json', responseType: 'json' });

    expect(after.status).toBe(503);
    // The regression the `ok` getter used to hide: a mocked error must read as
    // one, or `if (!res.ok) throw` never fires.
    expect(after.ok).toBe(false);
    expect(await server.hitCount('GET /api/json')).toBe(0);

    await popup.close();
  });
});
