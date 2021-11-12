import { Component, Optional } from '@angular/core';
import { HotToastService } from '@ngneat/hot-toast';
import { IData, IMock, IOhMyBackup, IOhMyContext } from '@shared/type';
import { MatDialogRef } from '@angular/material/dialog';
import compareVersions from 'compare-versions';
import { FormControl } from '@angular/forms';
import { AppStateService } from 'src/app/services/app-state.service';
import { MigrateUtils } from '@shared/utils/migrate';
import { StateUtils } from '@shared/utils/state';
import { OhMyStateService } from 'src/app/services/state.service';
import { StorageService } from 'src/app/services/storage.service';
import { DataUtils } from '@shared/utils/data';

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
            let { requests, responses } = content;
            let state = this.stateService.state;

            if (MigrateUtils.shouldMigrate({ version: content.version })) {
              requests = (requests.map(MigrateUtils.migrate) as IData[]);
              responses = responses.map(MigrateUtils.migrate) as IMock[];
              // this.toast.warning(`Data was migrated from version ${version} to ${migratedState.version} before import!`);

            }


            // const isReplace = this.replaceCtrl.value;
            // const isSkip = this.skipCtrl.value;

            if (requests[0]) { // migration succeeded!
              let timestamp = Date.now();
              requests.sort((a, b) => a.lastHit > b.lastHit ? 1 : -1).forEach(r =>  {
                r.lastHit = timestamp++; // make sure they each have a unique timestamp!
                r = DataUtils.prefilWithPresets(r, state.presets);
                state = StateUtils.setData(state, r)
              });
              this.storageService.set(state.domain, state);

              for (const response of responses) {
                await this.storageService.set(response.id, response);
              }

              this.toast.success(`Imported ${requests.length} requests and  ${responses.length} responses from ${file.name} into ${this.appState.domain}`);
            } else if (compareVersions(content.version, this.appState.version) === 1) {
              this.toast.error(`Import failed, your version of OhMyMock is too old`)
            } else {
              this.toast.warning(`Nothing imported, version of the data is too old!`);
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
