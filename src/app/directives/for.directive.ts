import { Directive, EmbeddedViewRef, Input, OnChanges, TemplateRef, ViewContainerRef } from '@angular/core';

// https://medium.com/angularwave/non-binary-ngif-cfdf7c474852

@Directive({
  selector: '[ngFor][ngForOf][ngForEmpty]'
})
export class OhMyForDirective implements OnChanges {
  @Input() ngForOf = [];
  @Input() ngForEmpty!: TemplateRef<unknown>;

  private ref?: EmbeddedViewRef<unknown>;

  constructor(private readonly vcr: ViewContainerRef) {}

  ngOnChanges() {
    this.ref?.destroy();

    if (this.ngForOf?.length === 0) {
      this.ref = this.vcr.createEmbeddedView(this.ngForEmpty);
    }
  }
}
