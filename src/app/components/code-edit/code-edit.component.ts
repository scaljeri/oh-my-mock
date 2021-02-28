import { Component, Inject, Input, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { JS_INCORRECT_MSG, MOCK_CODE } from '@shared/constants';
import { evalJsCode } from '@shared/utils/eval-jscode';

@Component({
  selector: 'app-code-edit',
  templateUrl: './code-edit.component.html',
  styleUrls: ['./code-edit.component.scss']
})
export class CodeEditComponent implements OnInit {
  code: string;

  public editorOptions = { theme: 'vs-dark', language: 'javascript' };
  public editMode = 'edit';
  public originalCode: string;
  public error: string;

  constructor(private dialogRef: MatDialogRef<CodeEditComponent>,
    @Inject(MAT_DIALOG_DATA) private input: {code: string, originalCode: string}) {
      this.code = input.code || MOCK_CODE;
      this.originalCode = input.originalCode || MOCK_CODE;
    }
  ngOnInit(): void {
    // this.originalCode = this.code;
  }

  onClose(): void {
    try {
      evalJsCode(this.code);   // Check if javascript can be evaled
      this.dialogRef.close(this.code);
    } catch(err) {
      this.error = JS_INCORRECT_MSG ;
    }
  }

  onToggle(): void {
    this.editMode = this.editMode === 'diff' ? 'edit' : 'diff';
  }

  onReset(): void {
    this.code = this.originalCode;
  }
}
