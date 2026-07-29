import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
  Location,
  LocationStrategy,
  PathLocationStrategy
} from '@angular/common';

import { CodeEditComponent } from './form/code-edit/code-edit.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { CreateStatusCodeComponent } from './create-response/create-status-code.component';
import { AddDataComponent } from './add-data/add-data.component';
import { NavListComponent } from './nav-list/nav-list.component';
import { DomainSidebarComponent } from './domain-sidebar/domain-sidebar.component';
import { ResetStateComponent } from './reset-state/reset-state.component';
import { DisabledEnabledComponent } from './disabled-enabled/disabled-enabled.component';
import { RequestComponent } from './request/request.component';
import { RequestHeaderComponent } from './request/request-header/request-header.component';
import { JsonImportComponent } from './json-import/json-import.component';
import { HarImportComponent } from './har-import/har-import.component';
import { FileUploaderComponent } from './file-uploader/file-uploader.component';
import { FileDragDropDirective } from './file-uploader/file-drag-drop.directive';
import { CodeErrorsComponent } from './code-errors/code-errors.component';
import { AnimatedListDirective } from './animated-list/animated-list.directive';
import { AnonymizeComponent } from './anonymize/anonymize.component';
import { ArrowComponent } from './arrow/arrow.component';
import { MockLabelComponent } from './mock-label/mock-label.component';
import { MockDetailsComponent } from './request/mock-details/mock-details.component';
import { CloudSyncComponent } from './cloud-sync/cloud-sync.component';
import { UpdateInputDirective } from './update-input/update-input.directive';
import { SpinnerComponent } from './spinner/spinner.component';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { AutocompleteDropdownComponent } from './form/autocomplete-dropdown/autocomplete-dropdown.component';

import { DialogCodeEditorComponent } from './dialog/code-editor/code-editor.component';
import { PresetComponent } from './preset/preset.component';
import { FeedbackComponent } from './feedback/feedback.component';
import { ShowErrorsComponent } from './show-errors/show-errors.component';
import { MockImageComponent } from './mock-image/mock-image.component';
import { RequestFilterComponent } from './request-filter/request-filter.component';
import { ConnectionFailureComponent } from './connection-failure/connection-failure.component';
import { OnOffSwitchComponent } from './on-off-switch/on-off-switch.component';
import { ToggleComponent } from './toggle/toggle.component';
import { TabNavComponent } from './tab-nav/tab-nav.component';
import { CookieListComponent } from './cookie-list/cookie-list.component';
import { CookieDetailComponent } from './cookie-detail/cookie-detail.component';

@NgModule({
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
    // Configured once, in `app.module.ts` — a `forRoot()` here would be
    // overridden by the root module's `provideMonacoEditor()` anyway.
    MonacoEditorModule,
    DragDropModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatCheckboxModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    DataListComponent,
    CodeEditComponent,
    CreateStatusCodeComponent,
    AddDataComponent,
    NavListComponent,
    DomainSidebarComponent,
    ResetStateComponent,
    DisabledEnabledComponent,
    RequestComponent,
    RequestHeaderComponent,
    JsonImportComponent,
    HarImportComponent,
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
    SpinnerComponent,
    AutocompleteDropdownComponent,
    DialogCodeEditorComponent,
    PresetComponent,
    FeedbackComponent,
    ShowErrorsComponent,
    MockImageComponent,
    RequestFilterComponent,
    ConnectionFailureComponent,
    OnOffSwitchComponent,
    ToggleComponent,
    TabNavComponent,
    CookieListComponent,
    CookieDetailComponent
  ],
  exports: [
    DataListComponent,
    CodeEditComponent,
    NavListComponent,
    DomainSidebarComponent,
    DisabledEnabledComponent,
    RequestComponent,
    RequestHeaderComponent,
    FileUploaderComponent,
    HarImportComponent,
    AnimatedListDirective,
    ArrowComponent,
    MockLabelComponent,
    CloudSyncComponent,
    UpdateInputDirective,
    SpinnerComponent,
    AutocompleteDropdownComponent,
    DialogCodeEditorComponent,
    FeedbackComponent,
    MockImageComponent,
    ConnectionFailureComponent,
    OnOffSwitchComponent,
    ToggleComponent,
    TabNavComponent,
    // Exported because the Cookies tab is a lazy module of its own: its
    // toolbar shows the same preset selector as the request list's.
    PresetComponent,
    CookieListComponent,
    CookieDetailComponent
  ],
  providers: [
    Location,
    { provide: LocationStrategy, useClass: PathLocationStrategy }
  ]
})
export class ComponentsModule {}
