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

}
