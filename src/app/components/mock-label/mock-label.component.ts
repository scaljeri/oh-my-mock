import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Store } from '@ngxs/store';
import { STORAGE_KEY } from '@shared/constants';
import { IMock, IOhMyShallowMock, IState, IStore, statusCode } from '@shared/type';
import { OhMyState } from 'src/app/store/state';

@Component({
  selector: 'oh-my-mock-label',
  templateUrl: './mock-label.component.html',
  styleUrls: ['./mock-label.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MockLabelComponent {
  @Input() mock: IOhMyShallowMock | IMock;
  @Input() state: IState;

  scenarioName: string;

  constructor(private store: Store) {}

  ngOnChanges(): void {
    this.scenarioName = this.state.scenarios[this.mock.scenario];
  }

  get code(): statusCode {
    return this.mock?.statusCode;
  }

  get scenario(): string {
    return this.mock?.scenario;
  }

  // get stateSnapshot(): IState {
  //   return this.store.selectSnapshot<IState>((state: IStore) => {
  //     return state[STORAGE_KEY].content.states[OhMyState.domain];
  //   });
  // }
}
