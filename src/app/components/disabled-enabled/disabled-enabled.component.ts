import { ChangeDetectorRef, Component, Output, EventEmitter, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { ThemePalette } from '@angular/material/core';

@Component({
  selector: 'oh-my-disabled-enabled',
  templateUrl: './disabled-enabled.component.html',
  styleUrls: ['./disabled-enabled.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisabledEnabledComponent {
  @Output() change = new EventEmitter<boolean>();
  color: ThemePalette = 'warn';

  constructor(private cdr: ChangeDetectorRef) { }

  onAction(isChecked?: boolean): void {
    this.cdr.detectChanges();
    this.change.emit(isChecked);
  }

  @HostListener('click', ['$event'])
  onClick(event) {
    if (!event.target.closest('.dialog-content')) {
      this.change.emit();
    }
  }
}
