import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { resetStateOptions } from '@shared/constants';
import { ResetStateOptions } from '@shared/type';
import { AppStateService } from 'src/app/services/app-state.service';

@Component({
  selector: 'app-reset-state',
  templateUrl: './reset-state.component.html',
  styleUrls: ['./reset-state.component.scss']
})
export class ResetStateComponent implements OnInit {
  public domain: string;
  public optionTypes = resetStateOptions;

  constructor(
    private appStateService: AppStateService,
    private dialogRef: MatDialogRef<ResetStateComponent>
  ) {}

  ngOnInit(): void {
    this.domain = this.appStateService.domain;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onReset(option: ResetStateOptions): void {
    this.dialogRef.close(option);
  }
}
