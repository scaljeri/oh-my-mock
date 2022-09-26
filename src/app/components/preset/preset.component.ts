import { ChangeDetectionStrategy, ChangeDetectorRef, Component, forwardRef, Input, OnChanges, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HotToastService } from '@ngneat/hot-toast';
import { IOhMyContext, IOhMyDomain, IOhMyDomainPresets } from '@shared/type';
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
  ]
})
export class PresetComponent implements OnInit, OnChanges {
  @Input() context: IOhMyContext;
  @Input() theme: 'dark' | 'light';

  presetCtrl = new UntypedFormControl();
  options: string[] = [];
  isPresetCopied = false;
  subscriptions = new Subscription();
  presets: IOhMyDomainPresets;

  private state: IOhMyDomain;
  private stateSub: Subscription;

  @ViewChild(AutocompleteDropdownComponent) dropdown: AutocompleteDropdownComponent;

  constructor(private toast: HotToastService,
    private stateService: OhMyStateService,
    private storeService: OhMyState,
    private cdr: ChangeDetectorRef) {
  }

  ngOnInit(): void {
    this.presetCtrl.valueChanges.subscribe(preset => {
      const oldPresetValue = this.presets[this.context.presetId];

      if (preset !== oldPresetValue) {
        if (preset === '') {
          this.setSelectedValue(oldPresetValue);
        } else {
          const selected = PresetUtils.findId(this.presets, preset);

          this.storeService.upsertState({
            context: { ...this.context, presetId: selected || this.context.presetId },
            ...(!selected && { presets: { ...this.presets, [this.context.presetId]: preset } })
          }, this.context);
        }
      }
    });
  }

  ngOnChanges(): void {
    this.stateSub?.unsubscribe();
    this.stateSub = this.stateService.getState$(this.context).subscribe(state => {
      this.state = state;

      this.context = state.context;
      this.presets = state.presets;
      this.options = Object.values(this.presets).map(preset => preset.label);

      this.setSelectedValue(this.presets[this.context.presetId]);

      if (this.isPresetCopied) {
        this.isPresetCopied = false;
        this.dropdown.focus();
      }
    });
  }

  setSelectedValue(value) {
    this.presetCtrl.setValue(value, { emitEvent: false });
  }

  async onPresetCopy(preset: string) {
    this.isPresetCopied = true;

    const update = PresetUtils.create(this.presets, preset);
    this.presetCtrl.setValue(update.label, { emitEvent: false });

    await this.storeService.newPreset(update.label, update.id, this.context);
  }

  onPresetDelete(preset: string) {
    if (preset === '' || preset === undefined) {
      return this.toast.warning('Delete failed: no preset selected');
    } else if (Object.keys(this.presets).length === 1) {
      return this.toast.warning('Delete failed: cannot delete the last preset');
    }

    delete this.presets[this.context.presetId];
    this.options = Object.values(this.presets).map(preset => preset.label);
    this.context.presetId = Object.keys(this.presets)[0];

    this.presetCtrl.setValue(this.presets[this.context.presetId], { emitEvent: false });
    this.storeService.upsertState({ context: this.context, presets: this.presets }, this.context);
  }

  onBlur(): void {
    if (!this.context.presetId) {
      const [id, value] = Object.entries(this.presets)[0];
      this.presetCtrl.setValue(value, { emitEvent: false });
      // this.updatePresets({ id, value, activate: true });
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
