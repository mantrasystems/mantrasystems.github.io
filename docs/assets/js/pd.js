/**
 *	Progressive Disclosure
 * 
 */

(() => {
	// config
	// ---------
	const config = {
		formSel: 'form.js-conditional',   // scope
		showClass: 'is-visible',          // applied when a panel is shown
		hideClass: 'is-hidden',           // applied when a panel is hidden
		mirrorAriaControls: true,         // keep <select aria-controls> in sync
		clearBinaryOnHide: true,          // uncheck radios/checkboxes inside hidden panels
		debug: false,                     // console logging

		// dead-end (trigger-level)
		deadEndFormClass: 'is-dead-end',
		dispatchDeadEndEvent: true,

		// disable only (false) vs disable + hide selector (default: submit button)
		hideSubmitOnDeadEnd: '.js-submit-zone'	// true | string | string[] | falsy
	};

	// utils
	// ---------
	const log = (...a) => config.debug && console.log('[cond]', ...a);
	const tokens = (s='') => s.split(/\s+/).map(t => t.trim()).filter(Boolean);

	// NEW: tiny helper to avoid noisy DOM writes
	const setAttrIfDiff = (el, name, value) => {
		if (el.getAttribute(name) !== value) el.setAttribute(name, value);
	};

	// collect all panel IDs mentioned anywhere in a form
	const collectControlledIds = (form) => {
		const ids = new Set();
		form.querySelectorAll('[data-trigger], select option[data-trigger]').forEach(el => {
			tokens(el.dataset.trigger || '').forEach(id => ids.add(id));
		});
		return ids;
	};

	// if an element lives inside a controlled panel, return that panel's id
	const enclosingPanelId = (el, controlledIds) => {
		const host = el.closest('[id]');
		return host && controlledIds.has(host.id) ? host.id : null;
	};

	// active IDs from controls in a certain scope
	// allowedHosts === null → root only (outside panels)
	// allowedHosts is a Set  → only controls inside those hosts
	const activeIdsLimited = (form, controlledIds, allowedHosts) => {
		const ids = new Set();

		// radios / checkboxes
		form.querySelectorAll('input[type="radio"][data-trigger]:checked, input[type="checkbox"][data-trigger]:checked')
			.forEach(el => {
				const hostId = enclosingPanelId(el, controlledIds);
				if (allowedHosts === null && hostId !== null) return;
				if (allowedHosts !== null && (!hostId || !allowedHosts.has(hostId))) return;
				tokens(el.dataset.trigger).forEach(id => ids.add(id));
			});

		// selects (union of selected options)
		form.querySelectorAll('select').forEach(sel => {
			const hostId = enclosingPanelId(sel, controlledIds);
			if (allowedHosts === null && hostId !== null) return;
			if (allowedHosts !== null && (!hostId || !allowedHosts.has(hostId))) return;

			const list = Array.from(sel.selectedOptions || [])
				.flatMap(opt => tokens(opt.dataset.trigger || ''));

			// NEW: only mirror aria-controls when actually changed
			if (config.mirrorAriaControls) {
				const next = list.length ? list.join(' ') : null;
				const cur = sel.getAttribute('aria-controls');
				if (next && cur !== next) sel.setAttribute('aria-controls', next);
				if (!next && cur !== null) sel.removeAttribute('aria-controls');
			}
			list.forEach(id => ids.add(id));
		});

		return ids;
	};

	// show / hide panels
	// ---------
	const showPanel = (el) => {
		el.classList.remove(config.hideClass);
		el.classList.add(config.showClass);
		el.setAttribute('aria-hidden','false');
		if ('disabled' in el) el.removeAttribute('disabled');
	};
	const clearBinary = (panel) => {
		if (!config.clearBinaryOnHide) return [];
		const cleared = [];
		panel.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(i => {
			if (i.checked) {
				i.checked = false;
				cleared.push(i);
			}
		});
		return cleared;
	};
	const hidePanel = (el) => {
		// clear before disabling (and report what was cleared)
		const cleared = clearBinary(el);

		el.classList.remove(config.showClass);
		el.classList.add(config.hideClass);
		el.setAttribute('aria-hidden','true');
		if ('disabled' in el) el.setAttribute('disabled','');

		// Notify listeners (e.g. hidden-field binder) so they can clear derived values
		if (cleared.length) {
			el.dispatchEvent(new CustomEvent('conditional:cleared', {
				bubbles: true,
				detail: { controls: cleared }
			}));
		}
	};

	const focusFirst = (panel) => {
		const el = panel.querySelector('input, select, textarea, button, [tabindex]:not([tabindex="-1"])');
		el?.focus({ preventScroll: true });
	};

	// dead-end detection (trigger-level)
	// ---------
	const deadEndChosen = (form) => {
		return !!form.querySelector('input[data-dead-end]:checked, select option[data-dead-end]:checked');
	};

	// resolve targets to hide/disable at dead-end
	// ---------
	const deadEndTargets = (form) => {
		const opt = config.hideSubmitOnDeadEnd;
		if (!opt) return [];

		// true → default to submit buttons
		const selectors = opt === true ? ['[type="submit"]']
			: Array.isArray(opt) ? opt
			: [opt]; // string

		// collect unique elements (order stable)
		const set = new Set();
		selectors.forEach(sel => form.querySelectorAll(sel).forEach(el => set.add(el)));
		return Array.from(set);
	};

	// dynamic form action switching (minimal)
	// ------------------------------------
	// HTML contract:
	// 1) Form carries JSON map of keys → URLs in data-actions:
	//    <form class="js-conditional" data-actions='{"sorry":"/sorry","nb":"/nb-intake"}' action="/default">
	// 2) Controls that may change the action carry a key:
	//    - Radios/checkboxes: <input type="radio" data-action="sorry">
	//    - Select *or* its options: <select data-action="nb">…</select> OR <option data-action="nb">
	// Resolution rule (simple & reliable):
	//    On every change, compute the current key by scanning the form for:
	//      - checked inputs with [data-action]
	//      - selected options with [data-action]
	//    Take the *last in DOM order*. If none → restore original action.

	// cache the parsed map directly on the form element
	const getActionMap = (form) => {
		if (!form.__actions) {
			try {
				form.__actions = JSON.parse(form.getAttribute('data-actions') || '{}') || {};
			} catch {
				form.__actions = {};
			}
		}
		return form.__actions;
	};

	// remember original action once, so we can restore later
	const ensureOriginalAction = (form) => {
		if (!form.dataset.originalAction) {
			form.dataset.originalAction = form.getAttribute('action') || form.action || '';
		}
	};

	// NEW: early-out if there are no action rules on this form
	const currentActionKey = (form) => {
		if (!Object.keys(getActionMap(form) || {}).length) return null;
		const nodes = form.querySelectorAll(
			'input[type="radio"][data-action]:checked, input[type="checkbox"][data-action]:checked, select option[data-action]:checked'
		);
		return nodes.length ? nodes[nodes.length - 1].getAttribute('data-action') : null;
	};

	// set or restore action based on the resolved key
	const applyFormAction = (form, key) => {
		ensureOriginalAction(form);
		const map = getActionMap(form);
		const url = key && map[key] ? map[key] : form.dataset.originalAction;
		// NEW: avoid redundant attribute writes
		setAttrIfDiff(form, 'action', url);
	};

	// reappraise: root → cascade → apply → dead-end flag
	// ---------
	const reappraise = (form, controlledIds) => {
		// 1) root triggers (outside any panel)
		let visible = activeIdsLimited(form, controlledIds, null);

		// 2) cascade: internal triggers can only add downstream panels
		// NEW: guard based on number of controlled panels (worst-case depth)
		let changed = true, guard = Math.max(1, controlledIds.size);
		while (changed && guard--) {
			const extra = activeIdsLimited(form, controlledIds, visible);
			const next = new Set([...visible, ...extra]);
			changed = next.size !== visible.size || [...next].some(id => !visible.has(id));
			visible = next;
		}

		// 3) apply visibility
		let focused = false;
		controlledIds.forEach(id => {
			const panel = document.getElementById(id);
			if (!panel) return;

			const shouldShow = visible.has(id);
			const wasHidden =
				panel.getAttribute('aria-hidden') !== 'false' ||
				panel.classList.contains(config.hideClass) ||
				panel.hasAttribute('disabled');

			if (shouldShow) {
				showPanel(panel);
				if (wasHidden && !focused) { focusFirst(panel); focused = true; }
				log('show', `#${id}`);
			} else {
				hidePanel(panel);
				log('hide', `#${id}`);
			}
		});

		// 4) dead-end: triggers decide
		const isDead = deadEndChosen(form);
		form.classList.toggle(config.deadEndFormClass, isDead);

		// ALWAYS disable native submit buttons on dead end
		form.querySelectorAll('[type="submit"]').forEach(btn => {
			// NEW: write only if different
			if (btn.disabled !== isDead) btn.disabled = isDead;
		});

		// Optionally hide custom targets (or the submit if config === true)
		deadEndTargets(form).forEach(el => {
			el.classList.toggle(config.hideClass, isDead);
			el.querySelectorAll?.('[type="submit"]').forEach(btn => {
				if (btn.disabled !== isDead) btn.disabled = isDead;
			});
		});

		if (config.dispatchDeadEndEvent) {
			form.dispatchEvent(new CustomEvent('conditional:deadend', { bubbles: true, detail: { active: isDead } }));
		}

		// 5) update form action after visibility changes (handles hidden/cleared answers)
		applyFormAction(form, currentActionKey(form));
	};

	// lazy form indexing
	// ---------
	const formIds = new WeakMap(); // form → Set(controlledIds)
	const ensureControlled = (form) => {
		let ids = formIds.get(form);
		if (!ids) {
			ids = collectControlledIds(form);
			formIds.set(form, ids);
			log('indexed', Array.from(ids));
		}
		return ids;
	};

	// events
	// ---------
	document.addEventListener('change', (e) => {
		const form = e.target.form || e.target.closest(config.formSel);
		if (!form) return;

		// reappraise (may clear/hide panels and uncheck radios)
		// NOTE: applyFormAction is already called inside reappraise()
		reappraise(form, ensureControlled(form));
	}, { passive: true });

	// optional: only init if there’s a preselection (SSR/back button)
	document.addEventListener('DOMContentLoaded', () => {
		document.querySelectorAll(config.formSel).forEach(form => {
			const hasPreselection =
				form.querySelector('input[type="radio"][data-trigger]:checked, input[type="checkbox"][data-trigger]:checked') ||
				form.querySelector('select option[selected][data-trigger]');
			if (hasPreselection) reappraise(form, ensureControlled(form));

			// initialize original action cache and apply current key (if any)
			ensureOriginalAction(form);
			applyFormAction(form, currentActionKey(form));
		});
	});
})();
