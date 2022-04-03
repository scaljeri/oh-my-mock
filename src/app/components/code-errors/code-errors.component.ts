import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IMarker } from '../form/code-edit/code-edit';

@Component({
  selector: 'oh-my-code-errors',
  templateUrl: './code-errors.component.html',
  styleUrls: ['./code-errors.component.scss']
})
export class CodeErrorsComponent {
  @Input() errors: IMarker[];
  @Input() allowErrors: boolean;
  @Output() done = new EventEmitter<boolean>();

  displayedColumns = ['startLineNumber', 'severity', 'message'];

  onClose(): void {
    this.done.emit(true);
  }

  onCancel(): void {
    this.done.emit(false);
  }
}
