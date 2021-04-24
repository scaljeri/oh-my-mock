import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { ConfigComponent } from './config/config.component';
import { DataListComponent } from './data-list/data-list.component';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { PipesModule } from '../pipes/pipes.module';
import { RouterModule } from '@angular/router';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';

import {
  Location,
  LocationStrategy,
  PathLocationStrategy
} from '@angular/common';

import { CodeEditComponent } from './code-edit/code-edit.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MonacoEditorModule } from '@materia-ui/ngx-monaco-editor';
import { CreateStatusCodeComponent } from './create-status-code/create-status-code.component';
import { AddDataComponent } from './add-data/add-data.component';
import { NavListComponent } from './nav-list/nav-list.component';
import { ResetStateComponent } from './reset-state/reset-state.component';
import { DisabledEnabledComponent } from './disabled-enabled/disabled-enabled.component';
import { HeaderButtonComponent } from './header-button/header-button.component';
import { MockComponent } from './mock/mock.component';
import { MockHeaderComponent } from './mock/mock-header/mock-header.component';
import { JsonImportComponent } from './json-import/json-import.component';
import { FileUploaderComponent } from './file-uploader/file-uploader.component';
import { FileDragDropDirective } from './file-uploader/file-drag-drop.directive';
import { CodeErrorsComponent } from './code-errors/code-errors.component';
import { AnimatedListDirective } from './animated-list/animated-list.directive';
import { AnonymizeComponent } from './anonymize/anonymize.component';

@NgModule({
  declarations: [
    ConfigComponent,
    DataListComponent,
    CodeEditComponent,
    CreateStatusCodeComponent,
    AddDataComponent,
    NavListComponent,
    ResetStateComponent,
    DisabledEnabledComponent,
    HeaderButtonComponent,
    MockComponent,
    MockHeaderComponent,
    JsonImportComponent,
    FileUploaderComponent,
    FileDragDropDirective,
    CodeErrorsComponent,
    AnimatedListDirective,
    AnonymizeComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild([]),
    MatTableModule,
    MatIconModule,
    PipesModule,
    RouterModule,
    MatFormFieldModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatExpansionModule,
    MatDialogModule,
    MatTabsModule,
    ReactiveFormsModule,
    FormsModule,
    MonacoEditorModule,
    DragDropModule,
  ],
  exports: [
    DataListComponent,
    ConfigComponent,
    CodeEditComponent,
    NavListComponent,
    DisabledEnabledComponent,
    HeaderButtonComponent,
    MockComponent,
    MockHeaderComponent,
    FileUploaderComponent,
    AnimatedListDirective
  ],
  providers: [
    Location,
    { provide: LocationStrategy, useClass: PathLocationStrategy }]
})
export class ComponentsModule { }
