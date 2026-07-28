import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IMarker } from '../form/code-edit/code-edit';
import { MatError } from '@angular/material/form-field';
import {
  MatTable,
  MatColumnDef,
  MatHeaderCellDef,
  MatHeaderCell,
  MatCellDef,
  MatCell,
  MatHeaderRowDef,
  MatHeaderRow,
  MatRowDef,
  MatRow
} from '@angular/material/table';
import { MatButton } from '@angular/material/button';

@Component({
  selector: 'oh-my-code-errors',
  templateUrl: './code-errors.component.html',
  styleUrls: ['./code-errors.component.scss'],
  imports: [
    MatError,
    MatTable,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    MatButton
  ]
})
export class CodeErrorsComponent {
  @Input() errors!: IMarker[];
  @Input() allowErrors!: boolean;
  @Output() done = new EventEmitter<boolean>();

  displayedColumns = ['startLineNumber', 'severity', 'message'];

  onClose(): void {
    this.done.emit(true);
  }

  onCancel(): void {
    this.done.emit(false);
  }
}
