import { Component, Optional } from '@angular/core';
import { HotToastService } from '@ngneat/hot-toast';
import { IOhMyBackup, IOhMyContext } from '@shared/type';
import { MatDialogRef } from '@angular/material/dialog';
import { FormControl } from '@angular/forms';
import { AppStateService } from 'src/app/services/app-state.service';
import { OhMyStateService } from 'src/app/services/state.service';
import { StorageService } from 'src/app/services/storage.service';
import { importJSON, ImportResultEnum } from 'src/app/utils/import-json';

@Component({
  selector: 'oh-my-json-import',
  templateUrl: './json-import.component.html',
  styleUrls: ['./json-import.component.scss']
})
export class JsonImportComponent {

  isUploading = false;
  skipCtrl = new FormControl(false);
  replaceCtrl = new FormControl(false);
  context: IOhMyContext;

  constructor(
    @Optional() public dialogRef: MatDialogRef<JsonImportComponent>,
    private appState: AppStateService,
    private stateService: OhMyStateService,
    private storageService: StorageService,
    private toast: HotToastService) { }

  onUploadFile(fileList: FileList): void {
    Array.from(fileList).forEach(file => {
      const fileReader = new FileReader();
      fileReader.onload = (fileLoadedEvent) => {

        this.isUploading = true;

        setTimeout(async () => {
          try {
            const content = JSON.parse(fileLoadedEvent.target.result as string) as IOhMyBackup;
            const { requests, responses } = content;

            const result = await importJSON(content, this.stateService.state.context);

            if (result.status === ImportResultEnum.SUCCESS) {
              this.toast.success(`Imported ${requests.length} requests and  ${responses.length} responses from ${file.name} into ${this.appState.domain}`);
            } else if (result.status === ImportResultEnum.TOO_OLD) {
              this.toast.error(`Import failed, your version of OhMyMock is too old`)
            }
          } catch {
            this.toast.error(`File ${file} does not contain (valid) JSON`);
          } finally {
            this.isUploading = false;
          }

          this.dialogRef?.close();
        }, 500);
      };

      fileReader.readAsText(file, "UTF-8");
    });
  }
}
