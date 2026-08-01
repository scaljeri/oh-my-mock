import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { HotToastService } from '@ngxpert/hot-toast';
import { ohMyRemoteTarget } from '@shared/types/store';

import { IOhMyRemoteStatus, RemoteService } from '../../services/remote.service';

/** The two places mocks can come from when they do not come from this browser. */
const TARGETS: { value: ohMyRemoteTarget; name: string; ready: boolean }[] = [
  { value: 'server', name: 'Server', ready: true },
  { value: 'cloud', name: 'Cloud', ready: false }
];

/**
 * Where mocks come from when they do not come from this browser.
 *
 * A server you run — `localhost` while you are working, or the IP of a machine
 * running the SDK for a whole team — or the cloud service, which does not exist
 * yet and says so.
 *
 * The link is **off until asked for**, and this page is where the asking
 * happens. The background used to open a socket to a hard-coded address on every
 * service-worker start, whether or not anyone ran a server at all.
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

  targets = TARGETS;

  /** Undefined until the background has answered. */
  status?: IOhMyRemoteStatus;

  // Committed on blur rather than per keystroke: a half-typed host or port is
  // not an address worth reconnecting to.
  hostCtrl = new UntypedFormControl('', { updateOn: 'blur' });
  portCtrl = new UntypedFormControl(null, { updateOn: 'blur' });

  /**
   * The address fields are filled from the stored value once, and never again.
   *
   * `refresh()` runs after every change, and it used to write both controls back
   * from the store each time. Editing the host and then the port meant the
   * host's blur refreshed the form and put the *old* port back underneath the
   * one being typed — so the new port was silently discarded on its way out of
   * the field. While this page is open the inputs are what the user is holding;
   * the status beside them is only there to be read.
   */
  private seeded = false;

  /** Guards against two settle-watchers running after quick successive changes. */
  private settling = false;

  async ngOnInit(): Promise<void> {
    await this.refresh();
    await this.watchUntilSettled();
  }

  /**
   * Asks the background where things stand.
   *
   * Called after every change as well as on load: connecting is not instant, so
   * what was *asked for* and what actually happened are two different facts, and
   * this page shows the second one.
   */
  async refresh(): Promise<void> {
    this.status = await this.remoteService.status();

    if (!this.seeded) {
      this.seeded = true;
      this.hostCtrl.setValue(this.status.host, { emitEvent: false });
      this.portCtrl.setValue(this.status.port, { emitEvent: false });
    }

    // `chrome.runtime.sendMessage` answers through a callback Angular does not
    // patch, so the promise above resolves outside the zone and nothing marks
    // this view dirty.
    this.cdr.detectChanges();
  }

  /**
   * Re-checks until the answer stops changing, or until it is clear it will not.
   *
   * Connecting is not instant: the toggle writes the setting, the background
   * picks that up from storage and opens a socket, and only then is there
   * anything to report. Asking once — which is all this page used to do — meant
   * a server that *was* reachable was announced as "Not reachable" and stayed
   * that way, because nothing looked again.
   *
   * Bounded, and stops early. There is no push channel for this, and a page that
   * polls a socket forever is its own kind of bug.
   */
  private async watchUntilSettled(): Promise<void> {
    if (this.settling) {
      return;
    }

    this.settling = true;

    try {
      const deadline = Date.now() + 12_000;

      while (this.status?.enabled && !this.status.connected) {
        if (Date.now() > deadline) {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
        await this.refresh();
      }
    } finally {
      this.settling = false;
    }
  }

  async onTarget(target: ohMyRemoteTarget): Promise<void> {
    await this.remoteService.update({ target });
    await this.refresh();
  }

  async onToggle(enabled: boolean): Promise<void> {
    await this.remoteService.update({
      enabled,
      host: this.hostCtrl.value,
      port: Number(this.portCtrl.value)
    });

    if (enabled) {
      this.toast.success(`Connecting to ${this.status?.url ?? 'the server'}`, {
        duration: 2000
      });
    }

    await this.refresh();
    await this.watchUntilSettled();
  }

  async onAddressChange(): Promise<void> {
    const port = Number(this.portCtrl.value);

    // A port outside the range is not an address, and socket.io would take it
    // and retry against it regardless.
    if (!this.hostCtrl.value || !Number.isInteger(port) || port < 1 || port > 65535) {
      this.toast.warning('Enter a host and a port between 1 and 65535');
      await this.refresh();

      return;
    }

    await this.remoteService.update({ host: this.hostCtrl.value, port });
    await this.refresh();
    await this.watchUntilSettled();
  }
}
