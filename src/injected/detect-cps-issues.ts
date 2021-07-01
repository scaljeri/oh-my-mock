import { Subject } from 'rxjs';
import { STORAGE_KEY } from '../shared/constants';

const subject = new Subject();


declare let window: any;
window.OhMyEvalDispatch = true;
document.addEventListener("securitypolicyviolation", (e) => {
	window.OhMyEvalDispatch = true;
});

export const hasCSPIssues = () => {
	try {
		eval('const x = 10');
		fetch('data:text/plain;charset=utf-8;base64,T2hNeU1vY2s=');
	} catch (err) {
	}
}