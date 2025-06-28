define([], function () {
  function updateTeamDisplay(teamInfoEl, teamScoreEl, buttons = {}) {
    const { createBtn, leaveBtn, deleteBtn } = buttons;
    const teamId = localStorage.getItem("teamId");
    const teamName = localStorage.getItem("teamName");

    // Set team name text
    teamInfoEl.textContent = teamName ? `Team: ${teamName}` : 'Not in a team';

    if (teamId) {
      // Adjust buttons if provided
      if (leaveBtn && deleteBtn && createBtn) {
        leaveBtn.style.display = deleteBtn.style.display = "inline";
        createBtn.style.display = "none";
      }

      // Get claimed polygons to calculate score
      fetch('/api/claimed-polygons')
        .then(res => res.json())
        .then(json => {
          const claimed = json.claimed || [];
          const score = claimed.filter(p => String(p.teamId) === String(teamId)).length;
          teamScoreEl.textContent = `Score: ${score}`;
        });
    } else {
      if (leaveBtn && deleteBtn && createBtn) {
        leaveBtn.style.display = deleteBtn.style.display = "none";
        createBtn.style.display = "inline";
      }
      teamScoreEl.textContent = '';
    }
  }

  return {
    updateTeamDisplay
  };
});
