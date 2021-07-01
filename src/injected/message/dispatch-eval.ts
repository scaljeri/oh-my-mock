import { appSources, ohMyEvalStatus, packetTypes } from '../../shared/constants';
import { IData, IMock, IOhMyEvalRequest, IOhMyEvalResult, IPacket } from '../../shared/type';
import { evalCode } from '../../shared/utils/eval-code';
import { streamById$, uniqueId } from '../../shared/utils/messaging';
import { send } from './send';

declare let window: any;

export const dispatchEval = async (data: IData, request: IOhMyEvalRequest, log: (msg: string) => void): Promise<Partial<IMock>> => {
	return new Promise(async (resolve, reject) => {
		if (window.OhMyEvalDispatch) {
			const id = uniqueId();
			const payload = {
				context: { id, url: window.location.origin },
				type: packetTypes.EVAL,
				data: { data, request }
			}

			streamById$(id, appSources.CONTENT).subscribe((packet: IPacket) => {
				const resp = packet.payload.data as IOhMyEvalResult;
				handleOutput(resolve, (err) => {
					log('Oops, an error occured :(');
					log(`Could not execute the custom code for mock: ${request.url}  ${data.method} ${data.type}`);
					log(`Error message: ${err.message}`);
					log(`Due to Content Security Policy restriction the code was executed in OhMyMock's background script`)
					resolve(null);
				}, resp);
			});

			send(payload);
		} else {
			const output = await evalCode(data, request);
			handleOutput(resolve, reject, output);
		}
	});
}

function handleOutput(resolve, reject, output: IOhMyEvalResult) {
	if (output.status === ohMyEvalStatus.ERROR) {
		reject(new Error(output.result as string));
	} else {
		resolve(output.result as Partial<IMock>);
	}
}
