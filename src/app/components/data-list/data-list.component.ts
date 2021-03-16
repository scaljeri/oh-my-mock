import { Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';
import { IData, IDeleteData } from 'src/shared/type';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { DeleteData } from 'src/app/store/actions';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'oh-my-data-list',
  templateUrl: './data-list.component.html',
  styleUrls: ['./data-list.component.scss']
})
export class DataListComponent {
  @Input() data: IData[] = [];
  @Input() @HostBinding('class') lightTheme = 'dark';
  @Output() select = new EventEmitter<number>();

  @Dispatch() deleteData = (data: IDeleteData) => new DeleteData(data);

  displayedColumns = ['type', 'method', 'url', 'activeStatusCode'];
  edit = false;

  constructor(private activatedRoute: ActivatedRoute) {}

  ngOnInit(): void {
    this.lightTheme = this.activatedRoute.snapshot.data.theme;
  }

  onEdit(): void {
    this.edit = !this.edit;

    if (this.edit) {
      this.displayedColumns.unshift('edit');
    } else {
      this.displayedColumns.shift();
    }
    console.log(this.edit, this.displayedColumns);
  }

  onDeleteData(row: IDeleteData): void {
    this.deleteData(row);
  }

  onDataClick(index: number): void {
    this.select.emit(index);
  }
}
