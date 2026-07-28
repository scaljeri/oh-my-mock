import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

@Component({
  standalone: false,
  selector: 'oh-my-file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.scss']
})
export class FileUploaderComponent {
  /**
   * What is being uploaded. It used to be hard-coded to the JSON backup's
   * wording, which is wrong above a HAR drop zone — the component itself does
   * not care what the file holds.
   */
  @Input() heading = 'Import Requests and Responses';
  @Input() multiple!: boolean;
  @Input() dragDropEnabled = true;
  @Input() fileType = 'json';
  @Output() filesChanged = new EventEmitter<FileList>();

  @ViewChild('fileInput') inputRef!: ElementRef<HTMLInputElement>;

  addFiles(files: FileList | undefined): void {
    this.filesChanged.emit(files);
  }

  handleFileDrop(event: DragEvent) {
    if (event?.dataTransfer?.files?.length) {
      const files = event.dataTransfer.files;
      this.inputRef.nativeElement.files = files;
      this.addFiles(files);
    }
  }
}
