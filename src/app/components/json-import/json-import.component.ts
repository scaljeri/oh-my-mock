import { Component, Optional } from '@angular/core';
import { HotToastService } from '@ngneat/hot-toast';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Store } from '@ngxs/store';
import { IData, IState } from '@shared/type';
import { UpsertData } from 'src/app/store/actions';
import { MigrationsService } from 'src/app/services/migrations.service';
import { uniqueId } from '@shared/utils/unique-id';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'oh-my-json-import',
  templateUrl: './json-import.component.html',
  styleUrls: ['./json-import.component.scss']
})
export class JsonImportComponent {

  @Dispatch() upsertData = (data: IData) => new UpsertData(data);

  constructor(
    @Optional() public dialogRef: MatDialogRef<JsonImportComponent>,
    private mirgationService: MigrationsService, private store: Store, private toast: HotToastService) { }

  onUploadFile(fileList: FileList): void {
    Array.from(fileList).forEach(file => {
      const fileReader = new FileReader();
      fileReader.onload = (fileLoadedEvent) => {

        try {
          const { domain, version, data } = JSON.parse(fileLoadedEvent.target.result as string) as IState & { version: string };

          const migratedState = this.mirgationService.update(
            { version, domains: { [domain]: { domain, data, views: {}, toggles: {} } } });

          if (version > migratedState.version && !version.match(/^__/)) { // In development the version starts with __
            this.toast.error(`Import failed, version of OhMyMock is too old`)
          } else if ((version || '0.0.0') < migratedState.version) {
            if (migratedState.domains[domain]?.data?.length !== 0) {
              return this.toast.warning(`Nothing imported, version of the data is too old!`);
            } else {
              this.toast.warning(`Data was migrated to version ${migratedState.version} before import!`);
            }
          }

          migratedState.domains[domain]?.data.forEach(d => {
            this.upsertData({ ...d, id: uniqueId() });
          });

          this.toast.success(`Imported ${migratedState.domains[domain]?.data?.length || 0} mocks from ${file.name} into ${domain}`);
        } catch {
          this.toast.error(`File ${file} does not contain (valid) JSON`);
        }

        this.dialogRef?.close();
      };

      fileReader.readAsText(file, "UTF-8");
    });
  }
}
