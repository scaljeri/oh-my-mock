import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { IOhMyAux, IOhMyGroup, IOhMyMock, IState, ohMyDomain } from '@shared/type';
import { GroupUtils } from '@shared/utils/group';
import { StateUtils } from '@shared/utils/state';
import { BehaviorSubject } from 'rxjs';
import { AppStateService } from '../../services/app-state.service';
import { OhMyState } from '../../services/oh-my-store';
import { HarImportComponent } from '../har-import/har-import.component';
import { DomainSidebarComponent } from './domain-sidebar.component';
import { DomainSummaryService, IOhMyDomainSummary } from './domain-summary.service';
import { StorageService } from '../../services/storage.service';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { IOhMyGroupRow } from './group-list.service';

describe('DomainSidebarComponent', () => {
  let component: DomainSidebarComponent;
  let fixture: ComponentFixture<DomainSidebarComponent>;
  let summaries: IOhMyDomainSummary[];
  let domains: ohMyDomain[];
  let appState: { domain: ohMyDomain; domain$: BehaviorSubject<ohMyDomain | null> };
  let upserted: unknown[];
  let opened: unknown[];
  /** Everything `StorageService` would read: states and group records. */
  let records: Record<string, unknown>;
  let auxWrites: IOhMyAux[];
  /** Every group change the component asked for, in order. */
  let groupWrites: { kind: string; id?: string; name?: string }[];
  let localGroup: IOhMyGroup;
  let cloudGroup: IOhMyGroup;
  /**
   * `IOhMyMock.groups`: both the order that decides which group answers *and*
   * the list that makes a group exist at all — the two are the same array, and
   * the sidebar's create, rename, delete and reorder all write it.
   */
  let groupOrder: string[];
  /** What `moveGroup` was asked to do, in order. */
  let moves: { id: string; after: string | null; domain: string }[];

  beforeEach(async () => {
    domains = ['example.com', 'api.staging.acme.io'];
    summaries = [
      { domain: 'example.com', requests: 3, cookies: 1 },
      { domain: 'api.staging.acme.io', requests: 0, cookies: 0 }
    ];
    upserted = [];
    opened = [];
    appState = { domain: '', domain$: new BehaviorSubject<ohMyDomain | null>('example.com') };

    auxWrites = [];
    groupWrites = [];
    // Through `defaultLocalFor`, because the id is what makes it the domain's
    // own — `GroupUtils.localFor` matches `local:<domain>` and nothing else.
    // A generated id here would describe a profile that cannot exist, and the
    // component would draw a *fourth* row for the derived group it is missing.
    localGroup = GroupUtils.defaultLocalFor('example.com');
    cloudGroup = GroupUtils.init({
      name: "Anna's",
      source: 'cloud',
      domains: ['example.com']
    });
    groupOrder = [localGroup.id, cloudGroup.id];
    moves = [];
    records = {
      'example.com': StateUtils.init({
        domain: 'example.com',
        requests: ['r1', 'r2', 'r3']
      }),
      // Untagged, so all three belong to the local group — the shape every
      // profile is in the moment groups ship.
      r1: { id: 'r1' },
      r2: { id: 'r2' },
      r3: { id: 'r3', groupId: cloudGroup.id },
      [localGroup.id]: localGroup,
      [cloudGroup.id]: cloudGroup
    };

    await TestBed.configureTestingModule({
      imports: [FormsModule, DomainSidebarComponent],
      providers: [
        // `routerLink` in the template needs a router; the component used to
        // get one from the module graph and now carries its own imports.
        provideRouter([]),
        { provide: AppStateService, useValue: appState },
        {
          provide: OhMyState,
          useValue: {
            getStore: () =>
              Promise.resolve({ domains, groups: [...groupOrder] } as IOhMyMock),
            // The background's job, done here by the same pure rule it uses —
            // so this double cannot quietly disagree with it about what
            // "after" means.
            moveGroup: (id: string, after: string | null, domain: string) => {
              moves.push({ id, after, domain });
              groupOrder = GroupUtils.moved(groupOrder, id, after);

              return Promise.resolve({ domains, groups: groupOrder } as IOhMyMock);
            },
            updateAux: (aux: IOhMyAux) => {
              auxWrites.push(aux);
              const state = records['example.com'] as IState;
              records['example.com'] = { ...state, aux: { ...state.aux, ...aux } };

              return Promise.resolve(records['example.com'] as IState);
            },
            upsertState: (state: unknown) => {
              upserted.push(state);
              return Promise.resolve(state);
            },
            createGroup: (name: string) => {
              const created = GroupUtils.init({
                name,
                source: 'local',
                domains: ['example.com']
              });

              groupWrites.push({ kind: 'create', name });
              records[created.id] = created;
              groupOrder.push(created.id);

              return Promise.resolve(created);
            },
            renameGroup: (id: string, name: string) => {
              groupWrites.push({ kind: 'rename', id, name });
              records[id] = { ...(records[id] as IOhMyGroup), name };

              return Promise.resolve(records[id] as IOhMyGroup);
            },
            deleteGroup: (id: string) => {
              groupWrites.push({ kind: 'delete', id });
              delete records[id];
              groupOrder = groupOrder.filter((g) => g !== id);

              return Promise.resolve();
            }
          }
        },
        {
          provide: StorageService,
          useValue: {
            get: (key: string) => Promise.resolve(records[key]),
            getMany: (keys: string[]) =>
              Promise.resolve(
                Object.fromEntries(
                  keys.filter(k => k in records).map(k => [k, records[k]])
                )
              )
          }
        },
        {
          provide: MatDialog,
          useValue: {
            open: (component: unknown) => {
              opened.push(component);
              return { afterClosed: () => of(undefined) };
            }
          }
        },
        {
          provide: DomainSummaryService,
          useValue: {
            summariseAll: (list: ohMyDomain[]) =>
              Promise.resolve(summaries.filter(s => list.includes(s.domain)))
          }
        }
      ],
      schemas: [NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(DomainSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('marks the domain the app is looking at', () => {
    expect(component.activeDomain).toBe('example.com');
  });

  it('opens the HAR picker, which used to be a disabled button', () => {
    const button: HTMLButtonElement = fixture.nativeElement
      .querySelector('[x-test="import-har"]');

    expect(button.disabled).toBe(false);

    button.click();

    expect(opened).toEqual([HarImportComponent]);
  });

  /**
   * The order the rows are drawn in is `IOhMyMock.groups`, which is the order
   * `GroupUtils.coveringFor` ranks by and the serving path walks. So these are
   * about which group answers, not about which row is on top.
   */
  describe('reordering', () => {
    const drop = (previousIndex: number, currentIndex: number) =>
      component.onDrop({ previousIndex, currentIndex } as CdkDragDrop<IOhMyGroupRow[]>);

    it('draws the rows in the order the store lists them', () => {
      expect(component.groups.map(r => r.group.id)).toEqual([
        localGroup.id,
        cloudGroup.id
      ]);
    });

    /**
     * The neighbour, never the index. An index is a position in the list this
     * popup happens to hold; a group created or deleted in the background
     * shifts every index after it, and the move would land somewhere nobody
     * asked for.
     */
    it('sends the group it should now follow, and puts it there', async () => {
      await drop(1, 0);

      expect(moves).toEqual([
        { id: cloudGroup.id, after: null, domain: 'example.com' }
      ]);
      expect(groupOrder).toEqual([cloudGroup.id, localGroup.id]);
      expect(component.groups.map(r => r.group.id)).toEqual([
        cloudGroup.id,
        localGroup.id
      ]);
    });

    it('names the row above it when it is dropped anywhere but the top', async () => {
      await drop(0, 1);

      expect(moves).toEqual([
        { id: localGroup.id, after: cloudGroup.id, domain: 'example.com' }
      ]);
      expect(groupOrder).toEqual([cloudGroup.id, localGroup.id]);
    });

    it('writes nothing when the row is dropped where it started', async () => {
      await drop(1, 1);

      expect(moves).toEqual([]);
    });

    /**
     * The CDK's drag is pointer-only. Without this the serving order cannot be
     * changed without a mouse — and it goes through the same one method, so
     * there is no second way of writing the order to keep in step.
     */
    it('moves the same way from the keyboard', async () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });

      await component.onReorderKey(event, 0);

      expect(event.defaultPrevented).toBe(true);
      expect(moves).toEqual([
        { id: localGroup.id, after: cloudGroup.id, domain: 'example.com' }
      ]);
    });

    it('does nothing at the ends of the list, or on any other key', async () => {
      await component.onReorderKey(
        new KeyboardEvent('keydown', { key: 'ArrowUp' }),
        0
      );
      await component.onReorderKey(
        new KeyboardEvent('keydown', { key: 'ArrowDown' }),
        component.groups.length - 1
      );
      await component.onReorderKey(new KeyboardEvent('keydown', { key: 'Enter' }), 0);

      expect(moves).toEqual([]);
    });
  });

  describe('managing the sets of mocks', () => {
    const $ = (selector: string): HTMLElement =>
      fixture.nativeElement.querySelector(`[x-test="${selector}"]`);
    const all = (selector: string): HTMLElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll(`[x-test="${selector}"]`));

    /** Types into an `ngModel` field the way a keystroke would. */
    const type = (selector: string, value: string): void => {
      const input = $(selector) as HTMLInputElement;

      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    const submit = (selector: string): void => {
      $(selector).dispatchEvent(new Event('submit'));
    };

    /**
     * Waits for the promise chain a click starts, then redraws.
     *
     * `fixture.whenStable()` alone is not enough here: the doubles resolve
     * promises the fixture never learns it is waiting for, so it reports
     * stable while the component is still four awaits away from its new rows.
     * A `setTimeout(0)` is a macrotask, and the whole chain is microtasks —
     * so by the time it runs, the queue has drained. Deterministic, not a
     * guess at how many turns to yield.
     */
    const settle = async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
    };

    /** Row order is the serving order: the store list, own group first here. */
    const rowNames = (): string[] => all('group-name').map(n => n.textContent?.trim() ?? '');

    it('draws the domain own group and the one that covers it', () => {
      expect(rowNames()).toEqual(['My mocks', "Anna's"]);
    });

    it('creates a set, which appears as a row of its own', async () => {
      $('group-new').click();
      fixture.detectChanges();

      type('group-new-input', 'Payments');
      submit('group-new-form');
      await settle();

      expect(groupWrites).toEqual([{ kind: 'create', name: 'Payments' }]);
      expect(rowNames()).toContain('Payments');
    });

    /**
     * A row nobody can tell from the next one is worse than no row, and the
     * handler refuses it anyway — so the field stays open rather than closing
     * on a change that did not happen.
     */
    it('refuses a set with no name, and keeps the field open', async () => {
      $('group-new').click();
      fixture.detectChanges();

      type('group-new-input', '   ');
      submit('group-new-form');
      await settle();

      expect(groupWrites).toEqual([]);
      expect($('group-new-form')).toBeTruthy();
    });

    it('renames a set in place', async () => {
      all('group-rename')[1].click();
      fixture.detectChanges();

      type('group-rename-input', 'Their fixtures');
      submit('group-rename-form');
      await settle();

      expect(groupWrites).toEqual([
        { kind: 'rename', id: cloudGroup.id, name: 'Their fixtures' }
      ]);
      expect(rowNames()).toContain('Their fixtures');
    });

    /**
     * The record exists so it can be renamed — its identity is the derived id,
     * not the name. Only deletion is refused.
     */
    it('renames the domain own set too', async () => {
      all('group-rename')[0].click();
      fixture.detectChanges();

      type('group-rename-input', 'Staging fixtures');
      submit('group-rename-form');
      await settle();

      expect(groupWrites).toEqual([
        { kind: 'rename', id: localGroup.id, name: 'Staging fixtures' }
      ]);
    });

    /**
     * The count is the whole point of the sentence: the mocks are deleted with
     * the set, not moved to another one. Nobody should learn that afterwards.
     */
    it('says how many mocks a delete takes with it', () => {
      all('group-delete')[1].click();
      fixture.detectChanges();

      expect($('group-delete-warning').textContent).toContain("Anna's");
      expect($('group-delete-warning').textContent).toContain('1 mock');
      expect(groupWrites).toEqual([]);
    });

    it('deletes the set once it is confirmed', async () => {
      all('group-delete')[1].click();
      fixture.detectChanges();

      $('group-delete-confirm-btn').click();
      await settle();

      expect(groupWrites).toEqual([{ kind: 'delete', id: cloudGroup.id }]);
      expect(rowNames()).not.toContain("Anna's");
    });

    it('changes nothing when the delete is cancelled', async () => {
      all('group-delete')[1].click();
      fixture.detectChanges();

      $('group-delete-cancel').click();
      await settle();

      expect(groupWrites).toEqual([]);
      expect(rowNames()).toContain("Anna's");
    });

    /**
     * The domain's own group exists by virtue of the domain, so deleting it
     * would only mean the background writing it straight back — with every
     * untagged mock belonging nowhere in between. Refused, and said out loud:
     * a hidden or greyed-out button leaves someone clicking at nothing.
     */
    it('refuses to delete the domain own set, and says why', async () => {
      all('group-delete')[0].click();
      fixture.detectChanges();

      expect($('group-delete-refusal').textContent).toContain('example.com');
      expect($('group-delete-confirm-btn')).toBeNull();

      $('group-delete-cancel').click();
      await settle();

      expect(groupWrites).toEqual([]);
      expect(rowNames()).toContain('My mocks');
    });
  });
});
