import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AnimatedListDirective } from './animated-list.directive';

/**
 * Exercised on a real host rather than constructed by hand.
 *
 * It used to be `new AnimatedListDirective({} as any, {} as any)`, which
 * asserted only that a constructor exists — and stopped compiling once its
 * dependencies moved to `inject()`, which needs an injection context. A host
 * gives it the real `ElementRef` and `DomSanitizer`.
 */
@Component({
  standalone: false,
  template: `<ul ohMyAnimatedList>
    <li>one</li>
    <li>two</li>
  </ul>`
})
class HostComponent {}

describe('AnimatedListDirective', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AnimatedListDirective, HostComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('attaches to the list that carries the attribute', () => {
    const el = fixture.debugElement.query(By.directive(AnimatedListDirective));

    expect(el).toBeTruthy();
    expect(el.injector.get(AnimatedListDirective))
      .toBeInstanceOf(AnimatedListDirective);
  });
});
