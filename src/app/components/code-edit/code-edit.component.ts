import { Component, EventEmitter, HostBinding, Inject, Input, OnInit, Optional, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PrettyPrintPipe } from 'src/app/pipes/pretty-print.pipe';
import { filter } from 'rxjs/operators';
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

  originalCode: string;
  previousCode: string;
  public editorOptions = { theme: 'vs-dark', language: 'javascript', readOnly: false };
  public diffCode;
  public codeStr: string;
  public control = new FormControl();
  public errors: IMarker[] = [];
  public showErrors = false;
  public readonly = false;
  public orig: string;

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
      this.readonly = input.readonly;
    }
  }

  ngOnInit(): void {
    this.update();

    if (this.input?.orig) {
      this.diffCode = this.originalCode;
      this.originalCode = this.format(this.input.orig) as string;
    }
  }

  public update(): void {
    // this value is used for 'reset' and given to the ngControl update directive
    this.originalCode = this.format(this.code);
    this.previousCode = this.originalCode;
    this.setEditorOptions();

    if (!this.input) {
      if (this.changeSub) {
        this.changeSub.unsubscribe();
      }

      this.changeSub = this.control.valueChanges.pipe(
        filter(val => val !== this.previousCode)).subscribe(val => {

          if (this.allowErrors || this.errors.length === 0) {
            this.previousCode = val;
            this.codeChange.emit(val);
          }
        });
    }
  }

  private setEditorOptions(): void {
    this.editorOptions = { ...this.editorOptions };

    if (this.type) {
      this.editorOptions.language = this.type;
    }

    if (this.theme) {
      this.editorOptions.theme = this.theme;
    }

    if (this.readonly) {
      this.editorOptions.readOnly = true;
    }
  }

  // If no type is set, JSON is assumed
  private format(json: string | Record<string, string>): string {
    if (this.type && this.type !== 'json') {
      return json as string;
    }

    let tmp = json;

    if (typeof this.code === 'string') {
      try {
        tmp = JSON.parse(this.code);

        // If this point is reached, it most likely is JSON
        if (!this.type) {
          this.type = 'json'; // this value is used by the editor for code highlighting
        }
      } catch { // It is not JSON or it is invalid, leave it as is
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
    if (this.diffCode) {
      this.previousCode = this.control.value;
      this.diffCode = null;
    } else {
      this.diffCode = this.control.value;
    }
  }

  onReset(): void {
    this.control.setValue(this.originalCode);
  }

  onInitEditor(editor: any): void {
    editor.onDidChangeModelDecorations((...args) => {
      const model = editor.getModel();
      const owner = model.getModeId();
      this.errors = monaco?.editor.getModelMarkers({ owner });
    });
  }

  onInitDiffEditor(diffEditor: any): void {
    if (!diffEditor) {
      return;
    }

    diffEditor.getModifiedEditor().onDidChangeModelContent(() => {
      const content = diffEditor.getModel().modified.getValue();
      this.control.setValue(content);
    });

  }
}

