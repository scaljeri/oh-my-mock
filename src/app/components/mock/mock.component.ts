import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot } from '@angular/router';
import { Store } from '@ngxs/store';
import * as hljs from 'highlight.js';
import { IMock, IOhMyMock, IState } from 'src/app/store/type';
import { STORAGE_KEY } from 'src/app/types';

@Component({
  selector: 'app-mock',
  templateUrl: './mock.component.html',
  styleUrls: ['./mock.component.scss']
})
export class MockComponent implements OnInit, AfterViewInit {
  mock: IMock;

  customResponse: string;
  originalResponse: string;
  jsonError: string;

  @ViewChild('responseMock') responseMock: ElementRef;
  @ViewChild('responseOrig') responseOrig: ElementRef;

  constructor(private activeRoute: ActivatedRoute, private store: Store,
    private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    const mockId = decodeURIComponent(this.activeRoute.snapshot.params.id);

    this.mock = this.store.selectSnapshot<IMock>((state: IOhMyMock) => {
      return state[STORAGE_KEY].urls[mockId];
    });
    this.originalResponse = JSON.stringify(this.mock.payload, null, 4);
    this.store.select(state => state[STORAGE_KEY].urls[mockId])
      .subscribe((mock: IMock) => {
        debugger;
      });

  }

  ngAfterViewInit(): void {
    hljs.highlightBlock(this.responseMock.nativeElement.querySelector('code'));
    hljs.highlightBlock(this.responseOrig.nativeElement);
  }

  copyResponse(source?) {
    this.customResponse = source || this.mock.payload;

    const codeEl = document.createElement('code');
    codeEl.innerText = JSON.stringify(this.customResponse, null, 4);
    this.responseMock.nativeElement.innerHTML = '';
    this.responseMock.nativeElement.appendChild(codeEl);
    hljs.highlightBlock(codeEl);

    if (!source) {
      this.jsonError = null;
    }

    // this.cdr.detectChanges();
  }

  onMockBlur(): void {
    try {
      this.copyResponse(JSON.parse(this.responseMock.nativeElement.innerText));
    } catch (e) {
      this.jsonError = e;
    }
  }

}
