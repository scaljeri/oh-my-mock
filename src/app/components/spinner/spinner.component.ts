import { Component, HostBinding, Input, OnInit } from '@angular/core';

export type SpinnerModes = 'light' | 'dark';

@Component({
  selector: 'oh-my-spinner',
  templateUrl: './spinner.component.html',
  styleUrls: ['./spinner.component.scss']
})
export class SpinnerComponent implements OnInit {
  @Input() set mode(mode: SpinnerModes) {
     this._mode = mode;
  }

  @HostBinding('class') get spinnerColor() {
     return this._mode;
  }

  private _mode: SpinnerModes = 'dark'

  constructor() { }

  ngOnInit(): void {
  }

}
