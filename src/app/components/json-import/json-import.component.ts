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
      fileReader.onload = async (fileLoadedEvent) => {
        this.isUploading = true;

        // The import starts here, on the read, rather than on a timer. A
        // 500ms `setTimeout` used to sit between the two: it arrived with the
        // spinner itself (#95), back when this whole body was synchronous —
        // `isUploading` went true and false again inside one task, so change
        // detection never ran between them and the spinner could not appear
        // at all. Deferring the work was how it got a chance to.
        //
        // Splitting storage (#105) made the import `await` real writes, which
        // yields to change detection on its own, and the reason expired
        // there. The delay did not: every import since has spent half a
        // second showing a spinner over nothing before starting, and on a
        // file that turns out not to be JSON it spun for 500ms only to say
        // so. `har-import` reads and stores the same records with no delay of
        // any kind, which is the shape this should have had all along.
        //
        // Anything reintroduced here would be a wall-clock guess at a paint,
        // so `does not gate the import behind a timer` in the spec fails on a
        // frozen clock if one comes back.

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
          this.toast.error(`File ${file.name} does not contain (valid) JSON`);
          this.finish();

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
          this.finish();
        }
      };

      // `load` is not the only way a read ends, and it used to be the only one
      // handled: an unreadable file fired `error`, nothing listened, and the
      // import simply stopped — no toast, no spinner and no close, so the
      // dialog sat there looking like it was still working. A file moved,
      // renamed or unmounted between being picked and being read is all it
      // takes. `har-import` reads through a promise that rejects on `error`
      // for exactly this reason; this one never got the same treatment.
      fileReader.onerror = () => this.finish(`File ${file.name} could not be read`);
      // `abort` means the read was cancelled rather than failed, which is
      // nothing worth a toast — but it still has to hand the dialog back.
      fileReader.onabort = () => this.finish();

      fileReader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * Ends the upload: stops the spinner and closes the dialog, saying why when
   * there is something to say.
   *
   * Closing is the only signal this component gives that it is done with the
   * file, so every way out of `onUploadFile` has to reach it — including the
   * ones that are not a `return`.
   */
  private finish(message?: string): void {
    try {
      if (message) {
        this.toast.error(message);
      }
    } finally {
      this.isUploading = false;
      this.dialogRef?.close();
    }
  }
}
