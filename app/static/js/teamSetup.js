const AVAILABLE_COLORS = ["#e6194B", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe"];

async function loadState() {
    const res = await fetch("/api/state");
    const { teams } = await res.json();
    return teams;
}

function buildColorOptions(takenColors) {
    const container = document.getElementById("colorOptions");
    container.innerHTML = "";
    AVAILABLE_COLORS.forEach(hex => {
        const id = `color-${hex.slice(1)}`;
        const disabled = takenColors.includes(hex);
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "color";
        radio.value = hex;
        radio.id = id;
        radio.disabled = disabled;

        const label = document.createElement("label");
        label.htmlFor = id;
        label.style.background = hex;
        label.className = disabled ? "taken" : "";

        container.append(radio, label);
    });
}

async function loadForms() {
    const teams = await loadState();
    const taken = teams.map(t => t.color);
    buildColorOptions(taken);

    const listDiv = document.getElementById("teamsList");
    listDiv.innerHTML = "";
    teams.forEach(t => {
        const btn = document.createElement("button");
        btn.textContent = `${t.name} (Score: ${t.claimedCount})`;
        btn.style.background = t.color;
        btn.style.color = "#fff";
        btn.style.padding = "0.75rem 1rem";
        btn.style.border = "none";
        btn.style.borderRadius = "0.5rem";
        btn.style.margin = "0.25rem 0";
        btn.style.cursor = "pointer";
        btn.onclick = async () => {
            const pwd = prompt(`Password for "${t.name}"`);
            if (!pwd) return;
            const res = await fetch("/api/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: t.name, password: pwd })
            });
            const result = await res.json();
            if (!result.success) return alert(result.message);
            localStorage.setItem("teamId", result.teamId);
            localStorage.setItem("teamName", t.name);
            localStorage.setItem("teamColor", t.color);
            window.location.href = "/";
        };
        listDiv.appendChild(btn);
    });

    if (teams.length === 0) {
        listDiv.textContent = "No teams found.";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("createForm").addEventListener("submit", async e => {
        e.preventDefault();
        const f = e.target;
        const res = await fetch("/api/team", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: f.name.value.trim(),
                password: f.password.value,
                color: f.color.value
            })
        });
        const json = await res.json();
        if (!json.success) return alert(json.message);
        localStorage.setItem("teamId", json.teamId);
        localStorage.setItem("teamName", f.name.value.trim());
        localStorage.setItem("teamColor", f.color.value);
        window.location.href = "/";
    });

    loadForms();
});
