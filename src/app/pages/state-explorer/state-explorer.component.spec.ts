import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { Component, EventEmitter, Input, NO_ERRORS_SCHEMA, Output } from '@angular/core';
import { HotToastService } from '@ngxpert/hot-toast';
import { objectTypes } from '@shared/constants';
import { IState } from '@shared/type';
import { Subject } from 'rxjs';
import { DataListComponent } from '../../components/data-list/data-list.component';
import { OhMyState } from '../../services/oh-my-store';
import { OhMyStateService } from '../../services/state.service';
import { StorageService } from '../../services/storage.service';
import { WebWorkerService } from '../../services/web-worker.service';
import { PageStateExplorerComponent } from './state-explorer.component';

describe('StateExplorerComponent', () => {
  let component: PageStateExplorerComponent;
  let fixture: ComponentFixture<PageStateExplorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes([]), PageStateExplorerComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: OhMyStateService, useValue: { store$: new Subject() } },
        { provide: StorageService, useValue: {} },
        { provide: OhMyState, useValue: {} },
        { provide: WebWorkerService, useValue: {} }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PageStateExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

const state = (update: Partial<IState> = {}): IState => ({
  version: '1.0.0',
  type: objectTypes.STATE,
  domain: 'mine.test',
  requests: [],
  aux: {},
  presets: { default: 'Default' },
  context: { domain: 'mine.test', preset: 'default' },
  ...update
});

/**
 * Stands in for the real list, which drags in the filter, the web worker and
 * the store. What matters here is only which state reached it, so it prints
 * the domain it was handed.
 */
@Component({
  selector: 'oh-my-data-list',
  template: '<p x-test="stub-list">{{ state?.domain }}</p>'
})
class StubDataListComponent {
  @Input() state?: IState;
  @Input() requests?: unknown;
  @Input() persistFilter?: boolean;
  @Input() showClone?: boolean;
  @Input() context?: unknown;
  @Input() togglableRows?: boolean;
  @Input() showDelete?: boolean;
  @Input() hideHeader?: boolean;
  @Output() cloned = new EventEmitter();
}

/**
 * Picking a domain is three awaits long, and the page is a list of links: the
 * second click lands long before the first has finished reading.
 *
 * No `NO_ERRORS_SCHEMA` for these — the panel and the list are what is being
 * asserted, and the schema would let both queries match nothing and pass.
 */
describe('PageStateExplorerComponent, picking a domain', () => {
  let fixture: ComponentFixture<PageStateExplorerComponent>;
  let component: PageStateExplorerComponent;
  /** Resolves the pending `storageService.get` for that domain. */
  let answer: Record<string, () => void>;

  const shownDomain = (): string | undefined =>
    fixture.nativeElement
      .querySelector('[x-test="stub-list"]')
      ?.textContent?.trim();
  const namedDomain = (): string | undefined =>
    fixture.nativeElement
      .querySelector('mat-panel-description')
      ?.textContent?.trim();
  const listPanelIsOpen = (): boolean =>
    fixture.nativeElement
      .querySelectorAll('mat-expansion-panel')[1]
      .classList.contains('mat-expanded');

  /**
   * Waits on the reads themselves rather than on a delay: `get` is only
   * reached after the worker has started, so the handle to release it does not
   * exist yet when `onSelectDomain` returns its promise.
   */
  const untilAsked = async (...domains: string[]): Promise<void> => {
    while (!domains.every((d) => answer[d])) {
      await Promise.resolve();
    }
  };

  beforeEach(async () => {
    answer = {};

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes([]), PageStateExplorerComponent],
      providers: [
        {
          provide: OhMyStateService,
          useValue: {
            store$: new Subject(),
            store: { domains: ['mine.test', 'first.test', 'second.test'] },
            state: state(),
            loadRequests: async () => ({})
          }
        },
        {
          provide: StorageService,
          useValue: {
            get: (domain: string) =>
              new Promise<IState>((resolve) => {
                answer[domain] = () => resolve(state({ domain }));
              })
          }
        },
        { provide: OhMyState, useValue: { updateAux: async () => undefined } },
        { provide: WebWorkerService, useValue: { init: async () => undefined } },
        { provide: HotToastService, useValue: { success: jest.fn() } }
      ]
    })
      .overrideComponent(PageStateExplorerComponent, {
        remove: { imports: [DataListComponent] },
        add: { imports: [StubDataListComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(PageStateExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens the panel on the domain that was picked', async () => {
    const picked = component.onSelectDomain('first.test');

    await untilAsked('first.test');
    answer['first.test']();
    await picked;

    expect(listPanelIsOpen()).toBe(true);
    expect(shownDomain()).toBe('first.test');
    expect(namedDomain()).toBe('first.test');
  });

  /**
   * The first read finishing last used to overwrite the second one's state
   * while `selectedDomain` — written before the awaits, so always the newest
   * click — kept naming the domain the user actually asked for. The page then
   * said `second.test` above a list of `first.test`'s mocks, and stayed that
   * way until something else redrew it.
   */
  it('ignores a read the user has already clicked past', async () => {
    const first = component.onSelectDomain('first.test');
    const second = component.onSelectDomain('second.test');

    await untilAsked('first.test', 'second.test');

    answer['second.test']();
    await second;

    expect(shownDomain()).toBe('second.test');

    answer['first.test']();
    await first;

    expect(shownDomain()).toBe('second.test');
    expect(namedDomain()).toBe('second.test');
  });
});
