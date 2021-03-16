import { Component, OnInit } from '@angular/core';
import {
  ActivatedRoute,
  ActivationEnd,
  ActivationStart,
  Event as NavigationEvent,
  Router
} from '@angular/router'
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select } from '@ngxs/store';
import { domain, IOhMyMock } from '@shared/type';
import { Observable } from 'rxjs';
import { AppStateService } from 'src/app/services/app-state.service';
import { InitState } from 'src/app/store/actions';
import { OhMyState } from 'src/app/store/state';

@Component({
  selector: 'oh-my-state-explorer-page',
  templateUrl: './state-explorer.component.html',
  styleUrls: ['./state-explorer.component.scss']
})
export class PageStateExplorerComponent implements OnInit {
  @Dispatch() initState = (state: IOhMyMock) => new InitState(state);
  @Select(OhMyState.getState) state$: Observable<IOhMyMock>;

  public panelOpenState = true;
  public domains: domain[];
  public selectedDomain = '-';

  constructor(
    private appStateService: AppStateService,
    private router: Router,
    private activatedRoute: ActivatedRoute) { }

  ngOnInit(): void {
    this.state$.subscribe((state) => {
      this.domains = Object.keys(state.domains).filter(d => d !== this.appStateService.domain);
    });

    if (this.activatedRoute.firstChild) {
      this.selectedDomain = decodeURIComponent(this.activatedRoute.firstChild.snapshot.params.domain);
      this.panelOpenState = false;
    }

    this.router.events.subscribe((event: NavigationEvent) => {
      if (event instanceof ActivationEnd ) {
        const selectedDomain = this.activatedRoute.children[0]?.url['value'][0]?.path;
        // const selectedData = this.activatedRoute.children[0].url['value'][2]?.path;

        if (selectedDomain) {
          this.selectedDomain = decodeURIComponent(selectedDomain);
          this.panelOpenState = false;
        } else {
          this.panelOpenState = true;
        }
      }
    });
  }

  async onSelectDomain(domain = this.appStateService.domain): Promise<void> {
    this.selectedDomain = domain;

    setTimeout(() => {
      this.router.navigate([encodeURIComponent(domain)], {
        relativeTo: this.activatedRoute
      });
    });
  }
}
