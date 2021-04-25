import { Component, Inject, OnInit, Optional } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MOCK_RULE_TYPES } from '@shared/constants';
import { IMock, IOhMyMockRule, mockRuleType } from '@shared/type';
import { CodeEditComponent } from '../code-edit/code-edit.component';
import { applyRules } from '../../utils/anonymizer';

@Component({
  selector: 'oh-my-anonymize',
  templateUrl: './anonymize.component.html',
  styleUrls: ['./anonymize.component.scss']
})
export class AnonymizeComponent implements OnInit {
  ruleTypes: mockRuleType[];

  newRuleTypeCtrl = new FormControl();
  newRuleValueCtrl = new FormControl('');

  mockTypes = MOCK_RULE_TYPES;
  rules: IOhMyMockRule[];

  constructor(public dialog: MatDialog,
    @Optional() private dialogRef: MatDialogRef<AnonymizeComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public mock: IMock) { }

  ngOnInit(): void {
    this.ruleTypes = Object.keys(MOCK_RULE_TYPES) as mockRuleType[];
    this.rules = this.mock.rules || [];
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
    const resp = this.applyRules();

    this.dialog.open(CodeEditComponent, {
      width: '80%',
      data: {
        readonly: true,
        code: resp,
        compare: this.mock.responseMock,
        type: 'json',
      }
    });
  }

  applyRules(): unknown {
    const rules = this.rules.filter(r => r.type && r.path);

    return applyRules(JSON.parse(this.mock.responseMock), rules);
  }

  onClose(data?: unknown): void {
    this.dialogRef.close(data);
  }

  onApply(): void {
    this.onClose(JSON.stringify(this.applyRules()));
  }
}
