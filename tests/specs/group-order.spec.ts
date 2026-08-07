/**
 * The order of the mock sets in the drawer is not presentation.
 *
 * It is `IOhMyMock.groups`: `GroupUtils.coveringFor` ranks by position in that
 * list, and `OhMyRequestIndex.find` walks the groups in that order and takes
 * the first one holding a match. When two sets both know an endpoint, the
 * higher one answers — so dragging a row changes what the page is served.
 *
 * Which is what this asserts. "The rows moved" would pass just as happily with
 * a list that reorders itself locally and writes nothing, and that is exactly
 * the failure this project keeps producing: no throw, no log, the mock carrying
 * on as before.
 */

import type { Page } from '@playwright/test';
import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openDrawer, openPopup } from '../fixtures/popup';

/** The set names the drawer is showing, top first. */
const names = (popup: Page) =>
  popup.locator('.oh-group-nav__list [x-test="group-name"]');

/**
 * Drags the row at `from` onto the row at `to`.
 *
 * The CDK starts a drag once the pointer has moved past a threshold and decides
 * the landing index from where the pointer is relative to the other rows'
 * midpoints — so a single `mouse.move` to the target's centre is not reliably
 * past it. The move is therefore stepped, and aimed three quarters of the way
 * into the target row in the direction of travel.
 */
async function dragGroup(popup: Page, from: number, to: number): Promise<void> {
  const grips = popup.locator('.oh-group-nav__list [x-test="group-grip"]');

  // `hover` rather than nothing, and before the boxes are read: it waits for
  // the element to hold still, and the drawer slides in. `boundingBox` does no
  // such waiting, so a box read mid-animation aims the drag at where the row
  // used to be.
  await grips.nth(from).hover();

  const source = await grips.nth(from).boundingBox();
  const target = await grips.nth(to).boundingBox();

  if (!source || !target) {
    throw new Error(`No group rows at ${from} and ${to} to drag between`);
  }

  const x = source.x + source.width / 2;
  const y = source.y + source.height / 2;
  const landing =
    to > from ? target.y + target.height * 0.75 : target.y + target.height * 0.25;

  await popup.mouse.move(x, y);
  await popup.mouse.down();
  // Past the CDK's start threshold before anything else, so the first real
  // move is already a drag rather than the gesture that begins one.
  await popup.mouse.move(x, y + (to > from ? 8 : -8), { steps: 4 });
  await popup.mouse.move(x, landing, { steps: 12 });
  await popup.mouse.up();
}

test.describe('reordering the mock sets', () => {
  /** The seeded set that came from somewhere else — `local:<domain>` is derived. */
  let theirs: string;

  /**
   * Two sets, both answering `/api/json`, so which one wins is the only thing
   * the order can be read off.
   */
  test.beforeEach(async ({ ohMy, site }) => {
    theirs = await ohMy.seedGroup({ domains: [SITE_DOMAIN], name: "Anna's" });

    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { from: 'anna' },
      groupId: theirs
    });
    // Untagged, which is how every stored request looks: it belongs to the
    // domain's own local set.
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { from: 'mine' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();
  });

  test('the set that is moved up is the one that answers', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    // `seedGroup` lists Anna's set first, and the domain's own sorts last
    // whether or not `ensureGroups` has listed it yet — `coveringFor` ranks an
    // id the store does not name at the end. So Anna's answers to begin with.
    expect(
      (await site.request({ url: '/api/json', responseType: 'json' })).json
    ).toEqual({ from: 'anna' });

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await openDrawer(popup);
    await expect(names(popup)).toHaveText(["Anna's", 'My mocks']);

    await dragGroup(popup, 0, 1);

    await expect(names(popup)).toHaveText(['My mocks', "Anna's"]);

    // The store, not the rows: a list that reorders itself and writes nothing
    // looks exactly the same on screen.
    //
    // Their *relative* order, not their indices. `store.groups` is global and
    // holds the demo domain's set too — the background re-imports the demo data
    // whenever it starts up — so nothing here is at a fixed position.
    await expect
      .poll(async () =>
        (await ohMy.groupOrder()).filter(
          (id) => id === theirs || id === `local:${SITE_DOMAIN}`
        )
      )
      .toEqual([`local:${SITE_DOMAIN}`, theirs]);

    // And the whole point — the other set now answers.
    await expect
      .poll(
        async () =>
          (await site.request({ url: '/api/json', responseType: 'json' })).json
      )
      .toEqual({ from: 'mine' });

    // Back again, which goes the other way round: the neighbour is a set the
    // store already lists rather than the derived local one.
    await dragGroup(popup, 1, 0);

    await expect(names(popup)).toHaveText(["Anna's", 'My mocks']);
    await expect
      .poll(
        async () =>
          (await site.request({ url: '/api/json', responseType: 'json' })).json
      )
      .toEqual({ from: 'anna' });

    await popup.close();
  });

  /**
   * The CDK's drag listens for pointers only, so without this the serving order
   * cannot be changed without a mouse.
   */
  test('the arrow keys move a set the same way', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await openDrawer(popup);
    await expect(names(popup)).toHaveText(["Anna's", 'My mocks']);

    await popup
      .locator('.oh-group-nav__list [x-test="group-grip"]')
      .first()
      .press('ArrowDown');

    await expect(names(popup)).toHaveText(['My mocks', "Anna's"]);
    await expect
      .poll(
        async () =>
          (await site.request({ url: '/api/json', responseType: 'json' })).json
      )
      .toEqual({ from: 'mine' });

    await popup.close();
  });

  /**
   * Dragging must not be a second way of switching a set off. The row is a
   * checkbox and the grip sits inside it, so without a handle every drag that
   * ended on the row would also fire its click.
   */
  test('dragging a set does not switch it off', async ({
    context,
    extensionId,
    ohMy
  }) => {
    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await openDrawer(popup);
    await expect(names(popup)).toHaveText(["Anna's", 'My mocks']);

    await dragGroup(popup, 0, 1);

    await expect(names(popup)).toHaveText(['My mocks', "Anna's"]);

    for (const row of await popup.locator('[x-test="group-item"]').all()) {
      await expect(row).toHaveAttribute('aria-checked', 'true');
    }

    const state = (await ohMy.getState(SITE_DOMAIN)) as {
      aux?: { disabledGroups?: string[] };
    };

    expect(state?.aux?.disabledGroups ?? []).toEqual([]);

    await popup.close();
  });
});
