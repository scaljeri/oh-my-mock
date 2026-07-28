import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * The small pill switch of `design/Mock Manager v2.dc.html` — 32x19 with a
 * 15px knob.
 *
 * `oh-my-on-off-switch` is the big labelled ON/OFF switch in the header; this
 * is the inline one used in a table row and next to a setting. It is a
 * `<button role="switch">` rather than a checkbox so it can sit inside a
 * clickable row without a label stealing the click.
 */
@Component({
  standalone: false,
  selector: 'oh-my-toggle',
  templateUrl: './toggle.component.html',
  styleUrls: ['./toggle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToggleComponent {
  @Input() checked = false;
  @Input() disabled = false;
  /** What the switch controls, for screen readers. */
  @Input() label = '';

  @Output() toggled = new EventEmitter<boolean>();

  onClick(event: MouseEvent): void {
    // The row underneath selects a cookie; flipping the switch must not also
    // open it.
    event.stopPropagation();

    if (!this.disabled) {
      this.toggled.emit(!this.checked);
    }
  }
}
