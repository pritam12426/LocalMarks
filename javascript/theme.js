(function () {
	const container = document.querySelector('.Theme-selector');
	if (!container) return;

	const select = document.createElement('select');
	select.id    = 'theme-select';
	select.setAttribute('aria-label', 'Theme');
	select.disabled = true;

	const defaultOpt      = document.createElement('option');
	defaultOpt.value      = '';
	defaultOpt.textContent = '🎨 Theme';
	select.appendChild(defaultOpt);

	container.appendChild(select);

	const link = document.getElementById('theme-css');

	function setTheme(name) {
		if (name) {
			link.href     = `stylesheet/themes/${name}.css`;
			link.disabled = false;
		} else {
			link.disabled = true;
		}
		localStorage.setItem('theme', name);
	}

	function populate(themes) {
		const frag = document.createDocumentFragment();
		themes.forEach(t => {
			const opt       = document.createElement('option');
			opt.value       = t.name;
			opt.textContent = t.label;
			frag.appendChild(opt);
		});
		select.appendChild(frag);

		// Restore saved theme if it's still in the list
		const saved = localStorage.getItem('theme');
		if (saved && themes.some(t => t.name === saved)) {
			select.value = saved;
			setTheme(saved);
		}

		select.disabled = false;
	}

	// themes.json is the single source of truth — no hardcoded fallback array
	fetch('themes.json')
		.then(r => {
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return r.json();
		})
		.then(populate)
		.catch(err => {
			console.warn('theme.js: could not load themes.json', err);
			// Select stays disabled so the user knows something went wrong
		});

	select.addEventListener('change', () => setTheme(select.value));
})();
