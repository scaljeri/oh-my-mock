import { Component, Input, OnInit } from '@angular/core';
import { IData, IMock } from '@shared/type';

@Component({
  selector: 'app-header-overview',
  templateUrl: './header-overview.component.html',
  styleUrls: ['./header-overview.component.scss']
})
export class HeaderOverviewComponent implements OnInit {
  @Input() data: IData;

  public mock: IMock;

  constructor() { }

  ngOnInit(): void {
    this.mock = this.data?.mocks[this.data.activeStatusCode];
  }

  get headers(): [string, string][] {
    const headers = this.data ? this.data.mocks[this.data.activeStatusCode].headers : [];

    return Object.entries(headers || []);
  }

  onHeadersMockToggle(toggle): void {

  }
}
