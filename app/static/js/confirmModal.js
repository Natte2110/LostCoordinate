define([], function () {
  function showConfirmModal(title = "Confirm", message = "Are you sure?") {
    return new Promise((resolve) => {
      const modal = document.getElementById("confirmModal");
      if (!modal) return resolve(false);

      modal.querySelector(".modal-alert-title").textContent = title;
      modal.querySelector(".modal-alert-description").textContent = message;
      modal.classList.remove("hidden");
      modal.classList.remove("show"); // reset
      void modal.offsetWidth; // force reflow to re-trigger animation
      modal.classList.add("show");

      const yesBtn = modal.querySelector("#confirmYesBtn");
      const noBtn = modal.querySelector("#confirmNoBtn");

      function cleanup(result) {
        modal.classList.add("hidden");
        yesBtn.removeEventListener("click", onYes);
        noBtn.removeEventListener("click", onNo);
        resolve(result);
      }

      function onYes() { cleanup(true); }
      function onNo() { cleanup(false); }

      yesBtn.addEventListener("click", onYes);
      noBtn.addEventListener("click", onNo);
    });
  }

  window.showConfirmModal = showConfirmModal;

  return {
    showConfirmModal
  };
});
