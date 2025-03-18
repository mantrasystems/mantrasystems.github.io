/*
 *  Sticky banner
 *
 *  For when you want a banner wot is stuck
 *
 *  TODO: Set timings etc. from data atributes?
 * 
 */

document.addEventListener("DOMContentLoaded", () => {
	const stickyBanner = document.querySelector(".js-sticky");
	if (!stickyBanner) return;

	let hasAppeared = false;
	let hasUnstuck = false;
	const bannerId = stickyBanner.dataset.banner;
	const localStorageKey = `banner_closed_${bannerId}`;
	const closeButton = stickyBanner.querySelector(".js-sticky-close");
	const timeLimit = 15 * 1000;
	const scrollThreshold = (document.body.scrollHeight - window.innerHeight) / 6;
	const expireDays = 10;
	const expireMs = expireDays * 24 * 60 * 60 * 1000;
	const safetyZone = 600;

	// Check if the banner was closed recently
	const lastClosed = localStorage.getItem(localStorageKey);
	if (lastClosed && Date.now() - parseInt(lastClosed, 10) < expireMs) {
		return;
	}

	// Check if the banner is within the safety zone on page load
	const bannerRect = stickyBanner.getBoundingClientRect();
	if (
		(bannerRect.top >= 0 && bannerRect.bottom <= window.innerHeight) || // Fully visible
		(bannerRect.top < window.innerHeight && bannerRect.top > window.innerHeight - safetyZone) // Within safety zone
	) {
		console.log("Banner is already visible or within safety zone on page load.");
	} else {
		stickyBanner.classList.add("is-ready");
	}

	// IntersectionObserver to detect when the banner is unstuck
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting && !hasUnstuck) {
					stickyBanner.classList.remove("is-stuck");
					console.log("Banner unstuck!");
					hasUnstuck = true;
					observer.disconnect();
				}
			});
		},
		{ threshold: 1 }
	);

	function showBanner() {
		if (!hasAppeared && !hasUnstuck) {
			stickyBanner.classList.add("is-stuck");
			console.log("Banner shown!");
			observer.observe(stickyBanner);
			hasAppeared = true;
		}
	}

	// Trigger banner based on time or scroll
	setTimeout(showBanner, timeLimit);
	document.addEventListener("scroll", () => {
		if (window.scrollY > scrollThreshold) {
			showBanner();
		}
	});

	// Close button handling
	closeButton?.addEventListener("click", () => {
		stickyBanner.classList.remove("is-stuck");
		localStorage.setItem(localStorageKey, Date.now().toString());
		observer.disconnect();
		hasUnstuck = true;
		console.log("Banner closed manually.");
	});
});
