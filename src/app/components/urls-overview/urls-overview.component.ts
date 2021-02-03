import { Component, OnInit } from '@angular/core';
import { Select } from '@ngxs/store';
import { Observable } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { OhMyState } from 'src/app/store/state';
import { IMock, IState } from 'src/app/store/type';
import { STORAGE_KEY } from 'src/app/types';

export interface PeriodicElement {
	name: string;
	position: number;
	weight: number;
	symbol: string;
}

@Component({
	selector: 'app-urls-overview',
	templateUrl: './urls-overview.component.html',
	styleUrls: ['./urls-overview.component.scss']
})
export class UrlsOverviewComponent implements OnInit {
	// @Select(OhMyState.getState) state$: Observable<{ OhMyState: IState }>;
	@Select(OhMyState.getState) state$: Observable<{ [STORAGE_KEY]: IState }>;

	displayedColumns: string[] = ['type', 'url', 'active'];

	mocks: IMock[];

	constructor() {
	}

	ngOnInit(): void {
		this.state$.pipe(
			filter(state => !!state && !!state[STORAGE_KEY].urls),
			tap(s => console.log('state=', s)),
			map(state => Object.values(state[STORAGE_KEY].urls).sort((a, b) => a > b ? 1 : -1))
		).subscribe(mocks => {
			console.log('mocks are', mocks);
			this.mocks = mocks;
		});
	}

}
