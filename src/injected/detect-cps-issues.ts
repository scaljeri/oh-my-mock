declare let window: any;

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
