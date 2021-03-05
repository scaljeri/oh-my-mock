import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { resetStateOptions } from '@shared/constants';
import { ResetStateOptions } from '@shared/type';
import { InitState } from 'src/app/store/actions';
import { StorageService } from '../../services/storage.service';
import { ResetStateComponent } from '../reset-state/reset-state.component';

@Component({
  selector: 'app-nav-list',
  templateUrl: './nav-list.component.html',
  styleUrls: ['./nav-list.component.scss']
})
export class NavListComponent implements OnInit {
  @Output() navigate = new EventEmitter<void>();

  @Dispatch() stateReset = () => new InitState();

  constructor(private storageService: StorageService, public dialog: MatDialog, private router: Router) { }

  ngOnInit(): void {
  }

  onReset(): void {
    const dialogRef = this.dialog.open(ResetStateComponent, {
      width: '40%',
      data: {}
    });

    dialogRef.afterClosed().subscribe((reset: undefined | ResetStateOptions) => {
      if (reset === resetStateOptions.ALL) {
        this.storageService.reset();
        this.stateReset();
      } else if (reset === resetStateOptions.SELF) {
        this.stateReset();
      }
    });

    this.navigate.emit();
  }

  onNgApiMock(): void {
    this.navigate.emit();
    this.router.navigate(['exports', 'ngapimock']);
  }
}
