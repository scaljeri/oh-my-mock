import { Component, Inject, OnInit, Optional } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { RESPONSE_RULE_TYPES } from '@shared/constants';
import { IOhMyResponse, IOhMyMockRule, IOhMyResponseRuleType } from '@shared/type';
import { generators } from '../../utils/anonymizer';
import { JSONPath } from 'jsonpath-plus';
import { DialogCodeEditorComponent } from '../dialog/code-editor/code-editor.component';

@Component({
  selector: 'oh-my-anonymize',
  templateUrl: './anonymize.component.html',
  styleUrls: ['./anonymize.component.scss']
})
export class AnonymizeComponent implements OnInit {
  ruleTypes: IOhMyResponseRuleType[];

  newRuleTypeCtrl = new UntypedFormControl();
  newRuleValueCtrl = new UntypedFormControl('');

  mockTypes = RESPONSE_RULE_TYPES;
  rules: IOhMyMockRule[];

  constructor(public dialog: MatDialog,
    @Optional() private dialogRef: MatDialogRef<AnonymizeComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public mock: IOhMyResponse) { }

  ngOnInit(): void {
    this.ruleTypes = Object.keys(RESPONSE_RULE_TYPES) as IOhMyResponseRuleType[];
    this.rules = [...this.mock.rules || []];
    this.rules.push({ type: null, path: '' });
  }

  onTypeChange({ value }, index) {
    this.rules[index].type = value;
  }

  onPathChange({ target }, index) {
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
        type: 'json',
      }
    });
  }

  applyRules(jsonStr = this.mock.responseMock): unknown {
    const rules = this.rules.filter(r => r.type && r.path);
    // deep clone
    const json = JSON.parse(typeof jsonStr === 'string' ? jsonStr : JSON.stringify(jsonStr));

    rules.forEach(r => {
      JSONPath({
        path: r.path, json, parent: true, callback: (a, b, c) => {
          c.parent[c.parentProperty] = generators[r.type]();
        }
      });
    });

    return json;
  }

  onClose(data?: unknown): void {
    this.dialogRef.close({ data, rules: this.rules.filter(r => r.type && r.path) });
  }

  onApply(): void {
    this.onClose(JSON.stringify(this.applyRules()));
  }
}
