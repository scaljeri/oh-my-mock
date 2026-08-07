/**
 * Making, renaming and unmaking a set of mocks, through the drawer.
 *
 * The unit specs cover the rules against doubles. What only a real browser can
 * show is that a group made here **exists** — a group is its record *and* its
 * id in `IOhMyMock.groups`, written by two different paths in the service
 * worker, and a create that writes only the record leaves a row that is on
 * screen until the popup is closed and gone for ever afterwards. Nothing
 * throws, nothing logs. Same for the delete: unlisting without removing, or
 * removing without unlisting, both look fine in the drawer that did it.
 *
 * So every assertion here goes through a *reopened* popup or through storage.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openDrawer, openPopup } from '../fixtures/popup';
import type { Page } from '@playwright/test';

/** Rows, in the order that decides who answers. */
const rows = (popup: Page) => popup.locator('[x-test="group-row"]');
const names = (popup: Page) => popup.locator('[x-test="group-name"]');

/**
 * Opens the actions on one row.
 *
 * They are transparent and `pointer-events: none` until the row is pointed at,
 * so the hover is not politeness — a click without it lands on the row behind.
 */
async function actionsOn(popup: Page, index: number) {
  const row = rows(popup).nth(index);

  await row.hover();

  return row;
}

async function createSet(popup: Page, name: string): Promise<void> {
  await popup.locator('[x-test="group-new"]').click();
  await popup.locator('[x-test="group-new-input"]').fill(name);
  await popup.locator('[x-test="group-new-save"]').click();
}

test.describe('managing sets of mocks from the drawer', () => {
  // Every test here opens the popup **twice** — once to make the change, once
  // to prove it survived — and an open waits on the domain's state having
  // loaded, which is the slowest thing a spec in this suite does. Two of them
  // together sit right on the 60s default, so the budget is stated rather than
  // left to the machine's mood.
  test.slow();

  test('a set created here is still there after the popup is reopened', async ({
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

    await openDrawer(popup);
    await expect(rows(popup)).toHaveCount(1);

    await createSet(popup, 'Payments');

    await expect(names(popup)).toHaveText(['My mocks', 'Payments']);
    // Empty, and saying so. It holds nothing until requests are filed under it.
    await expect(
      rows(popup).nth(1).locator('[x-test="group-count"]')
    ).toHaveText('0');

    // The half that a component test cannot see: the store lists it. Without
    // this write the record is unreachable on the next load — every reader
    // takes its group ids from that list.
    await expect
      .poll(async () => (await ohMy.groups(SITE_DOMAIN)).map((g) => g.name))
      .toEqual(['My mocks', 'Payments']);

    await popup.close();

    const reopened = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await openDrawer(reopened);
    await expect(names(reopened)).toHaveText(['My mocks', 'Payments']);

    await reopened.close();
  });

  /**
   * Including the domain's own set. Its record exists so it can be renamed —
   * which group it is comes from the derived id, so the name is only ever a
   * label, and "My mocks" is where it starts rather than what it is.
   */
  test('renaming sticks, for a new set and for the domain own one', async ({
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

    await openDrawer(popup);
    await createSet(popup, 'Payments');
    await expect(names(popup)).toHaveText(['My mocks', 'Payments']);

    await actionsOn(popup, 1);
    await popup.locator('[x-test="group-rename"]').nth(1).click();
    await popup.locator('[x-test="group-rename-input"]').fill('Billing');
    await popup.locator('[x-test="group-rename-save"]').click();

    await actionsOn(popup, 0);
    await popup.locator('[x-test="group-rename"]').nth(0).click();
    await popup.locator('[x-test="group-rename-input"]').fill('Staging');
    await popup.locator('[x-test="group-rename-save"]').click();

    await expect(names(popup)).toHaveText(['Staging', 'Billing']);

    await popup.close();

    const reopened = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await openDrawer(reopened);
    await expect(names(reopened)).toHaveText(['Staging', 'Billing']);
    // Renamed, not replaced: the domain's own group keeps its derived id, so
    // the untagged mock is still counted under it.
    await expect(
      reopened.locator('[x-test="group-count"]').first()
    ).toHaveText('1');

    await reopened.close();
  });

  /**
   * The decision this feature had to make, and the one that costs data.
   *
   * A request tagged with a group that is gone is served by nobody, drawn by
   * nobody and counted by nobody — so leaving the records behind does not keep
   * the mocks, it loses them somewhere nothing can reach while the domain
   * state goes on naming them. They are deleted with the set, and the drawer
   * says how many before it happens.
   */
  test('deleting a set says how many mocks go with it, and takes them', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    const own = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/own',
      response: { mine: true }
    });
    const theirs = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/theirs',
      response: { theirs: true }
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await openDrawer(popup);
    await createSet(popup, 'Payments');

    const created = (await ohMy.groups(SITE_DOMAIN)).find((g) => g.name === 'Payments');
    expect(created).toBeDefined();
    await ohMy.tagRequest(theirs.dataId, created?.id as string);

    await popup.close();

    const reopened = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await openDrawer(reopened);
    // One each: the tag moved a request from the domain's own set to the new
    // one, which is all membership is.
    await expect(reopened.locator('[x-test="group-count"]')).toHaveText([
      '1',
      '1'
    ]);

    await actionsOn(reopened, 1);
    await reopened.locator('[x-test="group-delete"]').nth(1).click();

    const warning = reopened.locator('[x-test="group-delete-warning"]');
    await expect(warning).toContainText('Payments');
    await expect(warning).toContainText('1 mock');

    await reopened.locator('[x-test="group-delete-confirm-btn"]').click();

    await expect(names(reopened)).toHaveText(['My mocks']);

    // Unlisted *and* gone: either half on its own is a state the drawer cannot
    // tell apart from success.
    await expect
      .poll(async () => (await ohMy.groups(SITE_DOMAIN)).map((g) => g.name))
      .toEqual(['My mocks']);
    await expect.poll(async () => ohMy.getRequest(theirs.dataId)).toBeFalsy();
    await expect
      .poll(async () => ohMy.getResponseBody(theirs.mockId))
      .toBeFalsy();

    // The state stops naming it too, or the list keeps a dead id for ever.
    const state = (await ohMy.getState(SITE_DOMAIN)) as { requests?: string[] };
    expect(state?.requests).toEqual([own.dataId]);

    // And the untagged mock is untouched — it belongs to the domain's own set,
    // which nothing here deleted.
    expect(await ohMy.getRequest(own.dataId)).toBeTruthy();

    await reopened.close();
  });

  /**
   * The domain's own set exists by virtue of the domain: its id is derived
   * from it, so `ensureGroups` writes it straight back on the next store
   * write — with every untagged mock of the domain belonging nowhere in
   * between. Refused, and said out loud rather than greyed out: a button that
   * does nothing leaves someone clicking and guessing.
   */
  test('refuses to delete the domain own set, and says why', async ({
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

    await openDrawer(popup);
    await actionsOn(popup, 0);
    await popup.locator('[x-test="group-delete"]').first().click();

    await expect(
      popup.locator('[x-test="group-delete-refusal"]')
    ).toContainText(SITE_DOMAIN);
    // No way through it. The refusal is the whole strip, not a warning with a
    // Delete button underneath.
    await expect(
      popup.locator('[x-test="group-delete-confirm-btn"]')
    ).toHaveCount(0);

    await popup.locator('[x-test="group-delete-cancel"]').click();

    await expect(names(popup)).toHaveText(['My mocks']);
    expect((await ohMy.groups(SITE_DOMAIN)).map((g) => g.name)).toEqual(['My mocks']);

    await popup.close();
  });
});
