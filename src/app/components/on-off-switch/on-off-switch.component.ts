import { EventEmitter, Input, Output } from '@angular/core';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'oh-my-on-off-switch',
  templateUrl: './on-off-switch.component.html',
  styleUrls: ['./on-off-switch.component.scss']
})
export class OnOffSwitchComponent implements OnInit {
  @Input() checked = false;
  @Input() mode = 0;

  @Output() change = new EventEmitter<boolean>();

  ngOnInit(): void {
  }

  onChange(event: Event) {
    event.stopPropagation();
    this.checked = !this.checked;
    this.change.emit(this.checked);
  }
}
