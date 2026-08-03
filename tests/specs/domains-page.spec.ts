/**
 * Managing domains on a page of its own.
 *
 * The claim worth an e2e is the delete. `StoreUtils.removeState` existed, had a
 * unit test, and was called by nothing: the REMOVE handler dropped a domain's
 * records and left the domain itself in `store.domains`, pointing at a record it
 * had just deleted. Nothing complained — the sidebar simply listed a host with
 * no mocks for ever.
 *
 * So this asserts against storage rather than the screen: gone from the list,
 * and the request record gone with it.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

/** Opens the popup straight on the Domains page. */
async function openDomainsPage(
  context: Parameters<typeof openPopup>[0],
  extensionId: string,
  tabId: number
) {
  const popup = await openPopup(context, extensionId, {
    domain: SITE_DOMAIN,
    tabId
  });

  await popup.goto(`${popup.url().split('#')[0]}#/domains`);

  return popup;
}

test.describe('the domains page', () => {
  test('lists what is stored, and marks the tab own domain', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openDomainsPage(
      context,
      extensionId,
      await ohMy.tabIdFor(SITE_ORIGIN)
    );

    const row = popup.locator('[x-test="domain-row"]', {
      hasText: SITE_DOMAIN
    });

    await expect(row).toHaveCount(1);
    await expect(row).toContainText('1 requests');
    // Marked because the tab is on it — not because anyone picked it here.
    await expect(row.locator('[x-test="domain-active"]')).toBeVisible();

    // And first. The store lists domains in the order they were first seen, so
    // the site you are on lands wherever it happens to fall — and it is nearly
    // always why the page was opened. `scaljeri.github.io` is seeded by the
    // demo import and comes before it in that order.
    await expect(popup.locator('[x-test="domain-row"]').first()).toContainText(
      SITE_DOMAIN
    );

    await popup.close();
  });

  /**
   * Adding a domain used to overwrite the domain you were *on*.
   *
   * `OhMySendToBg.full` fills the packet context with the popup's own domain
   * whether or not the caller asked for one, and the state handler preferred
   * that over the domain named by the state itself. So the new domain was never
   * created, and the mocks of the one on screen were replaced by an empty state
   * — no throw, no log, just a domain that had gone quiet.
   */
  test('a domain typed in is stored, without navigating to it', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openDomainsPage(
      context,
      extensionId,
      await ohMy.tabIdFor(SITE_ORIGIN)
    );

    await popup.locator('[x-test="new-domain"]').fill('typed.example.org');
    await popup.locator('[x-test="add-domain"]').click();

    await expect(
      popup.locator('[x-test="domain-row"]', { hasText: 'typed.example.org' })
    ).toHaveCount(1);

    // The tab decides which domain is being looked at, and adding one does not
    // change the tab.
    await expect(
      popup
        .locator('[x-test="domain-row"]', { hasText: SITE_DOMAIN })
        .locator('[x-test="domain-active"]')
    ).toBeVisible();

    // And the domain that was on screen still has its mock — the part that was
    // silently destroyed.
    const state = (await ohMy.getState(SITE_DOMAIN)) as { requests?: string[] };
    expect(state?.requests ?? []).toHaveLength(1);

    await popup.close();
  });

  test('forgetting a domain takes it out of the store, mocks and all', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    const { dataId } = await ohMy.seedMock({
      domain: 'doomed.example.org',
      url: '/api/json',
      response: { a: 1 }
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openDomainsPage(
      context,
      extensionId,
      await ohMy.tabIdFor(SITE_ORIGIN)
    );

    const row = popup.locator('[x-test="domain-row"]', {
      hasText: 'doomed.example.org'
    });
    await expect(row).toHaveCount(1);

    // Nothing happens on the first click — there is no undo behind the second.
    await row.locator('[x-test="delete-domain"]').click();
    expect(await ohMy.getState('doomed.example.org')).toBeTruthy();

    await row.locator('[x-test="confirm-delete"]').click();
    await expect(row).toHaveCount(0);

    // The record, the request it named, and — the part that was broken — its
    // place in the store's domain list.
    await expect
      .poll(async () => await ohMy.getState('doomed.example.org'))
      .toBeFalsy();
    expect(await ohMy.getRequest(dataId)).toBeFalsy();
    expect(await ohMy.domains()).not.toContain('doomed.example.org');

    await popup.close();
  });

  /**
   * The drawer, not a column.
   *
   * The mock list and the navigation live over the left of the page and only
   * when asked for, so the api call list has the window to itself — and so the
   * pages that are not home are not wearing a sidebar that has nothing to do
   * with them. Everything in the drawer is reachable from every page, which is
   * what lets there be no back button.
   */
  test('is reached from the drawer, which is closed until it is asked for', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    const drawer = popup.locator('.oh-drawer');
    const list = popup.locator('.oh-main');

    // Closed to start with: the drawer is slid out of the window, and the api
    // call list has the whole width.
    await expect(drawer).not.toHaveClass(/is-open/);
    const closedBox = await list.boundingBox();
    expect(closedBox?.x).toBeCloseTo(0, 0);

    await popup.locator('[x-test="hamburger-menu-btn"]').click();
    await expect(drawer).toHaveClass(/is-open/);

    // The mocks are in it, and so is the way to every other page.
    await expect(popup.locator('[x-test="group-item"]')).toHaveCount(1);
    await popup.locator('[x-test="nav-domains"]').click();

    // Picking something closes it — a drawer left standing over the result is
    // something you have to click away twice.
    await expect(popup.locator('[x-test="domain-row"]').first()).toBeVisible();
    await expect(drawer).not.toHaveClass(/is-open/);

    // The list underneath never gave up any width for it.
    const openedBox = await list.boundingBox();
    expect(openedBox?.x).toBeCloseTo(closedBox?.x ?? -1, 0);
    expect(openedBox?.width).toBeCloseTo(closedBox?.width ?? -1, 0);

    // And back, from the same drawer: these pages have nothing else on screen
    // that navigates.
    await popup.locator('[x-test="hamburger-menu-btn"]').click();
    await popup.locator('[x-test="nav-requests"]').click();
    await expect(popup.locator('[x-test="tab-requests"]')).toBeVisible();

    await popup.close();
  });

  test('the drawer closes by clicking away from it', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await popup.locator('[x-test="hamburger-menu-btn"]').click();
    await expect(popup.locator('.oh-drawer')).toHaveClass(/is-open/);

    // Without this the only way out is the hamburger, which is the one place
    // people do not look.
    await popup.locator('[x-test="drawer-scrim"]').click();
    await expect(popup.locator('.oh-drawer')).not.toHaveClass(/is-open/);

    await popup.close();
  });

});
