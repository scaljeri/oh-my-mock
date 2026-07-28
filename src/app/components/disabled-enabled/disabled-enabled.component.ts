import { ChangeDetectorRef, Component, Output, EventEmitter, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { ThemePalette } from '@angular/material/core';

@Component({
  standalone: false,
  selector: 'oh-my-disabled-enabled',
  templateUrl: './disabled-enabled.component.html',
  styleUrls: ['./disabled-enabled.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisabledEnabledComponent {
  /**
   * The prompt was answered: mocking on this domain should follow the toggle.
   *
   * This and `dismissed` used to be a single `change` output — which, besides
   * shadowing the native DOM event of that name, emitted `undefined` on every
   * dismissal. The shell writes what it receives straight into
   * `aux.appActive`, so clicking `Continue` or the backdrop replaced the
   * domain's setting with `undefined` instead of leaving it alone.
   */
  @Output() enable = new EventEmitter<boolean>();

  /** The prompt was closed without answering it; nothing should change. */
  @Output() dismissed = new EventEmitter<void>();

  color: ThemePalette = 'warn';

  constructor(private cdr: ChangeDetectorRef) { }

  onEnable(isChecked: boolean): void {
    this.cdr.detectChanges();
    this.enable.emit(isChecked);
  }

  onDismiss(): void {
    this.cdr.detectChanges();
    this.dismissed.emit();
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    if (!(event.target as HTMLElement).closest('.dialog-content')) {
      this.dismissed.emit();
    }
  }
}
