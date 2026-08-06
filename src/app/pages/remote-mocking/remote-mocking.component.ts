import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { HotToastService } from '@ngxpert/hot-toast';
import { ohMyRemoteTarget } from '@shared/types/store';

import { IOhMyRemoteStatus, RemoteService } from '../../services/remote.service';

/** The storages mocks can be read from. */
const TARGETS: {
  value: ohMyRemoteTarget;
  name: string;
  note: string;
  ready: boolean;
}[] = [
  {
    value: 'extension',
    name: 'This browser',
    note: 'The mocks stored in this extension — what the Requests tab edits.',
    ready: true
  },
  {
    value: 'server',
    name: 'Server',
    note: 'A machine running the NodeJS SDK, which serves mocks straight from disk so a whole team can keep them in the repository.',
    ready: true
  },
  {
    value: 'cloud',
    name: 'Cloud',
    note: 'Mocks shared through our cloud service.',
    ready: false
  }
];

/**
 * Which storage the mocks are read from.
 *
 * One of them, not one on top of another. Picking a source means working from
 * that source: with a server selected this browser's own mocks are not consulted
 * at all, and a request the server has no answer for goes to the real server.
 *
 * The default is this browser, and then nothing outside it is contacted — no
 * socket, no retries. The background used to dial a hard-coded address on every
 * service-worker start whether or not anyone ran a server.
 */
@Component({
  selector: 'oh-my-remote-mocking',
  templateUrl: './remote-mocking.component.html',
  styleUrls: ['./remote-mocking.component.scss'],
  imports: [ReactiveFormsModule]
})
export class RemoteMockingComponent implements OnInit, OnDestroy {
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

  /**
   * Set on destroy. The settle-watcher lives between awaits, not in a
   * subscription, so leaving the page does not end it by itself — it kept
   * polling the background and calling `detectChanges()` on a destroyed view
   * for up to its full deadline.
   */
  private destroyed = false;

  async ngOnInit(): Promise<void> {
    await this.refresh();
    await this.watchUntilSettled();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  /**
   * Asks the background where things stand.
   *
   * Called after every change as well as on load: connecting is not instant, so
   * what was *asked for* and what actually happened are two different facts, and
   * this page shows the second one.
   */
  async refresh(): Promise<void> {
    const status = await this.remoteService.status();

    // The answer can come back after the page has been left; a destroyed view
    // must not be marked dirty.
    if (this.destroyed) {
      return;
    }

    this.status = status;

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

      while (
        !this.destroyed &&
        this.status?.target === 'server' &&
        !this.status.connected
      ) {
        if (Date.now() > deadline) {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));

        // Checked again on the far side of the sleep — leaving the page is
        // most likely to happen during one, and the next ask should not go
        // out at all.
        if (this.destroyed) {
          return;
        }

        await this.refresh();
      }
    } finally {
      this.settling = false;
    }
  }

  async onTarget(target: ohMyRemoteTarget): Promise<void> {
    await this.remoteService.update({
      target,
      host: this.hostCtrl.value,
      port: Number(this.portCtrl.value)
    });

    if (target === 'server') {
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
