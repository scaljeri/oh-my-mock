import { Component } from '@angular/core';
import { HotToastService } from '@ngneat/hot-toast';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Store } from '@ngxs/store';
import { findActiveData } from '../../../shared/utils/find-mock'
import { IData, IState, IStore } from '@shared/type';
import { UpsertData } from 'src/app/store/actions';
import { OhMyState } from 'src/app/store/state';
import { MigrationsService } from 'src/app/services/migrations.service';

@Component({
  selector: 'oh-my-json-import',
  templateUrl: './json-import.component.html',
  styleUrls: ['./json-import.component.scss']
})
export class JsonImportComponent {

  @Dispatch() upsertData = (data: IData, domain: string) => new UpsertData(data, domain);

  constructor(private mirgationService: MigrationsService, private store: Store, private toast: HotToastService) { }

  onUploadFile(fileList: FileList): void {
    const state = this.store.selectSnapshot<IState>((state: IStore) => OhMyState.getActiveState(state));

    Array.from(fileList).forEach(file => {
      const fileReader = new FileReader();
      fileReader.onload = (fileLoadedEvent) => {
        try {
          const { domain, version, data } = JSON.parse(fileLoadedEvent.target.result as string) as IState & { version: string };
          let addCount = 0;

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

          // Mocks that already exist are not imported but skipped, this should change!!
          // TODO: A mock can already exist, but the import can have different status codes!!
          migratedState.domains[domain]?.data.forEach(d => {
            if (!findActiveData(state, d.url, d.method, d.type)) {
              addCount++;
              this.upsertData(d, domain);
            }
          });

          if (addCount > 0) {
            this.toast.success(`Imported mocks from ${file.name} into ${domain} (added ${addCount}/${data.length})`);
          } else {
            this.toast.warning(`No mocks where imported, they all exist already!`);
          }
        } catch {
          this.toast.error(`File ${file} does not contain (valid) JSON`);
        }
      };

      fileReader.readAsText(file, "UTF-8");
    });
  }
}
