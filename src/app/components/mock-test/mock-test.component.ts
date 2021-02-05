import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface DialogTestData {
  result: Record<string, unknown>;
}

@Component({
  selector: 'app-mock-test',
  templateUrl: './mock-test.component.html',
  styleUrls: ['./mock-test.component.scss']
})
export class MockTestComponent {
  constructor(
    public dialogRef: MatDialogRef<MockTestComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogTestData) { }

  onNoClick(): void {
    this.dialogRef.close();
  }
}
