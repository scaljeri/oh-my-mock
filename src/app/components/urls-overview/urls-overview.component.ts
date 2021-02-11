import { Component, OnInit } from '@angular/core';
import { Select } from '@ngxs/store';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { OhMyState } from 'src/app/store/state';
import { IResponses, IState } from 'src/app/store/type';
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

	displayedColumns = ['type', 'url', 'method'];

	responses: IResponses[] = [];

	constructor() {
	}

	ngOnInit(): void {
		this.state$.pipe(
			filter(state => !!state && !!state[STORAGE_KEY].responses),
			map(state => state[STORAGE_KEY].responses)
		).subscribe((responses: IResponses[]) => {
			this.responses = responses;
		});
	}

}
