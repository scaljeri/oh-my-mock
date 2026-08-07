import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  forwardRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import {
  UntypedFormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule
} from '@angular/forms';
import { HotToastService } from '@ngxpert/hot-toast';
import { IOhMyContext, IOhMyPresets, IState } from '@shared/type';
import { PresetUtils } from '@shared/utils/preset';
import { Subscription } from 'rxjs';
import { OhMyState } from '../../services/oh-my-store';
import { OhMyStateService } from '../../services/state.service';
import { AutocompleteDropdownComponent } from '../form/autocomplete-dropdown/autocomplete-dropdown.component';

@Component({
  selector: 'oh-my-preset',
  templateUrl: './preset.component.html',
  styleUrls: ['./preset.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PresetComponent),
      multi: true
    }
  ],
  imports: [AutocompleteDropdownComponent, ReactiveFormsModule]
})
export class PresetComponent implements OnInit, OnChanges, OnDestroy {
  private toast = inject(HotToastService);
  private stateService = inject(OhMyStateService);
  private storeService = inject(OhMyState);
  private cdr = inject(ChangeDetectorRef);

  @Input() context!: IOhMyContext;
  @Input() theme!: 'dark' | 'light';

  presetCtrl = new UntypedFormControl();
  options: string[] = [];
  isPresetCopied = false;
  subscriptions = new Subscription();
  presets!: IOhMyPresets;

  private state!: IState;
  private stateSub!: Subscription;

  @ViewChild(AutocompleteDropdownComponent)
  dropdown!: AutocompleteDropdownComponent;

  ngOnInit(): void {
    // Into the container `ngOnDestroy` empties — bare, this outlived the
    // component.
    this.subscriptions.add(this.presetCtrl.valueChanges.subscribe((preset) => {
      const oldPresetValue = this.presets[this.context.preset];

      if (preset !== oldPresetValue) {
        if (preset === '') {
          this.setSelectedValue(oldPresetValue);
        } else {
          const selected = PresetUtils.findId(this.presets, preset);

          this.storeService.upsertState(
            {
              context: {
                ...this.context,
                preset: selected || this.context.preset
              },
              ...(!selected && {
                presets: { ...this.presets, [this.context.preset]: preset }
              })
            },
            this.context
          );
        }
      }
    }));
  }

  ngOnChanges(): void {
    this.stateSub?.unsubscribe();
    this.stateSub = this.stateService
      .getState$(this.context)
      .subscribe((state) => {
        this.state = state;

        this.context = state.context;
        this.presets = state.presets;
        this.options = Object.values(this.presets);

        this.setSelectedValue(this.presets[this.context.preset]);

        // `getState$` delivers through the store, so every emission is a
        // storage callback rather than a listener bound in a template, and
        // under OnPush none of the three writes above reaches the DOM on its
        // own. `options` is the one that shows: it is an `@Input` on the
        // equally-OnPush dropdown, so a preset added or deleted elsewhere left
        // the list showing the previous set, and `[showCopy]="!!context.preset"`
        // kept the copy button in whatever state the last render saw. The
        // `ChangeDetectorRef` has been injected here since before the upgrade
        // and simply never called.
        this.cdr.markForCheck();

        if (this.isPresetCopied) {
          this.isPresetCopied = false;
          this.dropdown.focus();
        }
      });
  }

  setSelectedValue(value: string) {
    this.presetCtrl.setValue(value, { emitEvent: false });
  }

  async onPresetCopy(preset: string) {
    this.isPresetCopied = true;

    const update = PresetUtils.create(this.presets, preset);
    this.presetCtrl.setValue(update.value, { emitEvent: false });

    await this.storeService.newPreset(update.value, update.id, this.context);
  }

  /**
   * Deletes the preset that is on display.
   *
   * The work is `OhMyState.deletePreset`, not this method. It used to strip the
   * preset from the `presets` map here and write just that, which left every
   * request carrying an `enabled`/`selected` entry for a preset that no longer
   * existed — and a later preset reusing the id inherited them.
   */
  onPresetDelete(preset: string) {
    if (preset === '' || preset === undefined) {
      return this.toast.warning('Delete failed: no preset selected');
    } else if (Object.keys(this.presets).length === 1) {
      return this.toast.warning('Delete failed: cannot delete the last preset');
    }

    const removed = this.context.preset;

    delete this.presets[removed];
    this.options = Object.values(this.presets);
    this.context.preset = Object.keys(this.presets)[0];

    this.presetCtrl.setValue(this.presets[this.context.preset], {
      emitEvent: false
    });

    this.storeService.deletePreset(removed, this.context);
  }

  onBlur(): void {
    if (!this.context.preset) {
      const [, value] = Object.entries(this.presets)[0];
      this.presetCtrl.setValue(value, { emitEvent: false });
      // this.updatePresets({ id, value, activate: true });
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    // Kept out of the container because `ngOnChanges` replaces it per context.
    // It was unsubscribed on every change of context but never on destroy, so
    // the last one outlived the component.
    this.stateSub?.unsubscribe();
  }
}
