import { ChangeDetectionStrategy, ChangeDetectorRef, Component, forwardRef, Input, OnChanges, OnDestroy } from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALIDATORS, NG_VALUE_ACCESSOR, Validators } from '@angular/forms';
import { Store } from '@ngxs/store'
import { IOhMyScenarios, IStore, ohMyScenarioId } from '@shared/type';
import { STORAGE_KEY } from '@shared/constants';
import { OhMyState } from 'src/app/store/state'
import { Observable, Subscription } from 'rxjs';
import { exactOptionMatchValidator } from 'src/app/validators/exact-match-validator';

@Component({
  selector: 'oh-my-scenario-dropdown',
  templateUrl: './scenario-dropdown.component.html',
  styleUrls: ['./scenario-dropdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ScenarioDropdownComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: ScenarioDropdownComponent,
      multi: true
    }
  ]
})
export class ScenarioDropdownComponent implements OnChanges, OnDestroy, ControlValueAccessor {
  @Input() domain: string = OhMyState.domain;
  @Input() scenarios: IOhMyScenarios;

  subscriptions = new Subscription();

  options: string[]
  ctrl = new FormControl(null, { updateOn: 'blur' });
  scenariosUpdate$: Observable<IOhMyScenarios>;
  stateScenarios: IOhMyScenarios;
  value: string = undefined;

  constructor(private store: Store, private cdr: ChangeDetectorRef) {
    this.scenariosUpdate$ = this.store.select<IOhMyScenarios>((store: IStore) => {
      return store[STORAGE_KEY].content.states[this.domain]?.presets;
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(this.scenariosUpdate$.subscribe(scenarios => {
      this.stateScenarios = scenarios;
      this.ngOnChanges();
      this.cdr.detectChanges();
    }));

    if (!this.options) {
      this.ngOnChanges();
    }
  }

  ngAfterViewInit(): void {
    this.ctrl.valueChanges.subscribe(val => {
      if (!this.ctrl.errors) {
        const id = this.findScenarioIdByLabel(val);

        if (this.value !== id) {
          this.onChange(id);
          this.onTouch(id);
          this.value = id;
        }
      }
    });
  }

  ngOnChanges(): void {
    this.options = Object.values(this.scenarios || this.stateScenarios);
    this.ctrl.setValidators(exactOptionMatchValidator(this.options));
    this.ctrl.setValue(this.getScenarioLabel(this.value), { emitEvent: false });
  }

  private getScenarioLabel(id: ohMyScenarioId): string {
    return (this.scenarios || this.stateScenarios)[id];
  }

  private findScenarioIdByLabel(label: string): ohMyScenarioId {
    const list = this.scenarios || this.stateScenarios;
    return Object.keys(list).find(k => list[k] === label);
  }

  onChange: any = () => { }
  onTouch: any = () => { }

  writeValue(id: ohMyScenarioId): void {
    this.value = id;
    this.ctrl.setValue(this.getScenarioLabel(id), { emitEvent: false });
  }

  registerOnChange(fn: any) {
    this.onChange = fn
  }

  registerOnTouched(fn: any) {
    this.onTouch = fn
  }

  setDisabledState?(isDisabled: boolean): void {
    // throw new Error('Method not implemented.');
  }

  validate({ value }: FormControl) {
  }

  // get scenariosSnapshot(): IOhMyScenarios {
  //   return this.store.selectSnapshot<IOhMyScenarios>((state: IStore) => {
  //     return state[STORAGE_KEY].content.states[this.domain || OhMyState.domain]?.scenarios;
  //   });
  // }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
