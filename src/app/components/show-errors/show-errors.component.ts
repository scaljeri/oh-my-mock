import { Component, Inject, OnInit, Optional } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { githubIssueUrl } from '@shared/constants';
import { IPacketPayload } from '@shared/packet-type';

@Component({
  selector: 'oh-my-show-errors',
  templateUrl: './show-errors.component.html',
  styleUrls: ['./show-errors.component.scss']
})
export class ShowErrorsComponent implements OnInit {
  url = githubIssueUrl;
  ctrl: FormControl;

  constructor(@Optional() @Inject(MAT_DIALOG_DATA) public errors: IPacketPayload[]) { }

  ngOnInit(): void {
    this.errors = this.errors.map((e: any) => {
      e.data.errors = e.data.errors.map((s: string) => {
        return s.split('\\n');
      });
      return e;
    });

    this.ctrl = new FormControl(this.errors);
  }

}
