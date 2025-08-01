const TOTAL_TILE_COUNT = 100;

function timeAgo(utcString) {
  const utcDate = new Date(utcString);
  const correctedDate = new Date(utcDate.getTime() + 60 * 60000); // add 60 minutes

  const now = new Date();
  const diffMs = now - correctedDate;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  return `${minutes} minutes ago`;
}

async function loadScoreboard() {
  try {
    const res = await fetch("/api/scoreboard");
    const json = await res.json();
    const container = document.querySelector("#scoreboard");
    container.innerHTML = "";

    const sorted = json.teams.sort((a, b) => b.claimedCount - a.claimedCount);

    sorted.forEach((team, index) => {
      const lastClaim = team.lastClaimed ? timeAgo(team.lastClaimed) : "—";
      const percentClaimed = ((team.claimedCount / TOTAL_TILE_COUNT) * 100).toFixed(1);

      const card = document.createElement("div");
      card.className = "card";
      card.style.borderLeftColor = team.color;

      card.innerHTML = `
        <div class="team-header">#${index + 1} ${team.name}</div>
        <div class="stat">Claims: <span>${team.claimedCount}</span></div>
        <div class="stat">Income: <span>£${team.income}</span></div>
        <div class="stat">Last Claimed: <span>${lastClaim}</span></div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${percentClaimed}%; background-color: ${team.color};"></div>
        </div>
      `;

      container.appendChild(card);
    });

  } catch (err) {
    console.error("Failed to load scoreboard:", err);
  }
}

loadScoreboard();
setInterval(loadScoreboard, 30000);
