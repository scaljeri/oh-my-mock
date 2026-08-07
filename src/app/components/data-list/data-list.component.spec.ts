import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';

import { DataListComponent } from './data-list.component';
import { RouterTestingModule } from '@angular/router/testing';
import { AnimationBuilder } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { WebWorkerService } from '../../services/web-worker.service';
import { OhMyState } from '../../services/oh-my-store';
import { objectTypes } from '@shared/constants';
import { IData, IOhMyAux, IState, ohMyDataId } from '@shared/type';

function request(id: ohMyDataId, lastHit: number, calledAt?: number): IData {
  return {
    id,
    url: `/api/${id}`,
    method: 'GET',
    requestType: 'XHR',
    selected: {},
    enabled: {},
    mocks: {},
    lastHit,
    // Absent unless asked for, which is the shape of every request that has
    // not actually been intercepted — an import, or one typed by hand.
    ...(calledAt !== undefined && { calledAt }),
    lastModified: 0,
    version: '3.0.0',
    type: objectTypes.REQUEST
  };
}

function state(
  requests: ohMyDataId[],
  aux: IOhMyAux = {},
  domain = 'localhost:8090'
): IState {
  return {
    version: '3.0.0',
    type: objectTypes.STATE,
    domain,
    requests,
    aux,
    presets: { default: 'Default' },
    context: { domain, preset: 'default' }
  };
}

describe('DataListComponent', () => {
  let component: DataListComponent;
  let fixture: ComponentFixture<DataListComponent>;
  let updateAux: jest.Mock;
  let upsertRequest: jest.Mock;
  let deleteRequest: jest.Mock;

  beforeEach(async () => {
    updateAux = jest.fn().mockResolvedValue(undefined);
    // Only here so it can be asserted *not* to have been called — see the
    // traffic view below. A mock is worth more than any view state, and the
    // one control that could plausibly reach one must be shown not to.
    upsertRequest = jest.fn().mockResolvedValue(undefined);
    deleteRequest = jest.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      schemas: [NO_ERRORS_SCHEMA],
      imports: [MatMenuModule, RouterTestingModule.withRoutes([]), MatTableModule, DataListComponent],
      providers: [AnimationBuilder, { provide: MatDialog, useValue: {} },
        { provide: WebWorkerService, useValue: {} },
        // The real store would go to `chrome.storage`, which is not there.
        {
          provide: OhMyState,
          useValue: {
            updateAux,
            upsertRequest,
            deleteRequest,
            // The list reads the browser-global sort preference on init.
            getStore: async () => ({}),
            updateStore: async () => ({})
          }
        }],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DataListComponent);
    component = fixture.componentInstance;
    component.state = state([]);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  function click(): MouseEvent {
    return new MouseEvent('click');
  }

  describe('pinning', () => {
    beforeEach(() => {
      component.state = state(['a', 'b', 'c']);
      component.data = { a: request('a', 300), b: request('b', 200), c: request('c', 100) };
      component.filteredRequests = ['a', 'b', 'c'];
    });

    it('moves a pinned row to the top and marks it', () => {
      component.onToggleSticky('c', click());

      expect(component.viewRows.map(r => r.id)).toEqual(['c', 'a', 'b']);
      expect(component.viewRows[0].isSticky).toBe(true);
    });

    it('keeps a pinned row when the filter drops it', () => {
      component.onToggleSticky('c', click());
      component.onFilterUpdate({ filteredRequests: ['a'] });

      expect(component.viewRows.map(r => r.id)).toEqual(['c', 'a']);
    });

    it('unpins on a second click and lets the row fall back into the sort', () => {
      component.onToggleSticky('c', click());
      component.onToggleSticky('c', click());

      expect(component.stickyIds).toEqual([]);
      expect(component.viewRows.map(r => r.id)).toEqual(['a', 'b', 'c']);
    });

    it('does not let the click through to the row underneath', () => {
      const event = click();
      const stopPropagation = jest.spyOn(event, 'stopPropagation');

      component.onToggleSticky('c', event);

      expect(stopPropagation).toHaveBeenCalled();
    });

    it('narrows the list to the pinned rows on request', () => {
      component.onToggleSticky('b', click());
      component.onToggleStickyOnly(true);

      expect(component.viewRows.map(r => r.id)).toEqual(['b']);
    });

    it('leaves sticky-only mode when the last pin goes', () => {
      component.onToggleSticky('b', click());
      component.onToggleStickyOnly(true);
      component.onToggleSticky('b', click());

      expect(component.stickyOnly).toBe(false);
      expect(component.viewRows.map(r => r.id)).toEqual(['a', 'b', 'c']);
    });

    it('drops a pin whose request has been deleted', () => {
      component.onToggleSticky('c', click());
      component.state = state(['a', 'b']);
      component.data = { a: request('a', 300), b: request('b', 200) };
      component.onFilterUpdate({ filteredRequests: ['a', 'b'] });

      expect(component.stickyIds).toEqual([]);
      expect(component.viewRows.map(r => r.id)).toEqual(['a', 'b']);
    });
  });

  describe('persisting the pins', () => {
    /**
     * A component whose state subscription lives inside the fake zone.
     *
     * The one from the outer `beforeEach` subscribes in the real zone, and
     * `debounceTime` reuses the timer it created there — `tick` would never
     * fire it. Subscribing here, with the inputs already set, keeps the whole
     * chain on the fake clock.
     */
    function createInZone(inputs: (c: DataListComponent) => void): DataListComponent {
      const created = TestBed.createComponent(DataListComponent);

      inputs(created.componentInstance);
      created.detectChanges();
      tick(200);

      return created.componentInstance;
    }

    it('writes the pinned ids, in pin order, when a row is pinned', () => {
      component.state = state(['a', 'b', 'c']);
      component.context = { domain: 'localhost:8090', preset: 'default' };

      component.onToggleSticky('c', click());
      component.onToggleSticky('a', click());

      expect(updateAux).toHaveBeenLastCalledWith(
        { stickyRequests: ['c', 'a'] },
        component.context
      );
    });

    it('writes the shortened list when a row is unpinned', () => {
      component.state = state(['a', 'b', 'c']);
      component.context = { domain: 'localhost:8090', preset: 'default' };

      component.onToggleSticky('c', click());
      component.onToggleSticky('a', click());
      component.onToggleSticky('c', click());

      expect(updateAux).toHaveBeenLastCalledWith(
        { stickyRequests: ['a'] },
        component.context
      );
    });

    it('reads them back — a reopened popup finds its pins', fakeAsync(() => {
      const reopened = createInZone(c => {
        c.requests = { a: request('a', 300), b: request('b', 200), c: request('c', 100) };
        c.filteredRequests = ['a', 'b', 'c'];
        c.state = state(['a', 'b', 'c'], { stickyRequests: ['c', 'a'] });
      });

      expect(reopened.stickyIds).toEqual(['c', 'a']);
      expect(reopened.viewRows.map(r => r.id)).toEqual(['c', 'a', 'b']);
    }));

    it('ignores a stored pin whose request is gone, and writes the pruned list back', fakeAsync(() => {
      const reopened = createInZone(c => {
        c.requests = { a: request('a', 300), b: request('b', 200) };
        c.state = state(['a', 'b'], { stickyRequests: ['gone', 'a'] });
      });

      expect(reopened.stickyIds).toEqual(['a']);
      expect(updateAux).toHaveBeenCalledWith(
        { stickyRequests: ['a'] },
        reopened.context
      );
    }));

    it('does not write back when the stored list is already clean', fakeAsync(() => {
      const reopened = createInZone(c => {
        c.requests = { a: request('a', 300), b: request('b', 200) };
        c.state = state(['a', 'b'], { stickyRequests: ['b'] });
      });

      updateAux.mockClear();

      // A second state, as an incoming hit would produce.
      reopened.state = state(['a', 'b'], { stickyRequests: ['b'] });
      tick(200);

      expect(updateAux).not.toHaveBeenCalled();
      expect(reopened.stickyIds).toEqual(['b']);
    }));

    it('does not let a state that predates the write undo a second pin', fakeAsync(() => {
      const c = createInZone(inst => {
        inst.requests = { a: request('a', 300), b: request('b', 200), c: request('c', 100) };
        inst.state = state(['a', 'b', 'c']);
      });

      c.onToggleSticky('c', click());
      c.onToggleSticky('a', click());

      // The store answers the *first* write while the second is still on its
      // way; taking this list would drop the pin the user just set.
      c.state = state(['a', 'b', 'c'], { stickyRequests: ['c'] });
      tick(200);

      expect(c.stickyIds).toEqual(['c', 'a']);

      // And once the second write lands, reads are accepted again.
      c.state = state(['a', 'b', 'c'], { stickyRequests: ['c', 'a'] });
      tick(200);
      c.state = state(['a', 'b', 'c'], { stickyRequests: ['c'] });
      tick(200);

      expect(c.stickyIds).toEqual(['c']);
    }));

    it('keeps another domain\'s pins out of its aux — no write without persistFilter', () => {
      component.persistFilter = false;
      component.state = state(['a', 'b', 'c']);
      component.context = { domain: 'other.example.com', preset: 'default' };

      component.onToggleSticky('c', click());

      expect(updateAux).not.toHaveBeenCalled();
      expect(component.stickyIds).toEqual(['c']);
    });
  });

  describe('selectAll', () => {
    // "All" is what is on screen. The state's id list also carries the
    // requests of groups that are off; selecting those handed the JSON export
    // mocks the list never showed.
    it('selects only the rows the list shows', () => {
      component.state = state(['a', 'b']);
      component.data = { a: request('a', 300) }; // `b`'s group is off

      component.selectAll();

      expect(component.selection.selected).toEqual(['a']);
    });
  });

  /**
   * The traffic view and its Clear.
   *
   * Two claims, and the second one matters more than anything else in this
   * file: the mode hides mocks, so it must not be the default, and Clear must
   * be incapable of reaching a mock at all.
   */
  describe('the traffic view', () => {
    beforeEach(() => {
      component.state = state(['a', 'b']);
      component.context = { domain: 'localhost:8090', preset: 'default' };
      // `a` was intercepted; `b` is a stored mock nobody has called.
      component.data = { a: request('a', 300, 300), b: request('b', 200) };
      component.filteredRequests = ['a', 'b'];
      // The only public way to force a redraw with the inputs set by hand —
      // the same lever the pinning specs above pull.
      component.onFilterUpdate({ filteredRequests: ['a', 'b'] });
      updateAux.mockClear();
    });

    it('starts off, showing the mocks that have never been called', () => {
      expect(component.trafficOnly).toBe(false);
      expect(component.viewRows.map(r => r.id)).toEqual(['a', 'b']);
    });

    it('narrows to what was actually intercepted once it is switched on', () => {
      component.onToggleTrafficOnly(true);

      expect(component.viewRows.map(r => r.id)).toEqual(['a']);
    });

    it('gives the uncalled mocks back when it is switched off again', () => {
      component.onToggleTrafficOnly(true);
      component.onToggleTrafficOnly(false);

      expect(component.viewRows.map(r => r.id)).toEqual(['a', 'b']);
    });

    it('counts the traffic, not the rows', () => {
      expect(component.trafficCount).toBe(1);
    });

    describe('Clear', () => {
      it('empties the traffic list at once, without waiting for the write', () => {
        component.onToggleTrafficOnly(true);
        component.onClearTraffic();

        expect(component.viewRows).toEqual([]);
      });

      it('stores the moment it was cleared, and nothing else', () => {
        component.onClearTraffic();

        expect(updateAux).toHaveBeenCalledTimes(1);
        const [aux, context] = updateAux.mock.calls[0];
        expect(Object.keys(aux)).toEqual(['trafficClearedAt']);
        expect(aux.trafficClearedAt).toBeGreaterThan(0);
        expect(context).toBe(component.context);
      });

      /**
       * The one thing this button must never do. Losing a user's mocks to a
       * Clear button would be the worst outcome available here, so clearing
       * stores a marker (`aux.trafficClearedAt`) rather than stripping
       * `calledAt` from each record — there is no code path from here to a
       * request at all.
       */
      it('does not write to a single request record', () => {
        const before = JSON.stringify(component.data);

        component.onClearTraffic();

        expect(upsertRequest).not.toHaveBeenCalled();
        expect(deleteRequest).not.toHaveBeenCalled();
        expect(JSON.stringify(component.data)).toBe(before);
      });

      it('leaves the mocks in the list — only the traffic is forgotten', () => {
        component.onClearTraffic();

        expect(component.viewRows.map(r => r.id)).toEqual(['a', 'b']);
      });

      it('lets a request that is called again come straight back', () => {
        component.onToggleTrafficOnly(true);
        component.onClearTraffic();

        component.data = {
          ...component.data,
          a: request('a', 900, component.trafficClearedAt + 1)
        };
        component.onFilterUpdate({ filteredRequests: ['a', 'b'] });

        expect(component.viewRows.map(r => r.id)).toEqual(['a']);
      });

      /**
       * The state explorer renders another domain's list through this
       * component with `persistFilter` false, the same condition under which
       * the pins and the filter are not written back.
       */
      it('does not write to another domain\'s state', () => {
        component.persistFilter = false;

        component.onClearTraffic();

        expect(updateAux).not.toHaveBeenCalled();
      });
    });

    /**
     * The marker arrives back from storage, which takes a moment — and any
     * state emitted in that window still carries the old one.
     */
    describe('reading the marker back', () => {
      /**
       * A component whose state subscription lives inside the fake zone — the
       * same trick, and for the same reason, as `createInZone` above.
       */
      function subscribed(inputs: (c: DataListComponent) => void): DataListComponent {
        const created = TestBed.createComponent(DataListComponent);

        inputs(created.componentInstance);
        created.detectChanges();
        tick(200);

        return created.componentInstance;
      }

      it('does not un-clear when a state that predates the write arrives', fakeAsync(() => {
        const live = subscribed(c => {
          c.requests = { a: request('a', 300, 300), b: request('b', 200) };
          c.state = state(['a', 'b']);
        });

        live.onToggleTrafficOnly(true);
        live.onClearTraffic();
        expect(live.viewRows).toEqual([]);

        // The write is still on its way to the background; this state was read
        // before it landed, so its aux has no marker at all.
        live.state = state(['a', 'b']);
        tick(200);

        expect(live.viewRows).toEqual([]);
      }));

      it('takes the stored marker when it is the newer of the two', fakeAsync(() => {
        const live = subscribed(c => {
          c.requests = { a: request('a', 300, 300) };
          c.state = state(['a']);
        });

        live.onToggleTrafficOnly(true);
        expect(live.viewRows.map(r => r.id)).toEqual(['a']);

        // Another popup on the same domain cleared it.
        live.state = state(['a'], { trafficClearedAt: 400 });
        tick(200);

        expect(live.viewRows).toEqual([]);
      }));

      /**
       * The marker is per domain. Carrying one domain's forward would hide
       * traffic on the next domain that had never been cleared at all — and
       * the popup switches domains without rebuilding this component.
       */
      it('starts from the new domain\'s own marker when the domain changes', fakeAsync(() => {
        const live = subscribed(c => {
          c.requests = { a: request('a', 300, 300) };
          c.state = state(['a']);
        });

        live.onToggleTrafficOnly(true);
        live.onClearTraffic();
        expect(live.viewRows).toEqual([]);

        live.requests = { z: request('z', 100, 100) };
        live.state = state(['z'], {}, 'example.com');
        tick(200);

        expect(live.trafficClearedAt).toBe(0);
        expect(live.viewRows.map(r => r.id)).toEqual(['z']);
      }));
    });
  });

  describe('selection', () => {
    beforeEach(() => {
      component.state = state(['a', 'b']);
      component.data = { a: request('a', 300), b: request('b', 200) };
      component.filteredRequests = ['a', 'b'];
      component.togglableRows = true;
    });

    it('tracks the row by id, not by its position in the list', () => {
      component.onDataClick(component.data['b']);

      expect(component.selection.isSelected('b')).toBe(true);
      expect(component.selection.isSelected('a')).toBe(false);
    });

    // The reported bug: clicking a second row left the first one highlighted
    // and filter-exempt, so the selection only ever grew.
    it('moves the selection instead of adding to it', () => {
      component.onDataClick(component.data['a']);
      component.onDataClick(component.data['b']);

      expect(component.selection.selected).toEqual(['b']);
    });

    it('keeps a selected row visible when the filter would drop it', () => {
      component.onDataClick(component.data['b']);
      component.onFilterUpdate({ filteredRequests: ['a'] });

      expect(component.viewRows.map(r => r.id)).toEqual(['a', 'b']);
    });

    it('does not hoist the selected row above the others', () => {
      component.onDataClick(component.data['b']);

      expect(component.viewRows.map(r => r.id)).toEqual(['a', 'b']);
      expect(component.viewRows.every(r => r.isSticky)).toBe(false);
    });
  });
});
