import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IMock, IOhMyShallowMock, ohMyStatusCode } from '@shared/types/mock';

@Component({
  selector: 'oh-my-mock-label',
  templateUrl: './mock-label.component.html',
  styleUrls: ['./mock-label.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MockLabelComponent {
  @Input() mock!: IOhMyShallowMock | IMock;

  get code(): ohMyStatusCode {
    return this.mock?.statusCode;
  }

  get label(): string {
    return this.mock?.label ?? '';
  }
}
