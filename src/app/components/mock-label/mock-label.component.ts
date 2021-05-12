import { Component, Input } from '@angular/core';
import { IMock, statusCode } from '../../../shared/type';

@Component({
  selector: 'oh-my-mock-label',
  templateUrl: './mock-label.component.html',
  styleUrls: ['./mock-label.component.scss']
})
export class MockLabelComponent {
  @Input() mock: IMock;

  get code(): statusCode {
    return this.mock.statusCode;
  }

  get name(): string {
    return this.mock.name;
  }
}
