import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IData } from '@shared/type';
import { NgApiMockApiService } from '../ng-api-mock-api.service';
@Component({
  selector: 'app-store-mock',
  templateUrl: './store-mock.component.html',
  styleUrls: ['./store-mock.component.scss']
})
export class StoreMockComponent implements OnInit {
  @Input() mockData: IData;
  @Output() done = new EventEmitter<boolean>();

  public storeMockForm: UntypedFormGroup;
  constructor(
    private ngApiMockApiService: NgApiMockApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.storeMockForm = new UntypedFormGroup({
      url: new UntypedFormControl(this.mockData.url, [Validators.required]),
      name: new UntypedFormControl(this.nameSuggestionFromMockURL(this.mockData.url))
    });
  }

  storeMock(): void {
    if (this.storeMockForm.valid) {
      const mockCopy = { ...this.mockData };
      mockCopy.url = this.storeMockForm.value.url;
      this.ngApiMockApiService
        .postNewMock(mockCopy, this.storeMockForm.value.name)
        .then(() => {
          this.snackBar.open('Succes!', 'Store mock', {
            verticalPosition: 'top'
          });
          this.done.emit(true);
        })
        .catch(() => {
          this.snackBar.open('Failed to store mock', 'Store mock', {
            verticalPosition: 'top'
          });
          this.done.emit(true);
        });
    }
  }

  private nameSuggestionFromMockURL(url: string): string {
    return /[^/]*$/.exec(url)[0];
  }
}
