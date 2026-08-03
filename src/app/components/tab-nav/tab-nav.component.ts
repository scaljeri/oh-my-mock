import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { IState } from '@shared/types/state';
import { filter, Subscription } from 'rxjs';
import { OhMyStateService } from '../../services/state.service';
import { activeTab, ohMyTab } from '../../utils/home-route';

export type { ohMyTab };

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
  selector: 'oh-my-tab-nav',
  templateUrl: './tab-nav.component.html',
  styleUrls: ['./tab-nav.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink]
})
export class TabNavComponent implements OnInit, OnDestroy {
  private stateService = inject(OhMyStateService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  requestCount = 0;
  cookieCount = 0;
  active: ohMyTab | null = null;

  private subscriptions = new Subscription();

  ngOnInit(): void {
    this.active = TabNavComponent.activeTab(this.router.url);

    this.subscriptions.add(
      this.stateService.state$.subscribe((state: IState) => {
        this.requestCount = state.requests.length;
        this.cookieCount = state.cookies?.length ?? 0;
        this.cdr.detectChanges();
      })
    );

    this.subscriptions.add(
      this.router.events
        .pipe(
          filter(
            (event): event is NavigationEnd => event instanceof NavigationEnd
          )
        )
        .subscribe((event) => {
          this.active = TabNavComponent.activeTab(event.urlAfterRedirects);
          this.cdr.detectChanges();
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Which tab a url belongs to, or `null` off home — the strip hides itself
   * there rather than showing neither tab as current.
   *
   * The rule itself lives in `utils/home-route`, because the sidebar hides on
   * exactly the same pages and two copies would drift.
   */
  static activeTab = activeTab;
}
