require([
    "/static/js/showModalAlert.js",
    "/static/js/confirmModal.js"
], function (modalUtils, confirmUtils) {
    window.showModalAlert = modalUtils.showModalAlert;
    window.hideModalAlert = modalUtils.hideModalAlert;
    window.showConfirmModal = confirmUtils.showConfirmModal;

    (function () {
        const createBtn = document.getElementById("createTeamBtn");
        const leaveBtn = document.getElementById("leaveTeamBtn");
        const deleteBtn = document.getElementById("deleteTeamBtn");
        const teamInfo = document.getElementById("teamInfo");
        const teamScore = document.getElementById("teamScore");
        const teamMoney = document.getElementById("teamMoney");

        createBtn.onclick = () => {
            window.location.href = "/team";
        };

        leaveBtn.onclick = async () => {
            const teamId = localStorage.getItem("teamId");
            if (!teamId) return;
            const confirmed = await confirmUtils.showConfirmModal("Leave Team", "Are you sure?");
            if (!confirmed) return;
            await fetch(`/api/team/leave/${teamId}`, { method: "POST" });
            localStorage.clear();
            window.location.reload();
        };

        deleteBtn.onclick = async () => {
            const teamId = localStorage.getItem("teamId");
            if (!teamId) return;
            const confirmed = await confirmUtils.showConfirmModal("Delete Team", "Are you sure?");
            if (!confirmed) return;

            const res = await fetch(`/api/team/${teamId}`, { method: "DELETE" });
            const json = await res.json();

            if (!res.ok) {
                modalUtils.showModalAlert("Delete Failed", json.message || "An error occurred", "error");
                return;
            }

            localStorage.clear();
            window.location.reload();
        };

        let previousMoney = null;
        function updateTeamDisplay() {
            const teamId = localStorage.getItem("teamId");
            const name = localStorage.getItem("teamName");

            teamInfo.textContent = name ? `Team: ${name}` : "Not in a team";

            if (teamId) {
                leaveBtn.style.display = deleteBtn.style.display = "inline";
                createBtn.style.display = "none";

                fetch("/api/state")
                    .then((res) => res.json())
                    .then((data) => {
                        const team = data.teams.find((t) => String(t.id) === String(teamId));
                        if (team) {
                            teamScore.textContent = `Score: ${team.claimedCount}`;
                            teamMoney.textContent = `Money: £${team.money}`;

                            if (previousMoney !== null && team.money > previousMoney) {
                                const gained = team.money - previousMoney;
                                modalUtils.showModalAlert("Income Gained", `Your team gained £${gained}`, "success");
                            }

                            previousMoney = team.money;
                        }
                    });
            } else {
                leaveBtn.style.display = deleteBtn.style.display = "none";
                createBtn.style.display = "inline";
                teamScore.textContent = "";
                teamMoney.textContent = "";
                previousMoney = null;
            }
        }

        updateTeamDisplay();
        setInterval(updateTeamDisplay, 15000)
    })();
});