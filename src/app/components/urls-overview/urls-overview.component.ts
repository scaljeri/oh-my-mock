import { Component, OnInit } from '@angular/core';
import { Select } from '@ngxs/store';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { OhMyState } from 'src/app/store/state';
import { IData, IState } from 'src/shared/type';
import { STORAGE_KEY } from 'src/shared/constants';

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

	displayedColumns = ['type', 'url', 'method', 'activeStatusCode'];

	data: IData[] = [];

	constructor() {
	}

	ngOnInit(): void {
		this.state$.pipe(
			filter(state => !!state && !!state[STORAGE_KEY].data),
			map(state => state[STORAGE_KEY].data)
		).subscribe((data: IData[]) => {
			this.data = data;
		});
	}

}
