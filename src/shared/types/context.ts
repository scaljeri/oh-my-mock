import { ohMyDomain } from './state';
import { ohMyPresetId } from './preset';

/**
 * The state context for a domain: which preset is selected and whether mocking
 * is on. `preset` is required — `StateUtils.init` always sets it to 'default',
 * and every lookup into `data.selected` / `data.enabled` indexes by it.
 *
 * Messages carry `IOhMyPacketContext` instead, which may legitimately omit the
 * preset; it deliberately no longer extends this type.
 */
export interface IOhMyContext {
  domain: ohMyDomain;
  preset: ohMyPresetId;
  active?: boolean;
  id?: string;
}
