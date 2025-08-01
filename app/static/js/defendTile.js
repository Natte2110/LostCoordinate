define([], function () {

  function handleDefendTile({ teamId, polygonId, countyName, defendCost, modalBody, modal, updateClaimedPolygons, updateTeamDisplay }) {
    return showConfirmModal(
      "Defend Tile",
      `Spend £${defendCost} to defend ${countyName} for 30 minutes?`
    ).then((confirmed) => {
      if (!confirmed) return;

      return fetch(`/api/defend/${polygonId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId })
      })
        .then(res => res.json())
        .then(json => {
          if (!json.success) {
            return showModalAlert("Error", json.error || "Could not defend tile.", "error");
          }

          const teamMoneyElem = document.getElementById("teamMoney");
          const match = teamMoneyElem.textContent.match(/£(\d+)/);
          if (match) {
            const currentMoney = parseInt(match[1]);
            const updatedMoney = currentMoney - defendCost;
            teamMoneyElem.textContent = `Money: £${updatedMoney}`;
          }

          showModalAlert("Tile Defended", `${countyName} is now protected for 30 minutes.`, "success");
          modal.classList.add("hidden");

          updateClaimedPolygons();
          if (typeof updateTeamDisplay === "function") updateTeamDisplay();
        })
        .catch((err) => {
          console.error("Defend tile error:", err);
          showModalAlert("Error", "Failed to defend tile.", "error");
        });
    });
  }

  return {
    handleDefendTile
  };
});
