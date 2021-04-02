import { Component, EventEmitter, HostBinding, Inject, Input, OnInit, Optional, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PrettyPrintPipe } from 'src/app/pipes/pretty-print.pipe';
import { skip } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { themes, IOhMyCodeEditOptions, IMarker } from './code-edit';

declare let monaco: any;
@Component({
  selector: 'oh-my-code-edit',
  templateUrl: './code-edit.component.html',
  styleUrls: ['./code-edit.component.scss']
})
export class CodeEditComponent implements OnInit {
  @Input() code: string | Record<string, string>;
  @Input() type: string;
  @Input() theme: themes = 'vs';
  @Input() allowErrors = true;
  @Output() codeChange = new EventEmitter<string>();

  @HostBinding('class.is-dialog') isDialog = false;

  public originalCode: string;
  public editorOptions = { theme: 'vs-dark', language: 'javascript' };
  public editMode = 'edit';
  public codeStr: string;
  public control = new FormControl();
  public errors: IMarker[] = [];
  public showErrors = false;

  private changeSub: Subscription;

  constructor(
    private prettyPrintPipe: PrettyPrintPipe,
    @Optional() private dialogRef: MatDialogRef<CodeEditComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public input: IOhMyCodeEditOptions
  ) {
    if (this.input) {
      this.code = input.code;
      this.type = input.type;
      this.theme = input.theme || 'vs-dark';
      this.allowErrors = input.allowErrors ?? true;
      this.isDialog = true;
    }
  }

  ngOnInit(): void {
    this.update();
  }

  public update(): void {
    this.setEditorOptions();
    this.originalCode = this.formatJSON(this.code);
    this.control.setValue(this.originalCode);

    if (!this.input) {
      if (this.changeSub) {
        this.changeSub.unsubscribe();
      }

      this.changeSub = this.control.valueChanges.pipe(skip(1)).subscribe(val => {
        if (this.allowErrors || this.errors.length === 0) {
          this.codeChange.emit(val);
        }
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

  private formatJSON(json: string | Record<string, string>): string {
    if (this.type !== 'json') {
      return json as string;
    }

    let tmp = json;

    if (typeof this.code === 'string') {
      try {
        tmp = JSON.parse(this.code);
      } catch { // If JSON is invalid, leave it as is
        return this.code;
      }
    }

    // Format JSON
    return this.prettyPrintPipe.transform(tmp);
  }

  onCancel(): void {
    this.editorOptions = { ...this.editorOptions, theme: 'vs' };
    this.dialogRef.close();
  }

  onSave(): void {
    if (this.errors.length > 0) { // we have errors
      this.showErrors = true;
    } else {
      this.done();
    }
  }

  done(): void {
    this.editorOptions = { ...this.editorOptions, theme: 'vs' };
    this.dialogRef.close(this.control.value);
  }

  onDoneErrors(state: boolean): void {
    if (state) {
      this.done();
    }

    this.showErrors = false;
  }

  onToggle(): void {
    this.editMode = this.editMode === 'diff' ? 'edit' : 'diff';
  }

  onReset(): void {
    this.control.setValue(this.originalCode);
  }

  onEditorInit(editor: any): void {
    editor.onDidChangeModelDecorations((...args) => {
      const model = editor.getModel();
      const owner = model.getModeId();

      // TODO: Do we need global monaco?
      this.errors = monaco?.editor.getModelMarkers({ owner });
      debugger;
    });
  }
}

