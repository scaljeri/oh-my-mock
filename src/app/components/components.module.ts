import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigComponent } from './config/config.component';
import { RouterModule, Routes } from '@angular/router';


const routes: Routes = [{
  path: 'configure', component: ConfigComponent
}]

@NgModule({
  declarations: [ConfigComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ]
})
export class ComponentsModule { }
