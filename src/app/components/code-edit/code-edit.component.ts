import { Component, EventEmitter, HostBinding, Inject, Input, OnChanges, OnInit, Optional, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { JS_INCORRECT_MSG, MOCK_JS_CODE } from '@shared/constants';
import { evalJsCode } from '@shared/utils/eval-jscode';
import { PrettyPrintPipe } from 'src/app/pipes/pretty-print.pipe';
import { skip } from 'rxjs/operators';
import { Subscription } from 'rxjs';

type themes = 'vs' | 'vs-dark' | 'hc-black';
@Component({
  selector: 'app-code-edit',
  templateUrl: './code-edit.component.html',
  styleUrls: ['./code-edit.component.scss']
})
export class CodeEditComponent implements OnInit {
  @Input() code: string | Record<string, string>;
  @Input() type: string;
  @Input() theme: themes = 'vs';
  @Output() codeChange = new EventEmitter<string>();

  @HostBinding('class.is-dialog') isDialog = false;

  public originalCode: string;
  public editorOptions = { theme: 'vs-dark', language: 'javascript' };
  public editMode = 'edit';
  public error: string;
  public codeStr: string;
  public control = new FormControl();

  private changeSub: Subscription;

  constructor(
    private prettyPrintPipe: PrettyPrintPipe,
    @Optional() private dialogRef: MatDialogRef<CodeEditComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public input: { code: string, type: string, theme: themes }
  ) {
    if (this.input) {
      this.code = input.code;
      this.type = input.type;
      this.theme = input.theme || 'vs-dark';
      this.isDialog = true;
    }
  }

  ngOnInit(): void {
    this.update();
  }

  public update(): void {
    this.setEditorOptions();

    let tmpCode = this.code;

    if (this.type === 'json' && typeof this.code === 'string') {
      tmpCode = JSON.parse(this.code);
    }

    this.originalCode = this.prettyPrintPipe.transform(tmpCode);
    this.control.setValue(this.originalCode);

    if (!this.input) {
      if (this.changeSub) {
        this.changeSub.unsubscribe();
      }

      this.changeSub = this.control.valueChanges.pipe(skip(1)).subscribe(val => {
        if (this.type === 'json') {
          try {
            // TODO: validate JSON
            this.codeChange.emit(val);
          } catch {
            console.log('json parse error');
          }
        }
        this.codeChange.emit(val);
      });
    }
  }

  private setEditorOptions(): void {
    if (this.type) {
      this.editorOptions.language = this.type;
    }

    if (this.theme) {
      this.editorOptions.theme = this.theme;
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    // TODO: validate json
    // try {
    //   evalJsCode(this.code); // Check if javascript can be evaled
    this.dialogRef.close(this.control.value);
    // } catch (err) {
    //   this.error = JS_INCORRECT_MSG;
    // }
  }

  onToggle(): void {
    this.editMode = this.editMode === 'diff' ? 'edit' : 'diff';
  }

  onReset(): void {
    this.control.setValue(this.originalCode);
  }
}

