/**
 * Importing a HAR file, end to end.
 *
 * This is the one spec that drives the popup's UI for real: a file is handed to
 * the picker, the picker's own filters decide what is offered, and the import
 * is confirmed with a click. What comes out has to be a mock the *content*
 * script serves — which is what the second half asserts, from the page, with
 * the server's hit counter as the witness.
 *
 * The parsing and mapping themselves are unit-tested in
 * `src/shared/utils/har-parse.spec.ts` and `har-import.spec.ts`; there is no
 * browser in that and there does not need to be. What only a browser can show
 * is the round trip: dialog → `chrome.storage` → content script → page.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openDrawer, openPopup } from '../fixtures/popup';

interface HarEntryOptions {
  url: string;
  method?: string;
  resourceType?: string;
  status?: number;
  contentType?: string;
  text?: string;
  encoding?: string;
  startedDateTime?: string;
}

function harEntry(options: HarEntryOptions): unknown {
  const {
    url,
    method = 'GET',
    resourceType = 'fetch',
    status = 200,
    contentType = 'application/json',
    text,
    encoding,
    startedDateTime = '2024-05-01T09:00:00.000Z'
  } = options;

  return {
    _resourceType: resourceType,
    startedDateTime,
    request: { method, url, httpVersion: 'HTTP/1.1', headers: [], queryString: [] },
    response: {
      status,
      statusText: '',
      httpVersion: 'HTTP/1.1',
      headers: [
        { name: 'Content-Type', value: contentType },
        // Dropped on the way in: the stored body is decoded already, so telling
        // the page to gunzip it would break the mock it belongs to.
        { name: 'Content-Encoding', value: 'gzip' }
      ],
      content: {
        mimeType: contentType,
        size: text?.length ?? 0,
        ...(text !== undefined && { text }),
        ...(encoding !== undefined && { encoding })
      }
    }
  };
}

/**
 * A session as DevTools would have exported it: a page load with its assets, an
 * API call that was made twice, one that failed, one whose body was not kept,
 * a redirect, and a POST whose body is base64.
 */
function sessionHar(): Buffer {
  const at = (seconds: number) =>
    new Date(Date.UTC(2024, 4, 1, 9, 0, seconds)).toISOString();

  return Buffer.from(JSON.stringify({
    log: {
      version: '1.2',
      creator: { name: 'WebInspector', version: '537.36' },
      pages: [{ id: 'page_1', title: `${SITE_ORIGIN}/` }],
      entries: [
        harEntry({ url: `${SITE_ORIGIN}/`, resourceType: 'document', contentType: 'text/html', text: '<html></html>', startedDateTime: at(0) }),
        harEntry({ url: `${SITE_ORIGIN}/styles.css`, resourceType: 'stylesheet', contentType: 'text/css', text: 'body{}', startedDateTime: at(1) }),
        harEntry({ url: `${SITE_ORIGIN}/api/image.png`, resourceType: 'image', contentType: 'image/png', text: 'iVBORw0KGgo=', encoding: 'base64', startedDateTime: at(2) }),

        // The one this test mocks with, recorded as an XMLHttpRequest.
        harEntry({ url: `${SITE_ORIGIN}/api/json`, resourceType: 'xhr', text: '{"source":"har","note":"served from the imported HAR"}', startedDateTime: at(3) }),

        // Called twice with the same status: one saved response, the last body.
        harEntry({ url: `${SITE_ORIGIN}/api/users`, text: '{"users":["stale"]}', startedDateTime: at(4) }),
        harEntry({ url: `${SITE_ORIGIN}/api/users`, text: '{"users":["fresh"]}', startedDateTime: at(5) }),
        // …and once more with another status: a second saved response, which is
        // *not* the one selected — see `describeSelected` in `har-import.ts`.
        harEntry({ url: `${SITE_ORIGIN}/api/users`, status: 500, text: '{"error":"boom"}', startedDateTime: at(6) }),

        // A POST whose body the file holds base64-encoded but which is text.
        harEntry({ url: `${SITE_ORIGIN}/api/echo`, method: 'POST', status: 201, text: 'eyJvayI6dHJ1ZX0=', encoding: 'base64', startedDateTime: at(7) }),

        // The body was not kept — offered, but not selected by default.
        harEntry({ url: `${SITE_ORIGIN}/api/text`, contentType: 'text/plain', startedDateTime: at(8) }),

        // Skipped: mocking a redirect breaks the exchange it belongs to.
        harEntry({ url: `${SITE_ORIGIN}/api/redirect`, status: 302, startedDateTime: at(9) }),
        // Skipped: not a method a mock can be keyed by.
        harEntry({ url: `${SITE_ORIGIN}/api/json`, method: 'PROPFIND', startedDateTime: at(10) })
      ]
    }
  }));
}

test.describe('HAR import', () => {
  test('a recorded session becomes mocks the content script serves', async ({
    context,
    extensionId,
    ohMy,
    site,
    server
  }) => {
    // The popup needs a tab to be "inspecting" — see `tests/fixtures/popup.ts`.
    await site.open();

    // Switched on *before* the popup opens, so the "OhMyMock is disabled for
    // this domain" prompt — a full-window modal that swallows clicks — never
    // appears. It is not an artefact of this harness: it is what the popup
    // shows for a domain mocking is off for, and answering it is a different
    // test's business.
    await ohMy.setActive(SITE_DOMAIN);

    const tabId = await ohMy.tabIdFor(SITE_ORIGIN);
    const popup = await openPopup(context, extensionId, { domain: SITE_DOMAIN, tabId });

    // Opened as a tab rather than from the toolbar, the popup cannot reach a
    // content script and covers itself with this overlay, which swallows
    // clicks. Angular re-renders it, so hiding it once by removal is not
    // enough — the stylesheet is.
    await popup.addStyleTag({
      content: 'oh-my-connection-failure { display: none !important; }'
    });

    await openDrawer(popup);
    await popup.locator('[x-test="import-har"]').click();
    await popup.locator('oh-my-har-import input[type="file"]').setInputFiles({
      name: 'session.har',
      mimeType: 'application/json',
      buffer: sessionHar()
    });

    // Four of the eleven entries can be mocked: the page, its stylesheet and
    // its image are not calls this extension can intercept at all, the redirect
    // and the PROPFIND cannot be mocked, and /api/users was recorded three
    // times but is one request.
    const rows = popup.locator('.oh-har__row');
    await expect(rows).toHaveCount(4);

    await expect(popup.locator('.oh-har__summary'))
      .toContainText('4 of 11 entries can be mocked');
    await expect(popup.locator('.oh-har__summary')).toContainText('3 not an API call');
    await expect(popup.locator('.oh-har__summary')).toContainText('1 redirect or 304');
    await expect(popup.locator('.oh-har__summary')).toContainText('1 unsupported method');

    // The call with no recorded body is offered but left out of the selection;
    // the other three are in.
    await expect(popup.locator('[x-test="har-selected"]')).toHaveText('3 selected');
    await expect(popup.locator('.oh-har__tag--warn')).toHaveText('no body');

    // Recorded on the same host the popup is showing, so no other domain is
    // suggested and the field already holds the right one. The port is part of
    // that host: `localhost:8090` is a different domain from `localhost`.
    await expect(popup.locator('[x-test="har-domain"]')).toHaveValue(SITE_DOMAIN);
    await expect(popup.locator('.oh-har__suggestion')).toHaveCount(0);

    await popup.screenshot({ path: 'test-results/har-import-dialog.png' });
    await popup.locator('[x-test="har-confirm"]').click();

    // The dialog closes, and the imported requests are in the list behind it.
    await expect(popup.locator('oh-my-har-import')).toHaveCount(0);
    await expect(popup.locator('[x-test="list-request-item"]')).toHaveCount(3);

    // Stored as this extension stores requests: its own record per request,
    // listed by id on the domain's state.
    const state = await ohMy.getState(SITE_DOMAIN);
    expect((state as { requests: string[] }).requests.length).toBe(3);

    // Readable in the list. `IData.url` holds the regex the interception matches
    // against — `(https?://localhost:8090)?/api/json` — which is what the rows
    // used to show, one character per row of noise. `displayUrl` carries the url
    // it was built from, and that is what the endpoint cell is labelled with.
    await expect(
      popup.locator(`[x-test="row-endpoint"][title="${SITE_ORIGIN}/api/json"]`)
    ).toHaveCount(1);

    await server.reset();

    await site.open();
    await site.waitForInjection();

    // The proof: the body comes from the file, and the server is never asked.
    // Requested relatively, the way a page actually calls its own API, while
    // the HAR only ever recorded the absolute url.
    const result = await site.request({
      transport: 'xhr', url: '/api/json', responseType: 'json'
    });

    expect(result.json.source).toBe('har');
    expect(await server.hitCount('GET /api/json')).toBe(0);

    // The repeated call kept the last body of each status code, and the mock
    // that is *active* is the lowest status code — the 200 — even though the
    // session ended on the 500. The 500 is saved next to it, one click away.
    const users = await site.request({ url: '/api/users', responseType: 'json' });

    expect(JSON.stringify(users.json)).toContain('fresh');
    expect(JSON.stringify(users.json)).not.toContain('stale');
    expect(users.status).toBe(200);
    expect(await server.hitCount('GET /api/users')).toBe(0);

    // The base64 body of a textual response was decoded on the way in.
    const echo = await site.request({
      method: 'POST', url: '/api/echo', responseType: 'json'
    });

    expect(echo.status).toBe(201);
    expect(echo.json.ok).toBeTruthy();

    // Nothing was imported for the endpoints the filters dropped, so they still
    // reach the server.
    const image = await site.request({ url: '/api/image.png', responseType: 'text' });

    expect(image.status).toBe(200);
    expect(await server.hitCount('GET /api/image.png')).toBe(1);

    await popup.close();
  });

  test('a file that is not a HAR is reported, not swallowed', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await site.open();
    await ohMy.setActive(SITE_DOMAIN);

    const tabId = await ohMy.tabIdFor(SITE_ORIGIN);
    const popup = await openPopup(context, extensionId, { domain: SITE_DOMAIN, tabId });

    await popup.addStyleTag({
      content: 'oh-my-connection-failure { display: none !important; }'
    });

    await openDrawer(popup);
    await popup.locator('[x-test="import-har"]').click();
    await popup.locator('oh-my-har-import input[type="file"]').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('this is not a HAR file')
    });

    await expect(popup.locator('[x-test="har-error"]')).toContainText('Not valid JSON');
    await expect(popup.locator('.oh-har__row')).toHaveCount(0);

    await popup.close();
  });
});
