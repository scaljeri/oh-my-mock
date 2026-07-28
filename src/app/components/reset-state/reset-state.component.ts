import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { resetStateOptions } from '@shared/constants';
import { ResetStateOptions } from '@shared/types/store';
import { AppStateService } from '../../services/app-state.service';

@Component({
  standalone: false,
  selector: 'oh-my-reset-state',
  templateUrl: './reset-state.component.html',
  styleUrls: ['./reset-state.component.scss']
})
export class ResetStateComponent {
  appStateService = inject(AppStateService);
  private dialogRef = inject<MatDialogRef<ResetStateComponent>>(MatDialogRef);

  public optionTypes = resetStateOptions;

  onCancel(): void {
    this.dialogRef.close();
  }

  onReset(option: ResetStateOptions): void {
    this.dialogRef.close(option);
  }
}
