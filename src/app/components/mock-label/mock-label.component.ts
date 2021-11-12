import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IMock, IOhMyShallowMock, IState, IStore, statusCode } from '@shared/type';

@Component({
  selector: 'oh-my-mock-label',
  templateUrl: './mock-label.component.html',
  styleUrls: ['./mock-label.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MockLabelComponent {
  @Input() mock: IOhMyShallowMock | IMock;

  get code(): statusCode {
    return this.mock?.statusCode;
  }

  get label(): string {
    return this.mock?.label;
  }
}
