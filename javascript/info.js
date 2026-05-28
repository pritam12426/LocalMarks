// =====================================
// info.js
// =====================================

async function loadDomainInfo() {
    console.group("🌐 Domain Information");

    try {
        console.log("Loading bookmarks.json...");

        const response = await fetch("bookmarks.json");

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const data = await response.json();

        const domains = data.domains || [];

        console.log(`Loaded (${domains.length} domains)`);

        const totalUrls =
            domains.reduce(
                (sum, d) => sum + d.urls,
                0
            );

        document.getElementById(
            "summary"
        ).textContent =
            `${domains.length} domains • ${totalUrls} bookmarks`;

        const container =
            document.getElementById(
                "domains-grid"
            );

        container.innerHTML = "";

        domains
            .sort((a, b) => b.urls - a.urls)
            .forEach(domain => {

                const card =
                    document.createElement("div");

                card.className =
                    "domain-card";

                card.innerHTML = `
                    <div class="domain-header">
                        <img
                            src="${domain.logo}"
                            alt=""
                            loading="lazy"
                        >

                        <div class="domain-name">
                            ${domain.domain}
                        </div>
                    </div>

                    <div class="domain-count">
                        ${domain.urls}
                    </div>

                    <div class="domain-label">
                        Bookmarks
                    </div>
                `;

                container.appendChild(card);
            });

        console.log("✅ Render complete");

    } catch (error) {

        console.error(error);

        document.getElementById(
            "domains-grid"
        ).innerHTML = `
            <div style="
                color:red;
                text-align:center;
            ">
                Failed to load bookmarks.json
            </div>
        `;
    }

    console.groupEnd();
}

window.onload = loadDomainInfo;
