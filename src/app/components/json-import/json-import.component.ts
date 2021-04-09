import { Component } from '@angular/core';
import { HotToastService } from '@ngneat/hot-toast';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Store } from '@ngxs/store';
import { findActiveData } from '../../../shared/utils/find-mock'
import { IData, IState, IStore } from '@shared/type';
import { UpsertData } from 'src/app/store/actions';
import { OhMyState } from 'src/app/store/state';

@Component({
  selector: 'oh-my-json-import',
  templateUrl: './json-import.component.html',
  styleUrls: ['./json-import.component.scss']
})
export class JsonImportComponent {

  @Dispatch() upsertData = (data: IData, domain: string) => new UpsertData(data, domain);

  constructor(private store: Store, private toast: HotToastService) { }

  onUploadFile(fileList: FileList): void {
    const state = this.store.selectSnapshot<IState>((state: IStore) => OhMyState.getActiveState(state));

    Array.from(fileList).forEach(file => {
      const fileReader = new FileReader();
      fileReader.onload = (fileLoadedEvent) => {
        try {
          const importedState = JSON.parse(fileLoadedEvent.target.result as string) as IState;
          let addCount = 0;

          // Mocks that already exist are not imported but skipped
          importedState.data.forEach(d => {
            if (!findActiveData(state, d.url, d.method, d.type)) {
              addCount ++;
              this.upsertData(d, importedState.domain);
            }
          });

          if (addCount > 0) {
            this.toast.success(`Imported mocks from ${file.name} into ${importedState.domain} (added ${addCount}/${importedState.data.length})`);
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
