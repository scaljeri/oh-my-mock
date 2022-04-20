import { IOhMyMockSettings, OhMyAPIUpsert } from "../shared/api-types";
import { appSources, payloadType } from "../shared/constants";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { handleAPIUpsert } from "./api/upsert";
import { handleAPISettings } from "./api/settings";
import { OhMyContentState } from "./content-state";

export function handleAPI(messageBus: OhMyMessageBus, contentState: OhMyContentState) {
  messageBus.streamByType$<OhMyAPIUpsert>(payloadType.UPSERT, [appSources.INJECTED, appSources.EXTERNAL]).subscribe(handleAPIUpsert(contentState));
  messageBus.streamByType$<IOhMyMockSettings>(payloadType.SETTINGS, appSources.EXTERNAL).subscribe(handleAPISettings(contentState));
}
