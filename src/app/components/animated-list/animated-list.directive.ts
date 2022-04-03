import { ContentChildren, Directive, ElementRef, HostBinding, Input, QueryList } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';

interface IMeta {
  offset: number;
  height: number;
}

@Directive({
  selector: '[ohMyAnimatedList]'
})
export class AnimatedListDirective {
  @Input() @HostBinding('class.animated-list') ohMyAnimatedList: number[];

  @ContentChildren('animatedRow', { read: ElementRef }) rowRefs: QueryList<ElementRef>;

  @HostBinding("attr.style")
  public get valueAsStyle(): SafeStyle {
    const duration = this.ohMyAnimatedList ? this.duration : '0';
    return this.sanitizer.bypassSecurityTrustStyle(`--animation-duration: ${duration}`);
  }

  private meta: IMeta[];
  private duration = '0.8s';

  constructor(private element: ElementRef, private sanitizer: DomSanitizer) {
  }

  ngOnChanges(): void {
    setTimeout(() => {
      this.meta = null;
      this.calcAndSetTransforms();
      setTimeout(() => this.duration = '0.8s');
    });
  }

  ngAfterViewInit(): void {
    this.rowRefs.changes.subscribe(() => {
      this.meta = null;
      this.calcAndSetTransforms();
      this.duration = '0s';
      setTimeout(() => this.duration = '0.8s');
    });

    this.calcAndSetTransforms();
  }

  private calcAndSetTransforms(): void {
    if (!this.ohMyAnimatedList || !this.rowRefs || !this.rowRefs.length) {
      return; // No elements in the list
    }

    let offset = 0;
    this.ohMyAnimatedList.forEach(itemIndex => {
      const meta = this.getMeta(itemIndex);

      // IF needed because filtering makes this a bit weird
      if (this.rowRefs.get(itemIndex)) {
        this.rowRefs.get(itemIndex).nativeElement.style.transform = `translateY(${offset - meta.offset}px)`;
        offset += meta.height;
      }
    });
  }

  private determineMeta(): void {
    let offset = 0;

    this.meta = [...this.rowRefs.toArray()].map(item => {
      const height = item.nativeElement.offsetHeight;
      const out = { offset, height: item.nativeElement.offsetHeight };
      offset += height;

      return out;
    });
  }

  private getMeta(index: number): IMeta {
    if (!this.meta) {
      this.determineMeta();
    }

    return this.meta[index];
  }
}
