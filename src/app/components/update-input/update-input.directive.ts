import { Attribute, Directive, ElementRef, Input } from '@angular/core';
import { FormControlDirective, NgControl } from '@angular/forms';

/**
 * In case data gets updated while typing, the data flows again through the application
 * and updates the view. In those cases it is important that the input with focus is
 * not updated otherwise you will loose focus or the cursor position. This Directive
 * makes sure that the element with focus will not be updated
 * */

@Directive({
  selector: '[ohMyUpdateInput]'
})
export class UpdateInputDirective {
  @Input('ohMyUpdateInput') input: string;

  private canUpdate = () => !this.isActive();
  private selector: string;

  constructor(
    private element: ElementRef,
    private control: NgControl,
    @Attribute('class') private cls: string) { }

  ngOnInit(): void {
    const elName = this.element.nativeElement.tagName.toLowerCase();

    if (!['input', 'textarea'].includes(elName)) {
      this.selector = this.cls ? '.' + this.cls?.replace(/\s/g, '.') :
        this.element.nativeElement.tagName.toLowerCase();
      this.canUpdate = () => !this.isChildActive();
    }
  }

  ngOnChanges(): void {
    if (this.canUpdate()) {
      setTimeout(() => (this.control as FormControlDirective).form.setValue(this.input));
    }
  }

  isActive(): boolean {
    return document.activeElement === this.element.nativeElement;
  }

  isChildActive(): boolean {
    return !!document.activeElement.closest(this.selector);
  }
}
