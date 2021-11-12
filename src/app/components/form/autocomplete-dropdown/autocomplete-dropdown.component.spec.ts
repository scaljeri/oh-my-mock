import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControlDirective, FormsModule, NgControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { AutocompleteDropdownComponent } from './autocomplete-dropdown.component';

describe('AutocompleteDropdownComponent', () => {
  let component: AutocompleteDropdownComponent;
  let fixture: ComponentFixture<AutocompleteDropdownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AutocompleteDropdownComponent ],
      imports: [ FormsModule,  MatAutocompleteModule, ReactiveFormsModule],
      providers: [{provide: NgControl, useValue: {}}],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(AutocompleteDropdownComponent, {
      set: {
        providers: [
          {
            provide: NgControl,
            useValue: new FormControlDirective([], [], null, null)
          }
       ]
     }
  });



    // .overrideProvider(NgControl, { useValue: {} })
    // .compileComponents();

  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AutocompleteDropdownComponent);
    component = fixture.componentInstance;
    // component.ngControl = new FormControl() as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
