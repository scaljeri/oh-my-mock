import { Component } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-disabled-enabled',
  templateUrl: './disabled-enabled.component.html',
  styleUrls: ['./disabled-enabled.component.scss']
})
export class DisabledEnabledComponent {
  color: ThemePalette = 'warn';

  constructor(private dialogRef: MatDialogRef<DisabledEnabledComponent>) {}

  onAction(state: boolean): void {
    this.dialogRef.close(state);
  }
}
