async function unlockNextHint({
    teamId,
    questionId,
    hints,
    hintBox,
    shownHintIndexRef,
    hintCost = 25
}) {
    if (shownHintIndexRef.value + 1 >= hints.length) {
        hintBox.innerHTML += `<div><i>No more hints available</i></div>`;
        return;
    }

    const nextHintIndex = shownHintIndexRef.value + 1;
    const storageKey = `usedHints_q${questionId}`;
    const usedHints = JSON.parse(localStorage.getItem(storageKey) || "[]");

    if (!usedHints.includes(nextHintIndex)) {
        try {
            const spendRes = await fetch(`/api/team/${teamId}/spend`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: hintCost })
            });

            const spendJson = await spendRes.json();
            if (!spendRes.ok) {
                return showModalAlert("Error", spendJson.error || "Could not deduct funds", "error");
            }

            usedHints.push(nextHintIndex);
            localStorage.setItem(storageKey, JSON.stringify(usedHints));

            const teamMoneyElem = document.getElementById("teamMoney");
            const match = teamMoneyElem.textContent.match(/£(\d+)/);
            if (match) {
                const currentMoney = parseInt(match[1]);
                const updatedMoney = currentMoney - hintCost;
                teamMoneyElem.textContent = `Money: £${updatedMoney}`;
            }

            showModalAlert("Hint Unlocked", `£${hintCost} deducted from your team.`, "success");
            if (typeof updateTeamDisplay === "function") updateTeamDisplay();
        } catch (err) {
            console.error("Hint deduction error:", err);
            return showModalAlert("Error", "An error occurred while deducting funds.", "error");
        }
    }

    shownHintIndexRef.value = nextHintIndex;
    hintBox.style.display = "block";
    hintBox.innerHTML += `<div>- ${hints[shownHintIndexRef.value]}</div>`;
}
