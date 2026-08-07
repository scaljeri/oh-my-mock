import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { HotToastService } from '@ngxpert/hot-toast';
import { IOhMyBackup, IOhMyContext } from '@shared/type';
import { MatDialogRef } from '@angular/material/dialog';
import { UntypedFormControl } from '@angular/forms';
import { AppStateService } from '../../services/app-state.service';
import { OhMyStateService } from '../../services/state.service';
import { ImportResultEnum } from '@shared/utils/import-json';
import { OhMyState } from '../../services/oh-my-store';
import { FileUploaderComponent } from '../file-uploader/file-uploader.component';
import { NgClass } from '@angular/common';
import { SpinnerComponent } from '../spinner/spinner.component';

@Component({
  selector: 'oh-my-json-import',
  templateUrl: './json-import.component.html',
  styleUrls: ['./json-import.component.scss'],
  imports: [FileUploaderComponent, NgClass, SpinnerComponent],
  // Stated rather than inherited: Angular 22 made OnPush the default for every
  // component, so this one has been OnPush since the upgrade whether it said so
  // or not. Writing it down is what makes the `markForCheck` calls below read as
  // deliberate instead of superstitious.
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JsonImportComponent {
  dialogRef = inject<MatDialogRef<JsonImportComponent>>(MatDialogRef, {
    optional: true
  });
  private appState = inject(AppStateService);
  private stateService = inject(OhMyStateService);
  private storeService = inject(OhMyState);
  private toast = inject(HotToastService);
  private cdr = inject(ChangeDetectorRef);

  isUploading = false;
  skipCtrl = new UntypedFormControl(false);
  replaceCtrl = new UntypedFormControl(false);
  context!: IOhMyContext;

  onUploadFile(fileList: FileList): void {
    Array.from(fileList).forEach((file) => {
      const fileReader = new FileReader();
      fileReader.onload = async (fileLoadedEvent) => {
        this.isUploading = true;
        // Under OnPush a plain field assignment dirties nothing, and this one
        // happens in a `FileReader` callback rather than in a listener bound in
        // the template — so nothing else marks the view either. Without this
        // the spinner never appears and `is-busy` never lands on the uploader:
        // the exact "dialog sits there looking like nothing happened" that the
        // spinner was added for in #95, back when the strategy was Eager and
        // the assignment was enough on its own.
        this.cdr.markForCheck();

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
          // Through the background rather than straight into storage. A full
          // reset is held apart from every other piece of work by the wipe
          // barrier, which can only see work running in the service worker —
          // an import writing records from this process landed in the middle
          // of a wipe and left mocks nothing lists. See `importBackup`.
          const result = await this.storeService.importBackup(
            content,
            this.stateService.state.context
          );

          switch (result.status) {
            case ImportResultEnum.SUCCESS: {
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

              break;
            }

            case ImportResultEnum.DISCARDED:
              // A reset arrived while this was importing, and the reset wins:
              // the records were written and then wiped with everything else.
              //
              // Said here, as a toast, rather than filed on `errors$` behind
              // the header's "Show errors" button. That channel is for faults
              // the user did not ask for and has to go and read; this is
              // neither. The user pressed Reset and it did exactly what it
              // says, so an error badge left in the header over a correct
              // outcome would be the wrong claim in the wrong place — and it
              // would arrive after this dialog, whose success toast is the
              // sentence actually being corrected, has closed.
              //
              // `warning`, not `error`: nothing failed. It is the same class
              // of statement as "some records were too old", which is the
              // other place this component says "you got less than you gave
              // me" — and it ends by saying what to do about it, because
              // importing the file again is all it takes.
              this.toast.warning(
                `Nothing was imported from ${file.name}: everything was reset while the import was running. Import it again to keep it.`
              );

              break;

            case ImportResultEnum.TOO_OLD:
              // The records are too old, not the extension: `MigrateUtils`
              // keeps records from a *newer* release untouched, so age of the
              // backup is the only way to land here.
              this.toast.error(
                `Import failed, the records in ${file.name} are too old to migrate`
              );

              break;

            default:
              // Reachable now that the import runs in another process: the
              // background answers ERROR for a backup it could not store. It
              // used to be unreachable, and the silence it got — no toast, a
              // dialog closing as if all was well — was survivable only
              // because of that.
              this.toast.error(`Import of ${file.name} failed`);
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
      // Taking the spinner down needs the same nudge as putting it up. Closing
      // the dialog usually tears the view down anyway, but `dialogRef` is
      // injected optionally — used outside a dialog there is no close, and the
      // spinner would stay on screen over an import that had finished.
      this.cdr.markForCheck();
      this.dialogRef?.close();
    }
  }
}
