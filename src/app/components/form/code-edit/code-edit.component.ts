import { Component, EventEmitter, forwardRef, Input, OnInit, Output } from '@angular/core';
import { ControlValueAccessor, UntypedFormControl, NG_VALIDATORS, NG_VALUE_ACCESSOR } from '@angular/forms';
import { PrettyPrintPipe } from '../../../pipes/pretty-print.pipe';
import { themes, IMarker } from './code-edit';
import { filter } from 'rxjs/operators';

declare let window: any;
declare let monaco: any;

@Component({
  standalone: false,
  selector: 'oh-my-code-edit',
  templateUrl: './code-edit.component.html',
  styleUrls: ['./code-edit.component.scss'],
  // changeDetection: ChangeDetectionStrategy.OnPush,
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
  @Input() type: string | undefined;
  @Input() theme: themes = 'vs';
  @Input() base: string | undefined;
  @Input() showMinimap = false;

  @Output() errors = new EventEmitter<IMarker[]>();

  originalCode!: string;
  previousCode!: string;
  updatedCode!: string;

  // vs, vs-dark
  public editorOptions = {} as any;

  // ngx-monaco-editor-v2 takes `{ code, language }` models for the diff view,
  // where the previous wrapper took two plain strings.
  public originalModel: { code: string; language: string } = { code: '', language: 'json' };
  public modifiedModel: { code: string; language: string } = { code: '', language: 'json' };

  public diffCode: string | undefined;

  public readonly = false;
  public orig!: string;

  value!: string;
  editorCtrl = new UntypedFormControl('', { updateOn: 'blur' });
  onChange: any = () => { }
  onTouch: any = () => { }

  constructor(private prettyPrintPipe: PrettyPrintPipe) { }

  async ngOnInit() {
    if (this.base) {
      this.base = this.format(this.base);
    }

    // Before awaiting Monaco, not after: `ngx-monaco-editor` creates the editor
    // with whatever `options` holds at that moment, and an empty object means
    // Monaco's own defaults — which include the minimap. The detail pane is
    // 436px wide in the design; a minimap eats a fifth of that.
    this.setEditorOptions();

    await this.checkMonacoLoaded();
    this.setEditorOptions();

    this.editorCtrl.valueChanges.pipe(filter(v => v !== this.value)).subscribe(value => {
      this.value = value;
      this.onChange(value);
      this.onTouch(value);
    });

    this.updatedCode = this.editorCtrl.value;
    this.syncDiffModels();
  }

  ngOnChanges(): void {
    if (this.base) {
      if (typeof this.base === 'object') {
        this.base = this.format(this.base);
      }

      this.updatedCode = this.editorCtrl.value;
      this.syncDiffModels();
    }
  }

  /** Keeps the diff editor's two models in step with `base` and the control. */
  private syncDiffModels(): void {
    const language = this.editorOptions?.language ?? this.type ?? 'json';

    this.originalModel = { code: this.base ?? '', language };
    this.modifiedModel = { code: this.updatedCode ?? '', language };
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
    this.editorOptions = {
      minimap: { enabled: this.showMinimap },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      // Matches `$oh-font-mono`, `$oh-size-code` and `$oh-editor-line-height`
      // in `_tokens.scss`, so the editor reads as part of the same page as the
      // rest of the detail pane rather than as an embedded IDE.
      fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace",
      fontSize: 12,
      lineHeight: 21,
      lineNumbersMinChars: 3,
      theme: 'vs', language: 'json', readOnly: false
    };

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
    editor.onDidChangeModelDecorations(() => {
      const model = editor?.getModel?.();
      const owner = model.getModeId?.(); // TODO: THIs code doesn't seem to work anymore

      this.errors.emit(monaco?.editor.getModelMarkers({ owner }));
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
    this.editorCtrl.setValue(this.value, { emitEvent: false });
  }

  registerOnChange(fn: any) {
    this.onChange = fn
  }

  registerOnTouched(fn: any) {
    this.onTouch = fn
  }


  validate(_control: UntypedFormControl): null {
    return null;
  }
}

