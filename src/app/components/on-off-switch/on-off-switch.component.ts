import { EventEmitter, Input, Output } from '@angular/core';
import { Component } from '@angular/core';

@Component({
  selector: 'oh-my-on-off-switch',
  templateUrl: './on-off-switch.component.html',
  styleUrls: ['./on-off-switch.component.scss']
})
export class OnOffSwitchComponent {
  @Input() checked = false;
  @Input() mode = 0;

  /**
   * Named for the `checked` input above, so the switch can be used with
   * `[(checked)]`. It used to be `change`, which shadowed the native DOM event
   * of that name on the host element: a `change` bubbling out of the checkbox
   * below could never be listened for from outside, and a parent that dropped
   * the binding would silently start receiving DOM events instead.
   */
  @Output() checkedChange = new EventEmitter<boolean>();

  onChange(event: Event) {
    event.stopPropagation();
    this.checked = !this.checked;
    this.checkedChange.emit(this.checked);
  }
}
