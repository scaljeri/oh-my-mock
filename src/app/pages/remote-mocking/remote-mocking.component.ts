import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { HotToastService } from '@ngxpert/hot-toast';

import { IOhMyRemoteStatus, RemoteService } from '../../services/remote.service';

/**
 * Where mocks come from when they do not come from this browser.
 *
 * Two sources, one page: the local mock server (the NodeJS SDK, over a
 * websocket) and — later — a cloud service to share mocks with. They belong
 * together because they answer the same question, and because the choice
 * between them is the user's rather than a detail of either.
 *
 * The local link is **off until asked for**, and this page is where the asking
 * happens. The background used to open that socket on every service-worker
 * start, whether or not anyone ran the SDK.
 */
@Component({
  selector: 'oh-my-remote-mocking',
  templateUrl: './remote-mocking.component.html',
  styleUrls: ['./remote-mocking.component.scss'],
  imports: [ReactiveFormsModule, MatSlideToggle]
})
export class RemoteMockingComponent implements OnInit {
  private remoteService = inject(RemoteService);
  private toast = inject(HotToastService);
  private cdr = inject(ChangeDetectorRef);

  /** Undefined until the background has answered. */
  status?: IOhMyRemoteStatus;

  urlCtrl = new UntypedFormControl('', { updateOn: 'blur' });

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  /**
   * Asks the background where things stand.
   *
   * Called after every change as well as on load: connecting is not instant, so
   * what the toggle *asked for* and what actually happened are two different
   * facts, and this page shows the second one.
   */
  async refresh(): Promise<void> {
    this.status = await this.remoteService.status();
    this.urlCtrl.setValue(this.status.url, { emitEvent: false });

    // `chrome.runtime.sendMessage` answers through a callback Angular does not
    // patch, so the promise above resolves outside the zone and nothing marks
    // this view dirty. Without this the page renders with no status at all —
    // which is exactly how it looked the first time.
    this.cdr.detectChanges();
  }

  async onToggle(enabled: boolean): Promise<void> {
    await this.remoteService.update({ enabled, url: this.urlCtrl.value });

    if (enabled) {
      this.toast.success('Connecting to the local mock server', { duration: 2000 });
    }

    await this.refresh();
  }

  async onUrlChange(): Promise<void> {
    await this.remoteService.update({ url: this.urlCtrl.value });
    await this.refresh();
  }
}
