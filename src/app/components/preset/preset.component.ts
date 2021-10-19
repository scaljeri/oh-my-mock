import { ChangeDetectionStrategy, Component, forwardRef, Input, OnChanges } from '@angular/core';
import { FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IOhMyPresets } from '@shared/type';


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
export class PresetComponent implements OnChanges {
  @Input() presets: IOhMyPresets;

  presetCtrl = new FormControl();
  options: string[] = [];

  constructor() { }

  ngOnChanges(): void {
    // TODO: prepare presets list
  }

  onPresetCopy(preset: string): void {

  }

  onPresetDelete(preset: string): void {

  }

  onBlur(): void {

  }
}
