import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, ActivatedRouteSnapshot } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Store } from '@ngxs/store';
import * as hljs from 'highlight.js';
import { HotToastService } from '@ngneat/hot-toast';
import { UpdateMock } from 'src/app/store/actions';
import { IMock, IOhMyMock, IState } from 'src/app/store/type';
import { STORAGE_KEY } from 'src/app/types';
import { MockTestComponent } from '../mock-test/mock-test.component';

const DEFAULT_CODE = `// global variables:
//   response: if active, this variable contains the api response
//   mock: if active, this variable contains the mock data
// IMPORTANT: This code should return a response!'

return response || mock;`;

@Component({
  selector: 'app-mock',
  templateUrl: './mock.component.html',
  styleUrls: ['./mock.component.scss']
})
export class MockComponent implements OnInit, AfterViewInit {
  defaultCode = DEFAULT_CODE;
  mock: IMock;
  panelOpenState = false;
  originalResponse: string;
  jsonError: string;
  jsError: string;
  isSyntaxOk = false;
  text: string;

  @ViewChild('responseMock') responseMock: ElementRef;
  @ViewChild('responseOrig') responseOrig: ElementRef;
  @ViewChild('codeEditor') editor: ElementRef;

  @Dispatch() updateMock = (mock: IMock) => new UpdateMock(mock);

  constructor(private activeRoute: ActivatedRoute, private store: Store,
    public dialog: MatDialog,
    private toast: HotToastService,
    private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    const mockId = decodeURIComponent(this.activeRoute.snapshot.params.id);

    this.mock = this.store.selectSnapshot<IMock>((state: IOhMyMock) => {
      return { ...state[STORAGE_KEY].urls[mockId] };
    });
    this.originalResponse = JSON.stringify(this.mock.payload, null, 4);
    this.store.select(state => state[STORAGE_KEY].urls[mockId])
      .subscribe((mock: IMock) => {
        this.mock = { ...this.mock, payload: mock.payload };
      });

  }

  ngAfterViewInit(): void {
    hljs.highlightBlock(this.responseMock.nativeElement.querySelector('code'));
    hljs.highlightBlock(this.responseOrig.nativeElement);

  }

  copyResponse(source?) {
    this.mock.mock = source || this.mock.payload;

    const codeEl = document.createElement('code');
    codeEl.innerText = JSON.stringify(this.mock.mock, null, 4);
    this.responseMock.nativeElement.innerHTML = '';
    this.responseMock.nativeElement.appendChild(codeEl);
    hljs.highlightBlock(codeEl);

    if (!source) {
      this.jsonError = null;
    }

    // this.cdr.detectChanges();
  }

  onMockBlur(): void {
    this.jsonError = null;

    try {
      this.mock.mock = JSON.parse(this.responseMock.nativeElement.innerText);
      this.copyResponse(this.mock.mock);
    } catch (e) {
      this.jsonError = e;
    }
  }

  onCodePanelCheck(useContent = false, runTest = false): void {
    this.isSyntaxOk = false;
    this.jsError = null;

    if (useContent) {
      const code = this.editor.nativeElement.innerText.replace(/^\s+|\s+$/g, '');
      try {
        const fnc = eval(new Function('response', 'mock', code) as any);
        this.mock.code = code;
        this.isSyntaxOk = true;
        if (runTest) {
          const dialogRef = this.dialog.open(MockTestComponent, {
            data: { result: fnc(this.mock.payload, this.mock.mock) }
          });

          dialogRef.afterClosed().subscribe(result => {
            console.log(`Dialog result: ${result}`);
          });

        }
      } catch (e) {
        this.jsError = e;
      }

      this.editor.nativeElement.innerHTML = `<code>${code}</code>`;
    }
    hljs.highlightBlock(this.editor.nativeElement.querySelector('code'));
  }

  onCodeBlur(): void {
    this.onCodePanelCheck(true);
  }

  onSave(): void {
    this.updateMock(this.mock)
    this.toast.success('Mock saved!!');
  }
}