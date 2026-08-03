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
              Promise.resolve({
                domains,
                groups: [localGroup.id, cloudGroup.id]
              } as IOhMyMock),
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

});
