/**
 *	Dialogue hider / shower
 *
 *	TOOD:
 *	Explore https://a11y-dialog.netlify.app if #a11y problems pop up
 *
 */

(() => {
	const config = {
		breakpoint: '(min-width: 820px)',
		triggerClass: 'js-dialog-trigger',
		targetClass: 'js-dialog-target',
		closeClass: 'js-dialog-close'
	};

	// Open (mobile trigger)
	document.querySelectorAll(`.${config.triggerClass}`).forEach((btn) => {
		btn.addEventListener('click', () => {
			const id = btn.dataset.trigger;
			const dialog = id ? document.getElementById(id) : null;
			if (dialog && !dialog.open) dialog.showModal();
		});
	});

	// Close (button inside dialog)
	document.querySelectorAll(`.${config.closeClass}`).forEach((btn) => {
		btn.addEventListener('click', () => {
			const dialog = btn.closest(`.${config.targetClass}`);
			if (dialog?.open) dialog.close();
		});
	});

	// On entering desktop: switch any open dialog to inline and re-add [open]
	const mq = matchMedia(config.breakpoint);
	const demoteToInline = () => {
		if (!mq.matches) return; // act only when entering desktop
		document.querySelectorAll(`.${config.targetClass}`).forEach((dialog) => {
			if (!dialog.open) return;

			// Close then re-open modeless in the next tick so [open] is set again
			try { dialog.close(); } catch(_) {}
			setTimeout(() => {
				try { dialog.show(); } catch(_) {}
			}, 0);
		});
	};

	// Run once (covers initial desktop load) + watch changes (with Safari fallback)
	demoteToInline();
	if (mq.addEventListener) mq.addEventListener('change', demoteToInline);
	else mq.addListener(demoteToInline);
})();
