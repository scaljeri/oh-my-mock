import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IOhMyResponse, IOhMyShallowResponse, IOhMyStatusCode } from '@shared/types';

@Component({
  selector: 'oh-my-mock-label',
  templateUrl: './mock-label.component.html',
  styleUrls: ['./mock-label.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MockLabelComponent {
  @Input() mock: IOhMyShallowResponse | IOhMyResponse;

  get code(): IOhMyStatusCode {
    return this.mock?.statusCode;
  }

  get label(): string {
    return this.mock?.label;
  }
}
