define([
  'static/js/hints.js'
], function (hints) {

  function showQuestionModal({ feature, polygonId, teamId, updateClaimedPolygons, updateTeamScore, hideLoader }) {
    const countyName = feature.attributes.areanm || "Unknown County";
    const modal = document.getElementById("questionModal");
    const modalBody = modal.querySelector(".modal-body");

    modalBody.innerHTML = "Loading question...";

    Promise.all([
      fetch(`/api/question-for/${teamId}/${polygonId}`).then(res => res.json()),
      fetch(`/api/polygon/${polygonId}/value`).then(res => res.json())
    ]).then(([q, valJson]) => {
      if (!q.text) {
        return showModalAlert("Error", q.error || "Question not found.", "error");
      }

      const questionId = q.id;
      const storageKey = `usedHints_q${questionId}`;
      const usedHints = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const shownHintIndexRef = { value: usedHints.length - 1 };

      const valueHtml = `
        <div><strong>County:</strong> ${countyName}</div>
        <div><strong>County Value:</strong> ${typeof valJson.value === 'number' ? `£${valJson.value}` : "Not available"}</div>
      `;

      modalBody.innerHTML = `
        ${valueHtml}
        <div style="margin-top:10px" class="popup-question">${autoLink(q.text)}</div>
        <input type="text" id="answerInput" placeholder="Your answer" style="width:100%; margin-top:10px; padding:6px;">
        <div style="margin-top:10px; display:flex; gap:10px;">
          <button id="submitAnswerBtn">Submit Answer</button>
          <button id="showHintBtn">Show Hint (£25)</button>
        </div>
        <div id="hintBox" style="margin-top:10px;"></div>
      `;

      const answerInput = modalBody.querySelector("#answerInput");
      const submitBtn = modalBody.querySelector("#submitAnswerBtn");
      const showHintBtn = modalBody.querySelector("#showHintBtn");
      const hintBox = modalBody.querySelector("#hintBox");

      hintBox.innerHTML = "";
      (q.hints || []).forEach((hint, i) => {
        if (usedHints.includes(i)) hintBox.innerHTML += `<div>- ${hint}</div>`;
      });
      hintBox.style.display = usedHints.length > 0 ? "block" : "none";

      modal.classList.remove("hidden");

      submitBtn.onclick = async () => {
        const answer = answerInput.value.trim();
        if (!answer) return showModalAlert("Error", "Enter an answer.", "error");

        const res = await fetch("/api/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, polygonId, answer, questionId })
        });

        const data = await res.json();
        if (data.correct) {
          showModalAlert("Correct!", "You claimed the county.", "success");
          modal.classList.add("hidden");
          updateClaimedPolygons();
          updateTeamScore();
        } else {
          showModalAlert("Incorrect", "Wrong answer. Try again.", "error");
        }
      };

      showHintBtn.onclick = () =>
        unlockNextHint({
          teamId,
          questionId,
          hints: q.hints || [],
          hintBox,
          shownHintIndexRef
        });
    }).catch((err) => {
      console.error("Error loading question modal:", err);
      showModalAlert("Error", "Something went wrong.", "error");
    }).finally(()=>{hideLoader()})
  }

  function autoLink(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => {
      const safeUrl = url.replace(/"/g, '&quot;');
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>`;
    });
  }

  return {
    showQuestionModal
  };
});
