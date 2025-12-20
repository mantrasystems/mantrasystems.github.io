/**
 *	Timeslotter (simplified)
 *	- Generates UK-time slots, applies weekly blackouts, disables past slots.
 *	- Submits values in UK time (ISO-like with +00:00/+01:00).
 *	- Replaces each label’s content with viewer-local time: "H <small>am|pm|noon</small>"
 *	- Shows a message explaining which timezone is being displayed.
 */

(() => {
	// settings
	// ---------
	const config = {
		timezone: 'Europe/London',   // canonical zone (for formatting day names)
		skipWeekends: true,           // whether to skip Saturday/Sunday
		dayName: 'long',             // weekday format ('short' → Mon, 'long' → Monday)
		offsetMinutes: 60,           // artificial "now" offset in minutes (e.g., +60 = +1hr)
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

	// Build day sequence (today + next N−1), optionally skipping weekends for days 2..N
	const nextDays = (startWall, count, skipWeekends) => {
		const out = new Array(count);
		out[0] = new Date(startWall);
		let i = 1, cursor = new Date(startWall);
		while (i < count) {
			cursor.setDate(cursor.getDate() + 1);
			if (!skipWeekends || !isWeekend(cursor)) out[i++] = new Date(cursor);
		}
		return out;
	};

	// Weekly blackouts
	// ---------
	const readBlackoutsFromDom = (root) => {
		const raw = root.getAttribute('data-blackouts');
		if (!raw) return null;
		try { return JSON.parse(raw); } catch { return null; }
	};

	// Map weekday -> Set(hours) | null (null = whole weekday blocked)
	const compileWeeklyBlackouts = (rules) => {
		const map = new Map(); // 0..6 => Set | null
		if (!Array.isArray(rules)) return map;
		for (const rule of rules) {
			if (!rule || typeof rule.weekday !== 'number') continue;
			if (Array.isArray(rule.hours) && rule.hours.length) {
				map.set(rule.weekday, new Set(rule.hours.map(Number)));
			} else {
				map.set(rule.weekday, null); // block entire weekday
			}
		}
		return map;
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
		if (off) return off; // e.g., "GMT-7"

		// Fallback: "GMT-7" or an abbreviation like "PDT"
		const short = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' })
			.formatToParts(date).find(p => p.type === 'timeZoneName')?.value;
		return short || '';
	};

	// main
	// ---------
	document.addEventListener('DOMContentLoaded', () => {
		const $ = config.selectors;
		const root = document.querySelector($.timeslots);
		if (!root) return;

		// Show timezone message
		const msgEl = document.querySelector(config.selectors.timezoneMsg);
		if (msgEl) {
			const nice = prettyTimeZone(viewerTimezone);           // "Los Angeles"
			const off  = timeZoneOffsetLabel(viewerTimezone);      // "GMT-7" (or "PDT" fallback)
			if (viewerTimezone !== config.timezone) {
				msgEl.textContent = `Times are shown in your local timezone (${nice}${off ? ` ${off}` : ''}). We are UK-based.`;
			} else {
				msgEl.textContent = `All times are UK local time`;
			}
		}

		// Compile weekly blackouts once
		const weeklyBlackouts = compileWeeklyBlackouts(readBlackoutsFromDom(root));

		const dayNodes = root.querySelectorAll($.day);
		const daysCount = dayNodes.length; // markup is source-of-truth
		if (!daysCount) return;

		// Effective "now" in UK
		const { instantUK: effectiveNowInstantUk, wallUK: nowWallUk } = computeEffectiveUkNow();

		// Sequence of day dates (UK wall)
		const days = nextDays(nowWallUk, daysCount, config.skipWeekends);

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

			// per-day weekly rule (undefined | null | Set)
			const weeklyRule = weeklyBlackouts.get(d.getDay());

			// cache Y/M/D
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

				// 2) Weekly blackout: null → whole weekday; Set → hours
				const weeklyBlocked =
					weeklyRule === null ? true :
					(weeklyRule instanceof Set ? weeklyRule.has(slotHour) : false);

				// 3) Disable if past (only for first column) OR blacked out
				const disable = ((i === 0) && (effectiveNowInstantUk >= slotInstantUk)) || weeklyBlocked;
				input.toggleAttribute('disabled', disable);

				// 4) Replace label text with viewer-local time
				const label = input.closest('label');
				if (label) setLabelTime(label, input, slotInstantUk);
			}
		}
	});
})();
