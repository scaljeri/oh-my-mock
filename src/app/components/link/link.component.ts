import { Component, Input } from '@angular/core';
// import { Url } from 'url';

@Component({
  selector: 'oh-my-link',
  templateUrl: './link.component.html',
  styleUrls: ['./link.component.scss']
})
export class LinkComponent {
  @Input() text: string;
  // @Input() url: Url;

  ctx: any;

  ngOnInit(): void {
    // this.ctx = { text: this.text, url: this.url };
  }
}
