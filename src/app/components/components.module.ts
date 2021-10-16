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
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import {
  Location,
  LocationStrategy,
  PathLocationStrategy
} from '@angular/common';

import { CodeEditComponent } from './form/code-edit/code-edit.component';
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
import { ArrowComponent } from './arrow/arrow.component';
import { MockLabelComponent } from './mock-label/mock-label.component';
import { MockDetailsComponent } from './mock/mock-details/mock-details.component';
import { CloudSyncComponent } from './cloud-sync/cloud-sync.component';
import { UpdateInputDirective } from './update-input/update-input.directive';
import { ContentTypeComponent } from './form/content-type/content-type.component';
import { SpinnerComponent } from './spinner/spinner.component';
import {MatCheckboxModule} from '@angular/material/checkbox';
import { AutocompleteDropdownComponent } from './form/autocomplete-dropdown/autocomplete-dropdown.component';
import { ManageScenariosComponent } from './manage-presets/manage-scenarios.component';

import { OhMyDirectivesModule } from '../directives/directives.module';
import { LinkComponent } from './link/link.component';
import { DialogCodeEditorComponent } from './dialog/code-editor/code-editor.component';

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
    AnonymizeComponent,
    ArrowComponent,
    MockLabelComponent,
    MockDetailsComponent,
    CloudSyncComponent,
    UpdateInputDirective,
    ContentTypeComponent,
    SpinnerComponent,
    AutocompleteDropdownComponent,
    ManageScenariosComponent,
    LinkComponent,
    DialogCodeEditorComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild([]),
    MatTableModule,
    MatIconModule,
    PipesModule,
    RouterModule,
    OhMyDirectivesModule,
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
    MatSelectModule,
    MatAutocompleteModule,
    MatCheckboxModule
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
    AnimatedListDirective,
    ArrowComponent,
    MockLabelComponent,
    CloudSyncComponent,
    UpdateInputDirective,
    ContentTypeComponent,
    SpinnerComponent,
    AutocompleteDropdownComponent,
    LinkComponent,
    DialogCodeEditorComponent,
  ],
  providers: [
    Location,
    { provide: LocationStrategy, useClass: PathLocationStrategy }]
})
export class ComponentsModule { }
