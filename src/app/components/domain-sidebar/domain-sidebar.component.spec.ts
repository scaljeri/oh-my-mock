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
  let localGroup: IOhMyGroup;
  let cloudGroup: IOhMyGroup;
  /** `IOhMyMock.groups` — the order that decides which group answers. */
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
    localGroup = GroupUtils.init({
      name: 'My mocks',
      source: 'local',
      domains: ['example.com']
    });
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
});
