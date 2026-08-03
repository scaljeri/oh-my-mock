import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { IOhMyResponseCookie } from '@shared/type';
import { ResponseCookiesComponent } from './response-cookies.component';

describe('ResponseCookiesComponent', () => {
  let component: ResponseCookiesComponent;
  let fixture: ComponentFixture<ResponseCookiesComponent>;
  let closedWith: (IOhMyResponseCookie[] | undefined)[];
  let stored: IOhMyResponseCookie[];

  const rows = (): HTMLElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll(
        '[x-test="cookie-row"]'
      ) as NodeListOf<HTMLElement>
    );

  async function create(cookies: IOhMyResponseCookie[]): Promise<void> {
    stored = cookies;
    closedWith = [];

    await TestBed.configureTestingModule({
      imports: [FormsModule, ResponseCookiesComponent],
      providers: [
        {
          provide: MatDialogRef,
          useValue: {
            close: (value: IOhMyResponseCookie[] | undefined) =>
              closedWith.push(value)
          }
        },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { cookies: stored, statusCode: 200 }
        }
      ],
      schemas: [NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(ResponseCookiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows a row per cookie the response sets', async () => {
    await create([
      { name: 'session', value: 'abc' },
      { name: 'theme', value: 'dark' }
    ]);

    expect(rows()).toHaveLength(2);
    expect(component.cookies.map((c) => c.name)).toEqual(['session', 'theme']);
  });

  it('says so when the response sets none', async () => {
    await create([]);

    expect(rows()).toHaveLength(0);
    expect(
      fixture.nativeElement.querySelector('[x-test="no-cookies"]')
    ).toBeTruthy();
  });

  /**
   * The dialog edits a copy. Cancelling has to leave the stored response
   * exactly as it was, and mutating the array it was handed would have changed
   * it before anyone pressed anything.
   */
  it('does not touch what it was given until it is saved', async () => {
    await create([{ name: 'session', value: 'abc' }]);

    component.cookies[0].value = 'edited';
    component.onAdd();
    component.onCancel();

    expect(stored).toEqual([{ name: 'session', value: 'abc' }]);
    expect(closedWith).toEqual([undefined]);
  });

  it('saves what was typed', async () => {
    await create([{ name: 'session', value: 'abc' }]);

    component.cookies[0].value = 'edited';
    component.onSave();

    expect(closedWith[0]).toEqual([{ name: 'session', value: 'edited' }]);
  });

  it('adds and removes rows', async () => {
    await create([{ name: 'session', value: 'abc' }]);

    component.onAdd();
    fixture.detectChanges();
    expect(rows()).toHaveLength(2);

    component.onRemove(0);
    fixture.detectChanges();
    expect(rows()).toHaveLength(1);
    expect(component.cookies[0].name).toBe('');
  });

  /**
   * A row with no name is a row somebody added and then thought better of.
   * Dropping it beats rejecting the save: leaving an empty row behind is how
   * people stop typing, not an error to be corrected.
   */
  it('drops a row that was never filled in', async () => {
    await create([{ name: 'session', value: 'abc' }]);

    component.onAdd();
    component.onSave();

    expect(closedWith[0]).toEqual([{ name: 'session', value: 'abc' }]);
  });

  it('trims the name, which is what the jar keys on', async () => {
    await create([{ name: '  session  ', value: 'abc' }]);

    component.onSave();

    expect(closedWith[0]).toEqual([{ name: 'session', value: 'abc' }]);
  });

  it('saves an empty list when the last row is removed', async () => {
    await create([{ name: 'session', value: 'abc' }]);

    component.onRemove(0);
    component.onSave();

    expect(closedWith[0]).toEqual([]);
  });
});
