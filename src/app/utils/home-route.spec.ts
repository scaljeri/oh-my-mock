import { activeTab, isHomePage } from './home-route';

/**
 * One rule, two dependants: the tab strip and the mock sidebar both hide off
 * home. Written twice they would drift, and the symptom would be a sidebar with
 * no tabs above it — or worse, the mock list sitting beside the domains page as
 * though the two had anything to do with each other.
 */
describe('home-route', () => {
  describe('activeTab', () => {
    it('reads the request list and its open request as one tab', () => {
      expect(activeTab('/')).toBe('requests');
      expect(activeTab('')).toBe('requests');
      expect(activeTab('/request/abc123')).toBe('requests');
    });

    it('reads the cookies page as the other', () => {
      expect(activeTab('/cookies')).toBe('cookies');
      expect(activeTab('/cookies/new')).toBe('cookies');
    });

    it('has no tab for the pages that stand on their own', () => {
      expect(activeTab('/domains')).toBeNull();
      expect(activeTab('/state-explore')).toBeNull();
      expect(activeTab('/json-export')).toBeNull();
      expect(activeTab('/remote-mocking')).toBeNull();
    });

    it('ignores a query string and a fragment', () => {
      expect(activeTab('/?tabId=7')).toBe('requests');
      expect(activeTab('/domains?tabId=7')).toBeNull();
    });
  });

  describe('isHomePage', () => {
    it('is the request list and the cookies beside it', () => {
      expect(isHomePage('/')).toBe(true);
      expect(isHomePage('/request/abc123')).toBe(true);
      expect(isHomePage('/cookies')).toBe(true);
    });

    it('is not the domains page, which is a page of its own', () => {
      expect(isHomePage('/domains')).toBe(false);
      expect(isHomePage('/remote-mocking')).toBe(false);
      expect(isHomePage('/state-explore')).toBe(false);
      expect(isHomePage('/json-export')).toBe(false);
    });
  });
});
