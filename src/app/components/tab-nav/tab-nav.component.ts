import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { IState } from '@shared/types/state';
import { filter, Subscription } from 'rxjs';
import { OhMyStateService } from '../../services/state.service';

export type ohMyTab = 'requests' | 'cookies';

/**
 * The tab strip under the header — Requests and Cookies, with a count each,
 * following `design/Mock Manager v2.dc.html`.
 *
 * The two are routes rather than a local switch, so a tab survives a reload and
 * the request detail keeps its own url. Which tab is current cannot come from
 * `routerLinkActive`: the Requests tab is `/`, and matching that
 * non-exactly makes every url match while matching it exactly loses the tab as
 * soon as a request is opened at `/request/:id`.
 */
@Component({
  standalone: false,
  selector: 'oh-my-tab-nav',
  templateUrl: './tab-nav.component.html',
  styleUrls: ['./tab-nav.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TabNavComponent implements OnInit, OnDestroy {
  requestCount = 0;
  cookieCount = 0;
  active: ohMyTab | null = null;

  private subscriptions = new Subscription();

  constructor(
    private stateService: OhMyStateService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.active = TabNavComponent.activeTab(this.router.url);

    this.subscriptions.add(this.stateService.state$.subscribe((state: IState) => {
      this.requestCount = state.requests.length;
      this.cookieCount = state.cookies?.length ?? 0;
      this.cdr.detectChanges();
    }));

    this.subscriptions.add(this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        this.active = TabNavComponent.activeTab(event.urlAfterRedirects);
        this.cdr.detectChanges();
      }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Which tab a url belongs to, or `null` for the pages that are not tabs
   * (the state explorer, the JSON export, cloud sync) — the strip hides itself
   * there rather than showing neither tab as current.
   */
  static activeTab(url: string): ohMyTab | null {
    const path = url.split(/[?#]/)[0];

    if (path === '/' || path === '' || path.startsWith('/request')) {
      return 'requests';
    }

    if (path.startsWith('/cookies')) {
      return 'cookies';
    }

    return null;
  }
}
