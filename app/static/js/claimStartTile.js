define([], function () {

  function claimStartTile({ teamId, countyId, countyName, updateClaimedPolygons, updateTeamDisplay, hideLoader }) {
    return showConfirmModal("Claim Starting Tile", `Claim ${countyName} as your starting tile?`)
      .then((confirmed) => {
        if (!confirmed) return;

        if (!teamId) {
          return showModalAlert("Error!", "You must be in a team to claim a starting tile.", "error");
        }

        return fetch("/api/claim-start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, polygonId: countyId })
        })
        .then(res => res.json())
        .then(json => {
          if (!json.success) {
            return showModalAlert("Error!", "Someone already owns this!", "error");
          }

          showModalAlert("Success!", `You claimed ${countyName} as your starting tile!`, "success");
          updateClaimedPolygons();
          if (typeof updateTeamDisplay === "function") updateTeamDisplay();
        })
        .catch((err) => {
          console.error("Claim start error:", err);
          showModalAlert("Error!", "Something went wrong while claiming.", "error");
        })
        .finally(() => {hideLoader()})
      });
  }

  return {
    claimStartTile
  };
});
