declare let window: any;

/* Due to CSP restrictions it might not be possible to `eval` code and use Fetch or XMLHttpRequest */
/* This code detects if the current site has CSP restrictions */
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
