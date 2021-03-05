import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Store } from '@ngxs/store';
import { STORAGE_KEY } from '@shared/constants';
import { IData, IState, IStore } from '@shared/type';
import { AddDataComponent } from 'src/app/components/add-data/add-data.component';
import { UpsertData } from 'src/app/store/actions';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  @Dispatch() upsertData = (data: IData) => new UpsertData(data);

  constructor(public dialog: MatDialog, private store: Store, private router: Router) { }

  ngOnInit(): void {
  }

  onAddData(): void {
    const dialogRef = this.dialog.open(AddDataComponent, {
      width: '30%',
    });

    dialogRef.afterClosed().subscribe((data: IData) => {
      const newDataIndex = this.store.selectSnapshot<number>((state: IStore) => state[STORAGE_KEY].data.length);
      this.upsertData(data);
      this.router.navigate(['mocks', newDataIndex]);
    })
  }
}

