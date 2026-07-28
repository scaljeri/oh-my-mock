declare global {
	interface Window {
		/**
		 * Set when the page's CSP blocked something OhMyMock needs, so custom
		 * code is evaluated in the background script instead.
		 */
		OhMyEvalDispatch?: boolean;
	}
}

/* Due to CSP restrictions it might not be possible to `eval` code and use Fetch or XMLHttpRequest */
/* This code detects if the current site has CSP restrictions */
document.addEventListener("securitypolicyviolation", () => {
	window.OhMyEvalDispatch = true;
});

export const hasCSPIssues = () => {
	try {
		eval('const x = 10');
		fetch('data:text/plain;charset=utf-8;base64,T2hNeU1vY2s=');
	} catch {
		// Being thrown at is the whole point: the probe above is what provokes
		// the `securitypolicyviolation` event, and the listener records the
		// answer. There is nothing to do with the error itself.
	}
}
