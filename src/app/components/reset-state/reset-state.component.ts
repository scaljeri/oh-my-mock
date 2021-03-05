import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { resetStateOptions } from '@shared/constants';
import { ResetStateOptions } from '@shared/type';
import { StorageService } from 'src/app/services/storage.service';

@Component({
  selector: 'app-reset-state',
  templateUrl: './reset-state.component.html',
  styleUrls: ['./reset-state.component.scss']
})
export class ResetStateComponent implements OnInit {
  public domain: string;
  public optionTypes = resetStateOptions;

  constructor(private storageService: StorageService, private dialogRef: MatDialogRef<ResetStateComponent>) { }

  ngOnInit(): void {
    this.domain = this.storageService.domain;
  }

  onCancel(): void {
   this.dialogRef.close();
  }

  onReset(option: ResetStateOptions ): void {
   this.dialogRef.close(option);
  }
}
