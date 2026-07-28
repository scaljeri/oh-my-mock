import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToggleComponent } from './toggle.component';

describe('ToggleComponent', () => {
  let component: ToggleComponent;
  let fixture: ComponentFixture<ToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ToggleComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('asks for the opposite of what it shows', () => {
    const emitted: boolean[] = [];
    component.toggled.subscribe(v => emitted.push(v));

    component.checked = false;
    component.onClick(new MouseEvent('click'));

    component.checked = true;
    component.onClick(new MouseEvent('click'));

    expect(emitted).toEqual([true, false]);
  });

  // The switch sits inside a row that opens the cookie when clicked.
  it('keeps the click away from the row underneath', () => {
    const event = new MouseEvent('click');
    const stop = jest.spyOn(event, 'stopPropagation');

    component.onClick(event);

    expect(stop).toHaveBeenCalled();
  });

  it('emits nothing while disabled', () => {
    const emitted: boolean[] = [];
    component.toggled.subscribe(v => emitted.push(v));
    component.disabled = true;

    component.onClick(new MouseEvent('click'));

    expect(emitted).toEqual([]);
  });

  it('tells assistive technology what it is', () => {
    // Through `setInput`, not by assigning the field: the component is OnPush,
    // so a field written from outside never marks the view for check.
    fixture.componentRef.setInput('checked', true);
    fixture.componentRef.setInput('label', 'Mock session_id');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector('button');

    if (!button) {
      throw new Error('The switch did not render');
    }

    expect(button.getAttribute('role')).toBe('switch');
    expect(button.getAttribute('aria-checked')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Mock session_id');
  });
});
