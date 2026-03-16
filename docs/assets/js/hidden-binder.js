/**
 *	Hidden Field Binder
 *
 *	Contract:
 *	- Form is marked with class `.js-set-hidden` (single scope selector).
 *	- Controls (radio/checkbox) inside that form:
 *		- declare `data-hidden="hiddenId:value"`
 *		- may declare `data-hidden-priority="<number>"` (higher wins)
 *
 *	Rules:
 *	- Never creates inputs. Hidden inputs must already exist in the HTML (by ID).
 *	- Missing/empty value clears the hidden input (sets value to '').
 *	- Only reacts on "checked" state for change events.
 *	- Listens for PD's `conditional:cleared` to blank hidden fields when panels hide.
 */

(() => {
	const config = {
		formSel: 'form.js-set-hidden',

		// Optional: allow a high-priority selection to update before all optional radio groups are answered.
		// - Set to a number (e.g. 500) to enable.
		// - Set to null/0/false to disable.
		earlyPriorityMin: 500,

		// Optional: restrict early updates to these hidden ids (e.g. ['next']).
		// - Set to null/empty to allow early updates for any hidden id.
		earlyPriorityIds: ['next']
	};

	// selectors
	// ---------
	const CHECKED_SEL = 'input[data-hidden]:checked';

	// Parse `data-hidden="id:value"` into { id, value }
	// - `id` is required
	// - `value` may be empty (meaning “clear”)
	const parseHiddenSpec = (el) => {
		const spec = el?.dataset?.hidden;
		if (!spec) return null;

		const idx = spec.indexOf(':');
		const id = (idx === -1 ? spec : spec.slice(0, idx)).trim();
		if (!id) return null;

		const value = (idx === -1 ? '' : spec.slice(idx + 1)).trim();
		return { id, value };
	};

	// Fast check: does this element's data-hidden target the given id?
	// Accepts "id" or "id:...".
	const targetsHiddenId = (el, id) => {
		const raw = el?.dataset?.hidden;
		if (!raw) return false;
		return raw === id || raw.startsWith(id + ':');
	};

	const allowEarlyForId = (id) => {
		if (!config.earlyPriorityMin) return false;
		if (!Array.isArray(config.earlyPriorityIds) || !config.earlyPriorityIds.length) return true;
		return config.earlyPriorityIds.includes(id);
	};

	const getPriority = (el) => {
		const raw = el?.dataset?.hiddenPriority;
		const n = raw == null ? 0 : Number(raw);
		return Number.isFinite(n) ? n : 0;
	};

	const getHiddenOrWarn = (id) => {
		const hidden = document.getElementById(id);
		if (!hidden) {
			console.warn(`[hidden-binder] hidden input #${id} not found`);
			return null;
		}
		return hidden;
	};

	const setHiddenValue = (id, value) => {
		const hidden = getHiddenOrWarn(id);
		if (!hidden) return;
		hidden.value = value; // noisy writes are fine
	};

	// If multiple radio groups write to the same hidden id, optionally wait until all
	// groups have an answer before updating the hidden field.
	//
	// Rule:
	// - Consider only radios with `data-hidden` targeting this id.
	// - Group by `name` (radio group).
	// - If ANY of those groups is optional (no `required` radios in that group), then
	//   we require ALL groups to have a checked radio before we update.
	// - Returns true when we're allowed to update; false means "wait".
	const canUpdateFromRadioGroups = (form, id) => {
		const all = form.querySelectorAll('input[type="radio"][data-hidden]');

		// Map(name -> { anyChecked, anyRequired })
		const groups = new Map();

		// Track the highest priority among checked radios targeting this hidden id.
		let bestCheckedPriority = -Infinity;

		for (let i = 0; i < all.length; i++) {
			const el = all[i];
			if (!targetsHiddenId(el, id)) continue;

			const name = el.getAttribute('name') || '';
			if (!name) continue; // radios without a name don't behave as a group; ignore

			let g = groups.get(name);
			if (!g) {
				g = { anyChecked: false, anyRequired: false };
				groups.set(name, g);
			}

			if (el.required) g.anyRequired = true;
			if (el.checked) {
				g.anyChecked = true;
				const p = getPriority(el);
				if (p > bestCheckedPriority) bestCheckedPriority = p;
			}
		}

		// 0–1 groups → nothing to coordinate
		if (groups.size <= 1) return true;

		// If any group is optional, require all groups answered.
		let hasOptionalGroup = false;
		for (const g of groups.values()) {
			if (!g.anyRequired) { hasOptionalGroup = true; break; }
		}
		if (!hasOptionalGroup) return true;

		for (const g of groups.values()) {
			if (!g.anyChecked) {
				// Optional-group coordination: normally we wait.
				// But if a high-priority checked option is chosen, allow an early update.
				if (allowEarlyForId(id) && bestCheckedPriority >= config.earlyPriorityMin) return true;
				return false;
			}
		}
		return true;
	};

	// Resolve the current value for a hidden ID from the form state.
	// Priority:
	// 1) Highest `data-hidden-priority` among checked controls wins.
	// 2) If tied, the later control in DOM order wins.
	// 3) Value may be blank (meaning “clear”) and can win by priority.
	//
	// Note:
	// - We never default from unchecked controls.
	// - If nothing is checked for this hidden id, the resolved value is '' (clear).
	const resolveValueForId = (form, id) => {
		// If optional radio groups aren't all answered yet, don't update the hidden field.
		if (!canUpdateFromRadioGroups(form, id)) return null;

		const checked = form.querySelectorAll(CHECKED_SEL);

		let bestPriority = -Infinity;
		let bestValue = '';

		// Pass 1: checked controls only (normal behaviour)
		for (let i = 0; i < checked.length; i++) {
			const el = checked[i];
			const spec = parseHiddenSpec(el);
			if (!spec || spec.id !== id) continue;

			const p = getPriority(el);

			// Higher priority wins. If tied, later DOM wins (we're iterating in DOM order).
			if (p >= bestPriority) {
				bestPriority = p;
				bestValue = spec.value;
			}
		}

		// If any checked control matched this id, return the best value.
		if (bestPriority > -Infinity) return bestValue;

		// Nothing checked for this hidden id → clear.
		return '';
	};

	// On user change: re-evaluate the target from the current form state (priority aware)
	document.addEventListener('change', (e) => {
		const input = e.target;
		if (!input?.matches?.('input[type="radio"], input[type="checkbox"]')) return;
		if (!input.hasAttribute('data-hidden')) return;

		const form = input.closest(config.formSel);
		if (!form) return;

		const spec = parseHiddenSpec(input);
		if (!spec) return;

		const value = resolveValueForId(form, spec.id);
		if (value === null) return; // waiting for optional groups to be answered
		setHiddenValue(spec.id, value);
	}, { passive: true });

	// On PD hide: PD tells us which controls it cleared; blank their targets
	document.addEventListener('conditional:cleared', (e) => {
		const controls = e?.detail?.controls;
		if (!Array.isArray(controls) || !controls.length) return;

		const ids = new Set();

		for (const el of controls) {
			const spec = parseHiddenSpec(el);
			if (spec?.id) ids.add(spec.id);
		}

		const form = e.target?.closest?.(config.formSel);
		if (!form) return;

		for (const id of ids) {
			const value = resolveValueForId(form, id);
			// If we're waiting (null), treat it as cleared on PD hide.
			setHiddenValue(id, value == null ? '' : value);
		}
	}, { passive: true });
})();
