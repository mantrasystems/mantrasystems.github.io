/**
 *	Timeslotter (simplified)
 *	- Generates UK-time slots, applies weekly blackouts, disables past slots.
 *	- Submits values in UK time (ISO-like with +00:00/+01:00).
 *	- Replaces each label’s content with viewer-local time: "H <small>am|pm|noon</small>"
 *	- Shows a message explaining which timezone is being displayed.
 *
 *	BLACKOUTS (frontmatter-friendly)
 *	- Store these in your page frontmatter (Liquid/Jekyll/etc.) and print JSON into data-blackouts.
 *	- Uses the names you prefer:
 *		- dates: [ "YYYY-MM-DD", ... ]						→ fully closed days (shown, but all slots disabled)
 *		- slots: [ { weekday: <0..6>, hours: [..] }, ... ]	→ disable certain hours on certain weekdays
 *
 *	Example frontmatter (YAML):
 *		blackouts:
 *			dates:
 *				- 2025-12-25
 *				- 2025-12-26
 *				- 2026-01-01
 *			slots:
 *				- weekday: 1
 *				  hours: [11, 12]		# Monday: block 11:00 + 12:00
 *				- weekday: 5
 *				  hours: [15]			# Friday: block 15:00
 *
 *	Example markup output (Liquid):
 *		<ol class="timeslots js-timeslots"
 *			data-blackouts='{{ page.blackouts | jsonify }}'>
 */

(() => {
	// settings
	// ---------
	const config = {
		timezone: 'Europe/London',	// canonical zone (for formatting day names)
		skipWeekends: true,			// whether to skip Saturday/Sunday
		dayName: 'long',			// weekday format ('short' → Mon, 'long' → Monday)
		offsetMinutes: 60,			// artificial "now" offset in minutes (e.g., +60 = +1hr)
		selectors: {
			timeslots: '.js-timeslots',
			day: '.js-day',
			dayHeader: '.js-day-header',
			dayDate: '.js-day-date',
			slot: '.js-slot',
			timezoneMsg: '.js-timezone-msg'
		}
	};

	// utils
	// ---------
	const zeroPadTwoDigits = n => String(n).padStart(2, '0');

	// Reuse formatters for UK display (weekday/date headings)
	const weekdayFmt = new Intl.DateTimeFormat('en-GB', {
		timeZone: config.timezone,
		weekday: config.dayName
	});
	const dateFmt = new Intl.DateTimeFormat('en-GB', {
		timeZone: config.timezone,
		day: 'numeric',
		month: 'short'
	});

	// For getting the current UK wall clock (cheap parts format)
	const ukNowPartsFmt = new Intl.DateTimeFormat('en-GB', {
		timeZone: config.timezone,
		year: 'numeric', month: '2-digit', day: '2-digit',
		hour: '2-digit', minute: '2-digit', hour12: false
	});

	// Detect viewer's timezone once
	const viewerTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	// UK DST heuristic: last Sunday in March → last Sunday in October (inclusive)
	const isUkDst = (y, m0, d) => {
		const lastSunday = (yy, m0_) => {
			const dt = new Date(yy, m0_ + 1, 0); // last day of month
			dt.setDate(dt.getDate() - dt.getDay()); // back to Sunday
			dt.setHours(0,0,0,0);
			return dt;
		};
		const start = lastSunday(y, 2);  // March
		const end   = lastSunday(y, 9);  // October
		const cur   = new Date(y, m0, d); cur.setHours(0,0,0,0);
		return cur >= start && cur <= end;
	};

	// Convert a UK wall time (y, m0, d, h) into a real instant (Date) using UK offset for that date.
	// GMT (winter): UTC = wall time; BST (summer): UTC = wall time - 1 hour.
	const ukWallToInstant = (y, m0, d, h, minute = 0) => {
		const dst = isUkDst(y, m0, d);
		const utcMs = Date.UTC(y, m0, d, h - (dst ? 1 : 0), minute, 0, 0);
		return new Date(utcMs);
	};

	// Form value: ISO-like string encoded in UK time (+00:00 / +01:00)
	const isoInUk = (y, m0, d, h, minute = 0) => {
		const off = isUkDst(y, m0, d) ? '+01:00' : '+00:00';
		return `${y}-${zeroPadTwoDigits(m0+1)}-${zeroPadTwoDigits(d)}T${zeroPadTwoDigits(h)}:${zeroPadTwoDigits(minute)}${off}`;
	};

	// "Effective now" in UK: take current UK wall time, add artificial offset, return:
	// - instantUK: real instant for comparisons
	// - wallUK: a Date carrying those UK wall fields (for calendar stepping)
	const computeEffectiveUkNow = () => {
		const parts = ukNowPartsFmt.formatToParts(new Date()).reduce((a,p)=>(a[p.type]=p.value,a),{});
		const y = Number(parts.year), m0 = Number(parts.month) - 1, d = Number(parts.day), hh = Number(parts.hour), mm = Number(parts.minute);

		// UK wall → instant, then add the artificial offset
		const baseInstant = ukWallToInstant(y, m0, d, hh, mm);
		const instantUK = new Date(baseInstant.getTime() + config.offsetMinutes * 60000);

		// Derive the *UK wall* date/time at that instant (for heading/sequence)
		const p2 = ukNowPartsFmt.formatToParts(instantUK).reduce((a,p)=>(a[p.type]=p.value,a),{});
		const wallUK = new Date(`${p2.year}-${p2.month}-${p2.day}T${p2.hour}:${p2.minute}`);

		return { instantUK, wallUK };
	};

	const isWeekend = d => d.getDay() === 0 || d.getDay() === 6;

	// prettify "America/Los_Angeles" → "Los Angeles" (and optionally "America")
	const prettyTimeZone = (tz, { includeRegion = false } = {}) => {
		const parts = tz.split('/');
		const city = parts.pop().replace(/_/g, ' ');
		if (!includeRegion) return city;
		const region = parts.join(' / ').replace(/_/g, ' ');
		return region ? `${city}, ${region}` : city;
	};

	// get a stable GMT offset label like "GMT-7" (falls back to short name like "PDT")
	const timeZoneOffsetLabel = (tz, date = new Date()) => {
		// Try to get "GMT-7" via shortOffset
		const off = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' })
			.formatToParts(date).find(p => p.type === 'timeZoneName')?.value;
		if (off) return off;

		// Fallback: abbreviation like "PDT"
		const short = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' })
			.formatToParts(date).find(p => p.type === 'timeZoneName')?.value;
		return short || '';
	};

	// Blackouts (frontmatter-friendly: { dates:[], slots:[] })
	// ---------

	// Read blackout JSON from the DOM. This is where your frontmatter ends up.
	const readBlackoutsFromDom = (root) => {
		const raw = root.getAttribute('data-blackouts');
		if (!raw) return null;
		try { return JSON.parse(raw); } catch { return null; }
	};

	// "YYYY-MM-DD" for a Date that represents UK wall time.
	const ymd = (d) => `${d.getFullYear()}-${zeroPadTwoDigits(d.getMonth()+1)}-${zeroPadTwoDigits(d.getDate())}`;

	// Compile blackouts into two quick lookup structures:
	// - closedDates: Set("YYYY-MM-DD") → if present, disable all slots on that date
	// - weeklySlots: Map(weekday -> Set(hours) | null)
	//		- null means "block the entire weekday"
	const compileBlackouts = (spec) => {
		const out = {
			closedDates: new Set(),
			weeklySlots: new Map()
		};

		if (!spec || typeof spec !== 'object') return out;

		// dates: fully closed days (shown, but all slots disabled)
		if (Array.isArray(spec.dates)) {
			for (const s of spec.dates) {
				if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
					out.closedDates.add(s);
				}
			}
		}

		// slots: weekly per-hour blocks (disable those hours on matching weekdays)
		if (Array.isArray(spec.slots)) {
			for (const rule of spec.slots) {
				if (!rule || typeof rule.weekday !== 'number') continue;

				if (Array.isArray(rule.hours) && rule.hours.length) {
					out.weeklySlots.set(rule.weekday, new Set(rule.hours.map(Number)));
				} else {
					out.weeklySlots.set(rule.weekday, null); // whole weekday blocked
				}
			}
		}

		return out;
	};

	// Slot predicate: should this hour be disabled for this day?
	// - If the date is in closedDates → disable everything (all hours)
	// - If weeklySlots has null for weekday → disable everything (all hours)
	// - If weeklySlots has a Set for weekday → disable only those hours
	const isClosedSlot = (dateUkWall, hour24, rules) => {
		// whole-date closure
		if (rules.closedDates.has(ymd(dateUkWall))) return true;

		// weekly closure
		const rule = rules.weeklySlots.get(dateUkWall.getDay()); // undefined | null | Set
		if (rule === null) return true;
		if (rule instanceof Set) return rule.has(hour24);
		return false;
	};

	// Build exactly N visible days, based on how many day columns exist in markup.
	// NOTE: closed dates are *not* removed here anymore — they are displayed but fully disabled.
	const buildVisibleDays = (startUkWall, count) => {
		const out = [];
		const cursor = new Date(startUkWall);

		while (out.length < count) {
			// skip weekends only (if configured)
			if (!config.skipWeekends || !isWeekend(cursor)) out.push(new Date(cursor));
			cursor.setDate(cursor.getDate() + 1);
		}
		return out;
	};

	// Replace a label’s content with: "H <small>am|pm|noon</small>"
	// Uses the viewer's local timezone by reading from the instant with Date#getHours().
	const setLabelTime = (labelEl, inputEl, instant) => {
		const hour24 = new Date(instant).getHours();     // viewer-local hour (0–23)
		const hour12 = ((hour24 + 11) % 12) + 1;         // 1..12
		const suffix  = (hour24 === 12) ? 'noon' : (hour24 < 12 ? 'am' : 'pm');

		const small = document.createElement('small');
		small.textContent = suffix;

		labelEl.replaceChildren(inputEl, document.createTextNode(String(hour12) + ' '), small);
	};

	// main
	// ---------
	document.addEventListener('DOMContentLoaded', () => {
		const $ = config.selectors;
		const root = document.querySelector($.timeslots);
		if (!root) return;

		// Show timezone message
		const msgEl = document.querySelector($.timezoneMsg);
		if (msgEl) {
			const nice = prettyTimeZone(viewerTimezone);           // "Los Angeles"
			const off  = timeZoneOffsetLabel(viewerTimezone);      // "GMT-7" (or "PDT" fallback)
			if (viewerTimezone !== config.timezone) {
				msgEl.textContent = `Times are shown in your local timezone (${nice}${off ? ` ${off}` : ''}). We are UK-based.`;
			} else {
				msgEl.textContent = `All times are UK local time`;
			}
		}

		// Compile blackouts once (dates + slots)
		const blackoutSpec = readBlackoutsFromDom(root);
		const rules = compileBlackouts(blackoutSpec);

		// Markup is the source-of-truth for number of days shown
		const dayNodes = root.querySelectorAll($.day);
		const daysCount = dayNodes.length;
		if (!daysCount) return;

		// Effective "now" in UK
		const { instantUK: effectiveNowInstantUk, wallUK: nowWallUk } = computeEffectiveUkNow();

		// Sequence of day dates (UK wall), skipping weekends (if configured)
		// NOTE: closed dates are displayed; they become fully disabled via isClosedSlot()
		const days = buildVisibleDays(nowWallUk, daysCount);

		for (let i = 0; i < daysCount; i++) {
			const dayEl = dayNodes[i];
			const d = days[i];

			// mark Mondays
			if (d.getDay() === 1) dayEl.classList.add('is-monday');

			// headings (UK wall)
			const daySpan  = dayEl.querySelector($.dayHeader);
			const dateSpan = dayEl.querySelector($.dayDate);
			if (daySpan)  daySpan.textContent = weekdayFmt.format(d); // "Monday"
			if (dateSpan) dateSpan.textContent = dateFmt.format(d);   // "14 Aug"

			// cache Y/M/D (UK wall fields)
			const year  = d.getFullYear();
			const month = d.getMonth();
			const dayNo = d.getDate();

			// each slot (inputs have data-hour)
			const inputs = dayEl.querySelectorAll($.slot);
			for (let j = 0; j < inputs.length; j++) {
				const input = inputs[j];
				const slotHour = parseInt(input.dataset.hour, 10); // 0..23
				if (Number.isNaN(slotHour)) continue;

				// Instant for this UK wall time (DST-safe via ukWallToInstant)
				const slotInstantUk = ukWallToInstant(year, month, dayNo, slotHour);

				// 1) Submitted value = UK ISO-like (+00/+01)
				const submitValue = isoInUk(year, month, dayNo, slotHour, 0);
				if (input.value !== submitValue) input.value = submitValue;

				// 2) Slot blackout:
				//	- dates[] disables every slot on that date
				//	- slots[] disables specific hours (or whole weekday)
				const blocked = isClosedSlot(d, slotHour, rules);

				// 3) Disable if past (only for first column) OR blacked out
				const disable = ((i === 0) && (effectiveNowInstantUk >= slotInstantUk)) || blocked;
				input.toggleAttribute('disabled', disable);

				// 4) Replace label text with viewer-local time
				const label = input.closest('label');
				if (label) setLabelTime(label, input, slotInstantUk);
			}
		}
	});
})();
