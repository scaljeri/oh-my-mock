import { Directive, HostListener, Input, Output, EventEmitter, HostBinding } from '@angular/core';

@Directive({
  selector: '[ohMyFileDragDrop]'
})
export class FileDragDropDirective {

  private _enabled: boolean;
  private _dragInProgress: boolean;

  @Input() set ohMyFileDragDrop(value: boolean | string) {
    this._enabled = value === '' ? true : !!value;
  }


  @HostBinding('class.dragging') get dragInProgress() {
    return this._dragInProgress;
  }

  @Output() dropped = new EventEmitter<DragEvent>();

  @HostListener('dragenter', ['$event'])
  @HostListener('dragover', ['$event'])
  private handleDragOver(event: DragEvent): void {
    if (!this._enabled) {
      return;
    }
    event.dataTransfer.dropEffect = 'move';
    this.stopAndPreventDefault(event);
    this._dragInProgress = true;
  }

  @HostListener('dragleave', ['$event'])
  @HostListener('dragend', ['$event'])
  private handleDragEnd(event: DragEvent): void {
    if (!this._enabled) {
      return;
    }
    this.stopAndPreventDefault(event);
    event.dataTransfer.effectAllowed = 'copy';
    this._dragInProgress = false;
  }

  @HostListener('drop', ['$event'])
  private handleDrop(event: DragEvent): void {
    this.stopAndPreventDefault(event);
    this._dragInProgress = false;
    this.dropped.emit(event);
  }

  stopAndPreventDefault(e: UIEvent): void {
    e.stopPropagation();
    e.preventDefault();
  }
}
