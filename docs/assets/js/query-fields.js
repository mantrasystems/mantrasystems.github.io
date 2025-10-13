/**
 *	Query String → Hidden Form Fields (simplified + storage)
 *
 *	Reads query string params and writes their values into hidden inputs
 *	inside target form(s). No dependencies.
 *
 *	CONFIG MODES (choose one):
 *	1) Explicit mappings (array):
 *			params: ['gclid', 'utm_campaign']
 *			// or with storage flag + custom key:
 *			params: [{ name: 'utm_campaign', store: true, key: 'campaign' }]
 *
 *	2) Mirror existing hidden inputs (boolean):
 *			params: true
 *		→ For each target form, any <input type="hidden" name="X"> will be
 *		  populated from ?X=value if present in the URL.
 *
 *	NEW:
 *	- If an item has `store: true`, its value will be cached in localStorage
 *	  and used as a fallback when not present in the query string.
 *	- Storage is cleared after form submission.
 *	- If an item also has `key: "foo"`, that key is used in storage instead of
 *	  the field name. Useful when you want a different storage identifier.
 */

(() => {
	// config
	// ---------
	const config = {
		formSel: 'form.js-add-query',

		// OPTION A: explicit whitelist (string or {name,store,key} objects)
		params: [
			{ name: 'li_fat_id', store: true, key: 'lid' },
			'lid',
			'qid',
			'utm_medium',
			'utm_source',
			'utm_campaign',
			'utm_content'
		],

		// OPTION B: mirror existing hidden inputs (true)
		// params: true,

		overwriteExisting: true,
		multiValue: 'first',         // 'first' | 'last' | 'join'
		joinSep: ',',                // used only when multiValue === 'join'
		trimValue: true,             // trim whitespace from captured value
		maxLength: 512,              // clamp long values (0/falsy to disable)
		storageKey: 'qsHiddenFields',// namespace for localStorage
		debug: false
	};

	// utils
	// ---------

	// Debug logger (no-op unless debug=true)
	const log = (...a) => config.debug && console.log('[qs→hidden]', ...a);

	// Escape for CSS selectors (fallback if CSS.escape not supported)
	const esc = (window.CSS && CSS.escape) ? CSS.escape : (s) => s;

	// Read param(s) using the multi-value policy, return string or null
	// Supports first/last/join strategies for multiple query params.
	const readParam = (sp, name) => {
		const all = sp.getAll(name);
		if (!all.length) return null;
		switch (config.multiValue) {
			case 'last': return all[all.length - 1];
			case 'join': return all.join(config.joinSep);
			case 'first':
			default: return all[0];
		}
	};

	// Normalize a captured value:
	// - trim whitespace
	// - clamp max length
	// - return null for empty strings
	const normalizeValue = (val) => {
		if (val == null) return null;
		let v = String(val);
		if (config.trimValue) v = v.trim();
		if (config.maxLength && config.maxLength > 0 && v.length > config.maxLength) {
			v = v.slice(0, config.maxLength);
		}
		return v === '' ? null : v;
	};

	// storage helpers
	// Save an object of key→value pairs into localStorage.
	const saveToStorage = (params) => {
		try { localStorage.setItem(config.storageKey, JSON.stringify(params)); } catch {}
	};

	// Load key→value map from localStorage.
	const loadFromStorage = () => {
		try {
			const raw = localStorage.getItem(config.storageKey);
			return raw ? JSON.parse(raw) : {};
		} catch { return {}; }
	};

	// Clear storage (called on form submit).
	const clearStorage = () => { try { localStorage.removeItem(config.storageKey); } catch {} };

	// main
	// ---------
	document.addEventListener('DOMContentLoaded', () => {
		const forms = document.querySelectorAll(config.formSel);
		if (!forms.length) return;

		const sp = new URLSearchParams(location.search);
		const storageCache = loadFromStorage();
		const newStorage = {};

		// Prepare a resolver for each form depending on config.params mode
		for (const form of forms) {
			let mappings = [];

			// MODE B: mirror existing hidden inputs
			if (config.params === true) {
				const hiddens = form.querySelectorAll('input[type="hidden"][name]');
				for (const input of hiddens) {
					const name = input.getAttribute('name');
					if (name) mappings.push({ name, store: false, key: name });
				}
			}
			// MODE A: explicit mappings array
			else if (Array.isArray(config.params)) {
				for (const item of config.params) {
					if (typeof item === 'string') {
						mappings.push({ name: item, store: false, key: item });
					} else if (item && item.name) {
						mappings.push({
							name: item.name,
							store: !!item.store,
							key: item.key || item.name
						});
					}
				}
			} else {
				// nothing configured; skip this form
				continue;
			}

			for (const { name, store, key } of mappings) {
				// Only work with hidden inputs that *exist in the HTML*
				let input = form.querySelector(`input[type="hidden"][name="${esc(name)}"]`);
				if (!input) {
					log(`skip: hidden input "${name}" not found in form`);
					continue;
				}

				// Source 1: query string param
				let raw = sp.has(name) ? readParam(sp, name) : null;

				// Source 2: storage fallback
				if (raw == null && storageCache[key]) {
					raw = storageCache[key];
					log(`fallback from storage "${key}"="${raw}"`);
				}

				const value = normalizeValue(raw);
				if (value == null) continue;

				// Respect overwriteExisting = false
				if (!config.overwriteExisting && input.value) {
					log(`skip overwrite "${name}" (existing="${input.value}")`);
					continue;
				}

				// Update field if value differs
				if (input.value !== value) {
					input.value = value;
					log(`set ${name}="${value}"`);
				}

				// Update storage if flagged
				if (store) newStorage[key] = value;
			}

			// clear storage on submit
			form.addEventListener('submit', clearStorage);
		}

		// refresh storage if new values were captured
		if (Object.keys(newStorage).length > 0) saveToStorage(newStorage);
	});
})();
