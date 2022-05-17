import { Component } from '@angular/core';

@Component({
  selector: 'oh-my-connection-failure',
  templateUrl: './connection-failure.component.html',
  styleUrls: ['./connection-failure.component.scss']
})
export class ConnectionFailureComponent {

  onAction() {
    window.location.reload();
  }
}
