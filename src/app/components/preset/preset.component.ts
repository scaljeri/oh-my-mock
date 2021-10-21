import { ChangeDetectionStrategy, Component, forwardRef, Input, OnChanges, OnInit } from '@angular/core';
import { FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HotToastService } from '@ngneat/hot-toast';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { IOhMyContext, IOhMyPresetChange, IOhMyPresets } from '@shared/type';
import { PresetUtils } from '@shared/utils/preset';
import { Subscription } from 'rxjs';
import { ContextService } from 'src/app/services/context.service';
import { StateStreamService } from 'src/app/services/state-stream.service';
import { PresetCreate } from 'src/app/store/actions';


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
  @Dispatch() updatePresets = (updates: IOhMyPresetChange[] | IOhMyPresetChange) => {
    return new PresetCreate(updates, this.context);
  }

  presetCtrl = new FormControl();
  options: string[] = [];
  isPresetCopy = false;
  subscriptions = new Subscription();
  presets: IOhMyPresets;
  context: IOhMyContext;

  constructor(private toast: HotToastService, private stateStream: StateStreamService) {
  }

  ngOnInit(): void {
    this.subscriptions.add(this.stateStream.state$.subscribe(state => {
      this.context = state.context;
      this.presets = state.presets;

      this.options = Object.values(this.presets)
      this.presetCtrl.setValue(this.presets[this.context.preset], { emitEvent: false });
    }));

    this.presetCtrl.valueChanges.subscribe(preset => {
      const oldPresetValue = this.presets[this.context.preset];

      if (preset !== oldPresetValue) {
        if (preset === '') {
          this.presetCtrl.setValue(oldPresetValue, { emitEvent: false });
        } else {
          const id = PresetUtils.findId(this.presets, preset);
          this.updatePresets({ id: id || this.context.preset, value: preset, activate: true });
        }
      }
    });
  }

  ngOnChanges(): void {
  }

  onPresetCopy(preset: string) {
    this.isPresetCopy = true;

    const updates = [PresetUtils.create(this.presets, preset)];
    this.presets[updates[0].id] = updates[0].value;
    this.presetCtrl.setValue(updates[0].value, { emitEvent: false });

    if (preset !== '' && preset !== undefined) {
      let presetId = Object.entries(this.presets).find(([, v]) => v === preset)?.[0];

      if (!presetId) { // Update existing preset value
        presetId = this.context.preset;

        updates.push({
          id: presetId, value: preset
        });
      }
    }

    this.updatePresets(updates);
  }

  onPresetDelete(preset: string) {
    if (preset === '' || preset === undefined) {
      return this.toast.warning('Delete failed: no preset selected');
    } else if (Object.keys(this.presets).length === 1) {
      return this.toast.warning('Delete failed: cannot delete the last preset');
    }

    const presetId = Object.entries(this.presets).find(([, v]) => v === preset)?.[0];

    if (!presetId) {
      this.presetCtrl.setValue(this.context.preset);
    } else {
      this.updatePresets({ id: presetId, delete: true })
    }
  }

  onBlur(): void {
    if (!this.context.preset) {
      const [id, value] = Object.entries(this.presets)[0];
      this.presetCtrl.setValue(value, { emitEvent: false });
      this.updatePresets({ id, value, activate: true });
    }
  }
}
