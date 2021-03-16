import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import * as hljs from 'highlight.js';
import { PrettyPrintPipe } from 'src/app/pipes/pretty-print.pipe';

@Component({
  selector: 'app-edit-data',
  templateUrl: './edit-data.component.html',
  styleUrls: ['./edit-data.component.scss']
})
export class EditDataComponent implements AfterViewInit {
  @Input() data: Record<string, string> | string;
  @Input() type = 'json';
  @Input() editable = true;
  @Output() dataChange = new EventEmitter<string>();

  @ViewChild('ref') ref: ElementRef;

  public error: string;
  private timeoutId: number;

  constructor(private prettyPrintPipe: PrettyPrintPipe) { }

  ngAfterViewInit(): void {
    this.injectCode();
  }

  ngOnChanges(): void {
    this.injectCode();
  }

  private injectCode(): void {
    if (this.ref) {
      this.ref.nativeElement.innerHTML = '';

      const codeEl = document.createElement('code');
      codeEl.className = `language-${this.type}`;

      if (this.editable) {
        codeEl.setAttribute('contenteditable', 'true');
      }

      if (this.type === 'json') {
        codeEl.innerText = this.prettyPrintPipe.transform(
          this.data as Record<string, string>
        );
      }

      codeEl.addEventListener('blur', () => {
        this.onDataChange();
      });

      hljs.highlightBlock(codeEl);
      this.ref.nativeElement.appendChild(codeEl);
    }
  }

  onDataChange(): void {
    const txt = this.ref.nativeElement.innerText;
    this.error = null;
    this.dataChange.emit(txt);

    if (this.type === 'json' && txt.length > 0) {
      clearTimeout(this.timeoutId);

      this.timeoutId = setTimeout(() => {
        try {
          JSON.parse(txt);
        } catch (err) {
          this.error = err;
        }
      }, 1000);
    }
  }

  onPreClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('code-wrapper')) {
      const code = (event.target as HTMLElement).querySelector('code');
      code.focus();

      // Move Caret to end of content
      const range = document.createRange();
      range.selectNodeContents(code);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}
