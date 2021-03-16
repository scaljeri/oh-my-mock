import { Component, EventEmitter, Output } from '@angular/core';
import { Location } from '@angular/common';
import {
  ActivationEnd,
  Event as NavigationEvent,
  Router
} from '@angular/router';

@Component({
  selector: 'app-header-button',
  templateUrl: './header-button.component.html',
  styleUrls: ['./header-button.component.scss']
})
export class HeaderButtonComponent {
  @Output() menu = new EventEmitter<void>();

  public isMenu = true;

  constructor(private router: Router, private location: Location) {
    router.events.subscribe((event: NavigationEvent) => {
      if (event instanceof ActivationEnd) {
        this.isMenu = this.location.path() === '';
      }
    });
  }

  onGoBack(): void {
    this.location.back();
  }

  onOpenMenu(): void {
    this.menu.emit();
  }
}
