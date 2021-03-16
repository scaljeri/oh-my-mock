import { Component, Inject } from '@angular/core';
import { MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IData } from '@shared/type';

@Component({
  selector: 'app-ng-api-mock-create-mock-dialog-wrapper',
  templateUrl: './ng-api-mock-create-mock-dialog-wrapper.component.html',
  styleUrls: ['./ng-api-mock-create-mock-dialog-wrapper.component.scss']
})
export class NgApiMockCreateMockDialogWrapperComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public mockData: IData,
    private dialogService: MatDialog
  ) {}

  closeDialogs(): void {
	  console.log('closeemall')
    this.dialogService.closeAll();
  }
}
