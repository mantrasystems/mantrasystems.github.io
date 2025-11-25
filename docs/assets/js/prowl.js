/**
 *	Prowl
 *	- So named because I don't feel comfortable with 'tracking'
 *	- Loads LinkedIn _only_ when UTM in URL shows that as the origin.
 *  - Takes 'partner ID' from meta tag in head
 */

document.addEventListener('DOMContentLoaded', () => {
	const params = new URLSearchParams(window.location.search);
	const from_linkedin = params.get('utm_source') === 'linkedin';
	const consent = localStorage.getItem('linkedinConsent');

	if (consent === 'yes') {
		loadLinkedInTag();
	} else if (consent === 'no') {
		// Do nothing, user declined previously
	} else if (from_linkedin) {
		// showLinkedInConsentModal();
        loadLinkedInTag();
	}
});

// UNTESTED: Not in use - potential future optional consent model
function showLinkedInConsentModal() {
	const modal = document.createElement('div');
	modal.className = 'linkedin-consent-modal';
	modal.innerHTML = `
		<div class="modal-overlay"></div>
		<div class="modal-window">
			<h2>Allow LinkedIn Tracking?</h2>
			<p>We use LinkedIn to measure the effectiveness of our ads. Allow us to load the LinkedIn Insight tag?</p>
			<div class="modal-buttons">
				<button id="allowTrack">Allow</button>
				<button id="denyTrack">No thanks</button>
			</div>
		</div>
	`;

	document.body.appendChild(modal);

	document.getElementById('allowTrack').addEventListener('click', () => {
		localStorage.setItem('linkedinConsent', 'yes');
		loadLinkedInTag();
		modal.remove();
	});

	document.getElementById('denyTrack').addEventListener('click', () => {
		localStorage.setItem('linkedinConsent', 'no');
		modal.remove();
	});
}


function loadLinkedInTag() {
    // Pull the Partner ID from a <meta> tag
	const pid = document.querySelector('meta[name="linkedin-partner-id"]')?.content;

	if (!pid) {
		// console.warn("LinkedIn Partner ID not found in <meta> tag.");
		return;
	}

	// Prevent duplicate loading
	if (window._linkedin_data_partner_ids?.includes(pid)) return;

	// Set the LinkedIn globals
	window._linkedin_partner_id = pid;
	window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
	window._linkedin_data_partner_ids.push(pid);

	(function(l) {
		if (!l) {
			window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
			window.lintrk.q = [];
		}
		const s = document.getElementsByTagName("script")[0];
		const b = document.createElement("script");
		b.type = "text/javascript";
		b.async = true;
		b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
		s.parentNode.insertBefore(b, s);
	})(window.lintrk);

    // Optionally inject the <noscript> fallback after consent
	const noscript = document.createElement("noscript");
	noscript.innerHTML = `
		<img height="1" width="1" style="display:none;" alt=""
			src="https://px.ads.linkedin.com/collect/?pid=${pid}&fmt=gif" />
	`;
	document.body.appendChild(noscript);
    
	// console.log("LinkedIn Insight Tag loaded");
}
