import { Component, inject } from '@angular/core';
import { HotToastService } from '@ngxpert/hot-toast';
import { IOhMyBackup, IOhMyContext } from '@shared/type';
import { MatDialogRef } from '@angular/material/dialog';
import { UntypedFormControl } from '@angular/forms';
import { AppStateService } from '../../services/app-state.service';
import { OhMyStateService } from '../../services/state.service';
import { StorageService } from '../../services/storage.service';
import { importJSON, ImportResultEnum } from '@shared/utils/import-json';
import { FileUploaderComponent } from '../file-uploader/file-uploader.component';
import { NgClass } from '@angular/common';
import { SpinnerComponent } from '../spinner/spinner.component';

@Component({
  selector: 'oh-my-json-import',
  templateUrl: './json-import.component.html',
  styleUrls: ['./json-import.component.scss'],
  imports: [FileUploaderComponent, NgClass, SpinnerComponent]
})
export class JsonImportComponent {
  dialogRef = inject<MatDialogRef<JsonImportComponent>>(MatDialogRef, {
    optional: true
  });
  private appState = inject(AppStateService);
  private stateService = inject(OhMyStateService);
  private storageService = inject(StorageService);
  private toast = inject(HotToastService);

  isUploading = false;
  skipCtrl = new UntypedFormControl(false);
  replaceCtrl = new UntypedFormControl(false);
  context!: IOhMyContext;

  onUploadFile(fileList: FileList): void {
    Array.from(fileList).forEach((file) => {
      const fileReader = new FileReader();
      fileReader.onload = (fileLoadedEvent) => {
        this.isUploading = true;

        setTimeout(async () => {
          // Parsing gets a try/catch of its own: with the import inside the
          // same one, a storage failure — or, before `importJSON` learnt to
          // skip unmigratable records, a throw over one such record — was
          // reported as "does not contain (valid) JSON", sending whoever
          // debugged it to stare at a perfectly valid file.
          let content: IOhMyBackup;

          try {
            content = JSON.parse(
              fileLoadedEvent.target?.result as string
            ) as IOhMyBackup;
          } catch {
            this.toast.error(
              `File ${file.name} does not contain (valid) JSON`
            );
            this.isUploading = false;
            this.dialogRef?.close();

            return;
          }

          try {
            const result = await importJSON(
              content,
              this.stateService.state.context
            );

            if (result.status === ImportResultEnum.SUCCESS) {
              // The counts come from the import, not from the file: a partly
              // too-old backup keeps its healthy records and drops the rest,
              // and the toast should not claim more than what was stored.
              this.toast.success(
                `Imported ${result.requests} requests and ${result.responses} responses from ${file.name} into ${this.appState.domain}`
              );

              const dropped =
                (content.requests?.length ?? 0) - result.requests +
                (content.responses?.length ?? 0) - result.responses;

              if (dropped > 0) {
                this.toast.warning(
                  `${dropped} record${dropped === 1 ? ' was' : 's were'} too old to migrate and skipped`
                );
              }
            } else if (result.status === ImportResultEnum.TOO_OLD) {
              // The records are too old, not the extension: `MigrateUtils`
              // keeps records from a *newer* release untouched, so age of the
              // backup is the only way to land here.
              this.toast.error(
                `Import failed, the records in ${file.name} are too old to migrate`
              );
            }
          } catch {
            this.toast.error(`Import of ${file.name} failed`);
          } finally {
            this.isUploading = false;
          }

          this.dialogRef?.close();
        }, 500);
      };

      fileReader.readAsText(file, 'UTF-8');
    });
  }
}
