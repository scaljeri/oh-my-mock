import { Component, OnInit, inject } from '@angular/core';
import {
  UntypedFormControl,
  ReactiveFormsModule,
  FormsModule
} from '@angular/forms';
import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA
} from '@angular/material/dialog';
import { MOCK_RULE_TYPES } from '@shared/constants';
import { IMock, IOhMyMockRule, mockRuleType } from '@shared/types/mock';
import { generators } from '../../utils/anonymizer';
import { JSONPath } from 'jsonpath-plus';
import { DialogCodeEditorComponent } from '../dialog/code-editor/code-editor.component';
import {
  MatSelectChange,
  MatSelect,
  MatOption
} from '@angular/material/select';
import {
  MatFormField,
  MatLabel,
  MatSuffix
} from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import {
  MatIconButton,
  MatMiniFabButton,
  MatButton
} from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'oh-my-anonymize',
  templateUrl: './anonymize.component.html',
  styleUrls: ['./anonymize.component.scss'],
  imports: [
    MatFormField,
    MatLabel,
    MatSelect,
    ReactiveFormsModule,
    FormsModule,
    MatOption,
    MatInput,
    MatIconButton,
    MatSuffix,
    MatIcon,
    MatMiniFabButton,
    MatButton
  ]
})
export class AnonymizeComponent implements OnInit {
  dialog = inject(MatDialog);
  // Not optional. These were `@Optional()` with non-nullable types, which told
  // DI they might be absent while telling TypeScript they never are — so
  // `this.mock.rules` compiled against a value that could have been null. This
  // component is only ever reached through `dialog.open(AnonymizeComponent,
  // { data })` (see `request.component.ts`), never as an element in a template,
  // so both really are always there and the type now says the same thing DI does.
  private dialogRef = inject<MatDialogRef<AnonymizeComponent>>(MatDialogRef);
  mock = inject<IMock>(MAT_DIALOG_DATA);

  ruleTypes!: mockRuleType[];

  newRuleTypeCtrl = new UntypedFormControl();
  newRuleValueCtrl = new UntypedFormControl('');

  mockTypes = MOCK_RULE_TYPES;
  rules!: IOhMyMockRule[];

  ngOnInit(): void {
    this.ruleTypes = Object.keys(MOCK_RULE_TYPES) as mockRuleType[];
    this.rules = [...(this.mock.rules || [])];
    this.rules.push({ type: null, path: '' });
  }

  onTypeChange({ value }: MatSelectChange, index: number) {
    this.rules[index].type = value;
  }

  onPathChange(event: Event, index: number) {
    const target = event.target as HTMLInputElement;
    this.rules[index].path = target.value;
  }

  onAdd(): void {
    this.rules.push({ type: null, path: '' });
  }

  onDelete(index: number): void {
    this.rules = this.rules.filter((r, i) => i !== index);
  }

  onTest(): void {
    // Apply Rules
    const resp = this.applyRules(this.mock.responseMock);

    this.dialog.open(DialogCodeEditorComponent, {
      width: '80%',
      data: {
        readonly: true,
        code: resp,
        base: this.mock.responseMock,
        type: 'json'
      }
    });
  }

  applyRules(jsonStr = this.mock.responseMock): unknown {
    const rules = this.rules.filter((r) => r.type && r.path);
    // deep clone
    const json = JSON.parse(
      typeof jsonStr === 'string' ? jsonStr : JSON.stringify(jsonStr)
    );

    rules.forEach((r) => {
      JSONPath({
        path: r.path,
        json,
        parent: true,
        callback: (a, b, c) => {
          if (r.type) {
            c.parent[c.parentProperty] = generators[r.type]();
          }
        }
      });
    });

    return json;
  }

  onClose(data?: unknown): void {
    this.dialogRef.close({
      data,
      rules: this.rules.filter((r) => r.type && r.path)
    });
  }

  onApply(): void {
    this.onClose(JSON.stringify(this.applyRules()));
  }
}
