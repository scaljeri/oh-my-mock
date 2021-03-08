import { Component, Input, OnInit } from '@angular/core';
import { IData } from '@shared/type';

@Component({
  selector: 'app-header-overview',
  templateUrl: './header-overview.component.html',
  styleUrls: ['./header-overview.component.scss']
})
export class HeaderOverviewComponent implements OnInit {
  @Input() data: IData;

  constructor() { }

  ngOnInit(): void {
  }

  get headers(): [string, string][] {
    const headers = this.data ? this.data.mocks[this.data.activeStatusCode].headers : [];

    return Object.entries(headers || []);
  }
}
