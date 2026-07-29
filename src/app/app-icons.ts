import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * Relative to the document, not absolute.
 *
 * The popup lives at `<extension>/oh-my-mock/index.html`, so a relative path
 * resolves to `/oh-my-mock/assets/…` there — the same place the hard-coded
 * absolute path used to point at. It also resolves under `ng serve`, where the
 * app is served from the root and every icon used to 404. `MONACO_BASE_URL`
 * already does it this way.
 */
const BASE_URL = './assets/icons/material/';

export function registerIcons(matIconRegistry: MatIconRegistry, domSanitizer: DomSanitizer,) {
  matIconRegistry.addSvgIcon('search', domSanitizer.bypassSecurityTrustResourceUrl(url('search')));
  matIconRegistry.addSvgIcon('menu', domSanitizer.bypassSecurityTrustResourceUrl(url('menu')));
  matIconRegistry.addSvgIcon('close', domSanitizer.bypassSecurityTrustResourceUrl(url('close')));
  matIconRegistry.addSvgIcon('more_vert', domSanitizer.bypassSecurityTrustResourceUrl(url('more_vert')));
  matIconRegistry.addSvgIcon('add', domSanitizer.bypassSecurityTrustResourceUrl(url('add')));
  matIconRegistry.addSvgIcon('info', domSanitizer.bypassSecurityTrustResourceUrl(url('info')));
  matIconRegistry.addSvgIcon('delete_forever', domSanitizer.bypassSecurityTrustResourceUrl(url('delete_forever')));
  matIconRegistry.addSvgIcon('delete', domSanitizer.bypassSecurityTrustResourceUrl(url('delete')));
  matIconRegistry.addSvgIcon('content_copy', domSanitizer.bypassSecurityTrustResourceUrl(url('content_copy')));
  matIconRegistry.addSvgIcon('play_arrow', domSanitizer.bypassSecurityTrustResourceUrl(url('play_arrow')));
  matIconRegistry.addSvgIcon('import_export', domSanitizer.bypassSecurityTrustResourceUrl(url('import_export')));
  matIconRegistry.addSvgIcon('keyboard_arrow_left', domSanitizer.bypassSecurityTrustResourceUrl(url('keyboard_arrow_left')));
  matIconRegistry.addSvgIcon('copy_all', domSanitizer.bypassSecurityTrustResourceUrl(url('copy_all')));
  matIconRegistry.addSvgIcon('fullscreen', domSanitizer.bypassSecurityTrustResourceUrl(url('fullscreen')));
  matIconRegistry.addSvgIcon('stop', domSanitizer.bypassSecurityTrustResourceUrl(url('stop')));
  matIconRegistry.addSvgIcon('filter_list', domSanitizer.bypassSecurityTrustResourceUrl(url('filter_list')));
  matIconRegistry.addSvgIcon('error', domSanitizer.bypassSecurityTrustResourceUrl(url('error')));
}


function url(name: string): string {
  return `${BASE_URL}${name}_white_24dp.svg`;
}
