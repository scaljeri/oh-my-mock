import { IData, IOhMyContext, ohMyMockId } from '@shared/type';

/**
 * The id of the response OhMyMock serves for a request in the active preset,
 * or undefined when it serves none and the call passes through.
 *
 * Three things have to line up, and each of them can be false on its own:
 *
 *  - the request is switched on for this preset (`enabled`);
 *  - a response is picked for this preset (`selected`);
 *  - that response still exists (`mocks`) — deleting one leaves the pick behind.
 *
 * Shared by the detail pane and its header rather than repeated: the chip row
 * marking "Off" as selected while the editor below it shows a mock would be a
 * plain lie about what the extension does.
 */
export function activeMockId(
  request: IData | undefined,
  context: IOhMyContext | undefined
): ohMyMockId | undefined {
  if (!request || !context || !request.enabled?.[context.preset]) {
    return undefined;
  }

  const selected = request.selected?.[context.preset];

  return selected && request.mocks?.[selected] ? selected : undefined;
}
