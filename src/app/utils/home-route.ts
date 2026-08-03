export type ohMyTab = 'requests' | 'cookies';

/**
 * Which tab a url belongs to, or `null` for the pages that stand on their own.
 *
 * Cannot come from `routerLinkActive`: the Requests tab is `/`, and matching
 * that non-exactly makes every url match, while matching it exactly loses the
 * tab as soon as a request is opened at `/request/:id`.
 */
export function activeTab(url: string): ohMyTab | null {
  const path = url.split(/[?#]/)[0];

  if (path === '/' || path === '' || path.startsWith('/request')) {
    return 'requests';
  }

  if (path.startsWith('/cookies')) {
    return 'cookies';
  }

  return null;
}

/**
 * Whether `url` is the home page: the mocks on the left, the api calls beside
 * them.
 *
 * The other pages — domains, the state explorer, the JSON export, remote
 * mocking — are pages in their own right and get the whole window. They have
 * nothing to do with the mock list, and leaving it beside them said they did.
 *
 * One rule, in one place, because two things depend on it: the tab strip hides
 * itself off home, and so does the sidebar. Written twice they would drift, and
 * the symptom would be a sidebar with no tabs above it.
 */
export function isHomePage(url: string): boolean {
  return activeTab(url) !== null;
}
