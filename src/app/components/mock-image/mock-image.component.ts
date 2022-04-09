import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'oh-my-mock-image',
  templateUrl: './mock-image.component.html',
  styleUrls: ['./mock-image.component.scss']
})
export class MockImageComponent implements OnInit {
  @Input() contentType: string;
  @Input() src: string;

  b64Src: string;

  constructor() { }

  ngOnInit(): void {
    this.b64Src = `data:${this.contentType};base64,${this.src}`;
  }

}
