import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  inject
} from '@angular/core';
import {
  ControlValueAccessor,
  UntypedFormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule
} from '@angular/forms';
import { PrettyPrintPipe } from '../../../pipes/pretty-print.pipe';
import { themes, IMarker } from './code-edit';
import { filter } from 'rxjs/operators';
import type * as Monaco from 'monaco-editor';
import { EditorComponent, DiffEditorComponent } from 'ngx-monaco-editor-v2';

declare global {
  interface Window {
    /**
     * Monaco's own namespace. Published on `window` by its loader once
     * `editor.main.js` has evaluated, which is what `checkMonacoLoaded` below
     * waits for — see `monaco-environment.ts`.
     */
    monaco?: typeof Monaco;
  }
}

@Component({
  selector: 'oh-my-code-edit',
  templateUrl: './code-edit.component.html',
  styleUrls: ['./code-edit.component.scss'],
  // Stated rather than inherited, and no longer commented out: Angular 22 made
  // OnPush the default, so commenting this line stopped opting the component
  // out of it — the editor has been OnPush since the upgrade regardless of what
  // this line said. Writing it down is what makes the `markForCheck` calls
  // below read as deliberate instead of superstitious.
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
    },
    // `inject(PrettyPrintPipe)` below needs the pipe as a *provider*, which it
    // used to get from `PipesModule` by way of `ComponentsModule`, both of
    // which are gone. Standalone components carry their own dependencies, and
    // importing a pipe class only makes it usable in the template — not
    // injectable. Without this the editor throws NG0201 at runtime while the
    // build stays perfectly clean.
    PrettyPrintPipe
  ],
  imports: [EditorComponent, ReactiveFormsModule, DiffEditorComponent]
})
export class CodeEditComponent
  implements OnInit, OnChanges, OnDestroy, ControlValueAccessor
{
  private prettyPrintPipe = inject(PrettyPrintPipe);
  private cdr = inject(ChangeDetectorRef);

  @Input() type: string | undefined;
  @Input() theme: themes = 'vs';
  @Input() base: string | undefined;
  @Input() showMinimap = false;

  @Output() errors = new EventEmitter<IMarker[]>();

  originalCode!: string;
  previousCode!: string;
  updatedCode!: string;

  // vs, vs-dark
  public editorOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {};

  // ngx-monaco-editor-v2 takes `{ code, language }` models for the diff view,
  // where the previous wrapper took two plain strings.
  public originalModel: { code: string; language: string } = {
    code: '',
    language: 'json'
  };
  public modifiedModel: { code: string; language: string } = {
    code: '',
    language: 'json'
  };

  public diffCode: string | undefined;

  public readonly = false;
  public orig!: string;

  value!: string;
  editorCtrl = new UntypedFormControl('', { updateOn: 'blur' });
  private onChange: (value: string) => void = () => {};
  private onTouch: () => void = () => {};

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

    this.editorCtrl.valueChanges
      .pipe(filter((v) => v !== this.value))
      .subscribe((value: string) => {
        this.value = value;
        this.onChange(value);
        // `registerOnTouched` hands over a zero-argument callback; the value it
        // used to be called with was thrown away.
        this.onTouch();
      });

    this.updatedCode = this.editorCtrl.value;
    this.syncDiffModels();
    // Everything from `await this.checkMonacoLoaded()` onwards runs as a
    // continuation of a promise resolved by the `setInterval` poll below, so
    // this whole tail is outside any listener and marks nothing under OnPush.
    // Three template-bound fields were rewritten since then — `editorOptions`,
    // read by both `[options]` bindings, and the two diff models — and each was
    // replaced with a fresh object, so the bindings had genuinely new values to
    // pick up and no pass in which to do it. The visible result was the editor
    // keeping Monaco's defaults, minimap and all, in a 436px pane, and the diff
    // view rendering against empty models.
    this.cdr.markForCheck();
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

  /**
   * The poll's timer, so `ngOnDestroy` can end it. Waiting is fine; a timer
   * that outlives the component is not.
   */
  private monacoPollId?: number;

  /**
   * Waits for monaco to load — but not forever. If the loader has failed,
   * monaco is not going to appear, and the poll used to keep firing every
   * 100ms for the life of the popup, from every editor ever created. Past the
   * deadline it gives up and resolves; the editor is broken either way, and
   * the rest of the component (the form control, the diff models) still works.
   */
  checkMonacoLoaded(): Promise<void> {
    return new Promise((resolve) => {
      const deadline = Date.now() + 20_000;

      this.monacoPollId = window.setInterval(() => {
        if (window.monaco || Date.now() > deadline) {
          window.clearInterval(this.monacoPollId);
          resolve();
        }
      }, 100);
    });
  }

  ngOnDestroy(): void {
    // Destroyed while still waiting: end the poll. The promise then never
    // settles, which is the intent — nothing after the await should run for a
    // component that is gone.
    window.clearInterval(this.monacoPollId);
  }

  private setEditorOptions(): void {
    this.editorOptions = {
      minimap: { enabled: this.showMinimap },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      // Matches `$oh-font-mono`, `$oh-size-code` and `$oh-editor-line-height`
      // in `_tokens.scss`, so the editor reads as part of the same page as the
      // rest of the detail pane rather than as an embedded IDE.
      fontFamily:
        "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace",
      fontSize: 12,
      lineHeight: 21,
      lineNumbersMinChars: 3,
      theme: 'vs',
      language: 'json',
      readOnly: false
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
  private format(
    code: string | Record<string, string>,
    type = this.type
  ): string {
    if (type && type !== 'json') {
      return code as string;
    }

    if (typeof code === 'string') {
      try {
        code = JSON.parse(code);
      } catch {
        // It is not JSON or it is invalid, leave it as is
        return code as string;
      }
    }

    // Format JSON
    return this.prettyPrintPipe.transform(code);
  }

  onInitEditor(editor: Monaco.editor.IStandaloneCodeEditor): void {
    editor.onDidChangeModelDecorations(() => {
      const model = editor.getModel();

      if (!model) {
        return;
      }

      // Filtered by the model's own uri, not by `owner`. `owner` used to be
      // read off `model.getModeId()`, a method monaco no longer has — so it
      // was always `undefined`, which asks for the markers of *every* model on
      // the page rather than this editor's. The uri is what identifies one
      // editor's document.
      this.errors.emit(
        window.monaco?.editor.getModelMarkers({ resource: model.uri }) ?? []
      );
    });
  }

  onInitDiffEditor(diffEditor: Monaco.editor.IStandaloneDiffEditor): void {
    if (!this.base) {
      return;
    }

    diffEditor.getModifiedEditor().onDidChangeModelContent(() => {
      const content = diffEditor.getModel()?.modified.getValue();

      if (content !== undefined) {
        this.editorCtrl.setValue(content);
      }
    });
  }

  // new values
  writeValue(value: string) {
    this.value = this.format(value);
    this.editorCtrl.setValue(this.value, { emitEvent: false });
  }

  registerOnChange(fn: (value: string) => void) {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void) {
    this.onTouch = fn;
  }

  validate(): null {
    return null;
  }
}
