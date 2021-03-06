import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Store } from '@ngxs/store';
import { STORAGE_KEY } from '@shared/constants';
import { IData, IState, IStore } from '@shared/type';
import { AddDataComponent } from 'src/app/components/add-data/add-data.component';
import { UpsertData } from 'src/app/store/actions';
import { OhMyState } from 'src/app/store/state';

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
      const state = this.stateSnapshot;
      const newDataIndex = state.data.length;
      this.upsertData(data);
      this.router.navigate(['mocks', newDataIndex]);
    })
  }

  get stateSnapshot(): IState {
    return this.store.selectSnapshot<IState>((state: IStore) => OhMyState.getActiveState(state));
  }
}

