import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutocompleteDropdownComponent } from './autocomplete-dropdown.component';

describe('AutocompleteDropdownComponent', () => {
  let component: AutocompleteDropdownComponent;
  let fixture: ComponentFixture<AutocompleteDropdownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AutocompleteDropdownComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AutocompleteDropdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
