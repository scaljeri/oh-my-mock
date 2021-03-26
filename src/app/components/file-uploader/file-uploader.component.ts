import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'oh-my-file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.scss']
})
export class FileUploaderComponent {
  @Input() multiple: boolean;
  @Input() dragDropEnabled = true;
  @Input() fileType = 'json';
  @Output() filesChanged = new EventEmitter<FileList>();

  @ViewChild('fileInput') inputRef: ElementRef<HTMLInputElement>;

  addFiles(files: FileList): void {
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
