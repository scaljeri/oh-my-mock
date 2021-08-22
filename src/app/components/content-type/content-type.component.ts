import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

const MIME_TYPES = [
  'text/css',
  'text/csv',
  'text/html',
  'text/javascript',
  'image/svg+xml',
  'text/plain',
  'application/json'
];

@Component({
  selector: 'oh-my-content-type',
  templateUrl: './content-type.component.html',
  styleUrls: ['./content-type.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContentTypeComponent implements OnInit {
  @Input() contentType: string;
  @Output() update = new EventEmitter<string>();

  ctrl = new FormControl();
  filteredMimeTypes$: Observable<string[]>;
  input: string;
  private rest: string;

  ngOnInit(): void {
    this.filteredMimeTypes$ = this.ctrl.valueChanges.pipe(
      map(value => MIME_TYPES.filter(mt => mt.includes(value))),
      tap(() => {
        if (this.ctrl.value !== this.input) {
          this.input = this.ctrl.value;
          this.update.emit(this.ctrl.value + this.rest);
        }
      })
    );
  }

  ngOnChanges(): void {
    [this.input, this.rest] = this.contentType?.match(/^([^;]+)(;?.*)$/)?.slice(1, 3) || [];
  }
}
