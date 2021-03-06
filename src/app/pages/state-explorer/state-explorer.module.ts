import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateExplorerComponent } from './state-explorer.component';



@NgModule({
  declarations: [StateExplorerComponent],
  imports: [
    CommonModule
  ],
  exports: [StateExplorerComponent]
})
export class StateExplorerModule { }
