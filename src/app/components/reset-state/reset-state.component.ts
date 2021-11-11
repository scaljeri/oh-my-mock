import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { resetStateOptions } from '@shared/constants';
import { ResetStateOptions } from '@shared/type';
import { AppStateService } from 'src/app/services/app-state.service';

@Component({
  selector: 'app-reset-state',
  templateUrl: './reset-state.component.html',
  styleUrls: ['./reset-state.component.scss']
})
export class ResetStateComponent {
  public optionTypes = resetStateOptions;

  constructor(
    public appStateService: AppStateService,
    private dialogRef: MatDialogRef<ResetStateComponent>
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onReset(option: ResetStateOptions): void {
    this.dialogRef.close(option);
  }
}
