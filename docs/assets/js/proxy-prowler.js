/**
 *	Proxy Prowler
 *	- 
 *  -
 */

document.addEventListener('DOMContentLoaded', () => {
	// On load
	track('PAGE_VIEW');

	// On form success
	track('LEAD');
});

function track(type) {
	fetch('https://track.yourdomain.com/event', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			type: type,
			url: window.location.href
		})
	});
}
