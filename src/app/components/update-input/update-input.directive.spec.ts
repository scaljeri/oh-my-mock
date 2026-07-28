import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { UpdateInputDirective } from './update-input.directive';

/**
 * The directive is exercised on a real host rather than constructed by hand.
 *
 * It used to be `new UpdateInputDirective(null as never, null as never, null as
 * never)`, which asserted only that a constructor exists — and stopped
 * compiling the moment its dependencies moved to `inject()`, since that needs
 * an injection context. A host element gives it the `ElementRef`, the
 * `NgControl` and the `ohMyUpdateInput` attribute it actually reads.
 */
@Component({
  standalone: false,
  template: `<input ohMyUpdateInput="value" [(ngModel)]="value" />`
})
class HostComponent {
  value = 'initial';
}

describe('UpdateInputDirective', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UpdateInputDirective, HostComponent],
      imports: [FormsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('attaches to an input that carries the attribute', () => {
    const el = fixture.debugElement.query(By.directive(UpdateInputDirective));

    expect(el).toBeTruthy();
    expect(el.injector.get(UpdateInputDirective))
      .toBeInstanceOf(UpdateInputDirective);
  });
});
