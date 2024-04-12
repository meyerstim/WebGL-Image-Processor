; (function () { // https://stackoverflow.com/questions/70474845/inject-javascript-from-content-script-with-a-chrome-extension-v3
	let s = document.createElement('script');
	s.src = (chrome || browser).runtime.getURL('webglripper.js');
	s.onload = function () { this.remove(); };
	(document.head || document.documentElement).appendChild(s);
})();