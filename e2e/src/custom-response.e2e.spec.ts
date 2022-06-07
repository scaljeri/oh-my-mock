import { test, BrowserContext, expect, chromium, Page } from '@playwright/test';
import { setgroups } from 'process';
import { XAppPO } from './po/app.po';
import { TestSitePo } from './po/test-site.po';
import { setup } from './setup';

test.describe('Custom response', () => {
  test('ok', () => {
    expect(true).toBeTruthy();
  });
});
