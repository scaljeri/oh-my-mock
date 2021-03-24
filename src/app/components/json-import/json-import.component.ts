import { Component } from '@angular/core';
import { HotToastService } from '@ngneat/hot-toast';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { IData, IState } from '@shared/type';
import { UpsertData } from 'src/app/store/actions';

@Component({
  selector: 'oh-my-json-import',
  templateUrl: './json-import.component.html',
  styleUrls: ['./json-import.component.scss']
})
export class JsonImportComponent {

  @Dispatch() upsertData = (data: IData, domain: string) => new UpsertData(data, domain);

  constructor(private toast: HotToastService) {}

  onUploadFile(fileList: FileList): void {
    const fileReader = new FileReader();
    fileReader.onload = (fileLoadedEvent) => {
      try {
        const importedState = JSON.parse(fileLoadedEvent.target.result as string) as IState;

        importedState.data.forEach(d => {
          this.upsertData(d, importedState.domain);
        });
        this.toast.success(`Imported ${importedState.data.length} mocks into ${importedState.domain}`);
      } catch {
        this.toast.error('The file to import does not contain (valid) JSON');
      }
    };

    fileReader.readAsText(fileList[0], "UTF-8");
  }
}
