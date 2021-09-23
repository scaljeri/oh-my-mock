import { AfterViewInit, ChangeDetectionStrategy, Component, EventEmitter, forwardRef, HostBinding, Inject, Input, OnChanges, OnInit, Optional, Output } from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALIDATORS, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PrettyPrintPipe } from 'src/app/pipes/pretty-print.pipe';
import { Subscription } from 'rxjs';
import { themes, IOhMyCodeEditOptions, IMarker } from './code-edit';
import { filter } from 'rxjs/operators';

declare let monaco: any;

@Component({
  selector: 'oh-my-code-edit',
  templateUrl: './code-edit.component.html',
  styleUrls: ['./code-edit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CodeEditComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: CodeEditComponent,
      multi: true
    }
  ]
})
export class CodeEditComponent implements OnInit, ControlValueAccessor {
  @Input() type: string;
  @Input() theme: themes = 'vs';
  @Input() base: string;

  originalCode: string;
  previousCode: string;

  // vs, vs-dark
  public editorOptions = { theme: 'vs', language: 'json', readOnly: false };

  public diffCode;
  public errors: IMarker[] = [];

  public readonly = false;
  public orig: string;

  value: string;
  editorCtrl = new FormControl('', { updateOn: 'blur'});
  onChange: any = () => { }
  onTouch: any = () => { }

  constructor(private prettyPrintPipe: PrettyPrintPipe) { }

  async ngOnInit() {
    if (this.base) {
      this.base = this.format(this.base);
    }

    await this.checkMonacoLoaded();

    this.editorCtrl.valueChanges.pipe(filter(v => v !== this.value)).subscribe(value => {
      this.value = value;
      this.onChange(value);
      this.onTouch(value);
    });

    // this.editorCtrl.setValue(this.format(this.formCtrl.value), { emitEvent: false });

    this.setEditorOptions()
  }

  // Wait for monaco to load
  checkMonacoLoaded(): Promise<void> {
    return new Promise(r => {
      const id = window.setInterval(() => {
        if (window.monaco) {
          window.clearInterval(id);
          r();
        }
      }, 100);
    });
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
  private format(code: string | Record<string, string>, type = this.type): string {
    if (type && type !== 'json') {
      return code as string;
    }

    if (typeof code === 'string') {
      try {
        code = JSON.parse(code);
      } catch { // It is not JSON or it is invalid, leave it as is
        return code as string;
      }
    }

    // Format JSON
    return this.prettyPrintPipe.transform(code);
  }

  onInitEditor(editor: any): void {
    editor.onDidChangeModelDecorations((...args) => {
      const model = editor.getModel();
      const owner = model.getModeId();
      this.errors = monaco?.editor.getModelMarkers({ owner });
    });
  }

  onInitDiffEditor(diffEditor: any): void {
    if (!this.base) {
      return;
    }

    diffEditor.getModifiedEditor().onDidChangeModelContent(() => {
      const content = diffEditor.getModel().modified.getValue();
      this.editorCtrl.setValue(content);
    });
  }

   // new values
   writeValue(value: string) {
    this.value = this.format(value);
    this.editorCtrl.setValue(this.value);
  }

  registerOnChange(fn: any) {
    this.onChange = fn
  }

  registerOnTouched(fn: any) {
    this.onTouch = fn
  }

  onFocus(e, t): void {
  }

  validate({ value }: FormControl) {
    return null;
  }
}

