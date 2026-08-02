/**
 * The sidebar is the mock group list now, with the domains as a filter above it.
 *
 * The unit specs cover the counting and the toggle against a storage double.
 * What they cannot show is that a real profile has a group at all: the records
 * are created by `ensureGroups` in the service worker, keyed on the shape rather
 * than on a version, and a migration that does not run is this project's
 * favourite way of failing silently — no throw, no log, just an empty list.
 *
 * So this asserts on a browser that was never told about groups: the local group
 * exists, it is named, and it counts the domain's mocks even though not one of
 * them carries a tag.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

test.describe('the sidebar group list', () => {
  test('a domain that predates groups still has one, holding its mocks', async ({
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

    const group = popup.locator('[x-test="group-item"]');

    await expect(group).toHaveCount(1);
    await expect(group.locator('[x-test="group-name"]')).toHaveText('My mocks');
    // The seeded request carries no `groupId` — nothing does yet. It counts
    // because absent means "this domain's own local group"; had that default
    // gone the other way, every existing profile would read as empty here.
    await expect(group.locator('[x-test="group-count"]')).toHaveText('1');
    // This browser's own mocks are the ordinary case, so the row carries no
    // source label — only the ones that come from somewhere else do.
    await expect(group.locator('[x-test="group-source"]')).toHaveCount(0);
    await expect(group).toHaveAttribute('aria-checked', 'true');

    await popup.close();
  });

  test('switching it off is remembered, and only for this domain', async ({
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

    const group = popup.locator('[x-test="group-item"]');
    await expect(group).toHaveAttribute('aria-checked', 'true');

    await group.click();
    await expect(group).toHaveAttribute('aria-checked', 'false');

    // Still drawn — a group nobody can see is a group nobody can switch back on.
    await expect(group).toHaveCount(1);

    // The exception is what is stored, on the domain rather than on the group.
    await expect
      .poll(async () => {
        const state = (await ohMy.getState(SITE_DOMAIN)) as {
          aux?: { disabledGroups?: string[] };
        };

        return state?.aux?.disabledGroups?.length ?? 0;
      })
      .toBe(1);

    await popup.close();

    // And it survives the popup being closed and opened again, which is the
    // whole reason the exception is stored rather than held in the component.
    const reopened = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await expect(reopened.locator('[x-test="group-item"]')).toHaveAttribute(
      'aria-checked',
      'false'
    );

    await reopened.close();
  });
});
