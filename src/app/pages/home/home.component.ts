import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { IData } from '@shared/type';
import { AddDataComponent } from 'src/app/components/add-data/add-data.component';
import { UpsertData } from 'src/app/store/actions';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  @Dispatch() upsertData = (data: IData) => new UpsertData(data);

  constructor(public dialog: MatDialog,) { }

  ngOnInit(): void {
  }

  onAddData(): void {
    const dialogRef = this.dialog.open(AddDataComponent, {
      width: '30%',
    });

    dialogRef.afterClosed().subscribe((data: IData) => {
      this.upsertData(data);
    })
  }
}

