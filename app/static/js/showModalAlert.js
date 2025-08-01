define([], function () {
  function showModalAlert(title = "Alert", description = "", type = "error") {
    const modal = document.getElementById("alertModal");
    if (!modal) return;

    modal.querySelector(".modal-alert-title").textContent = title;
    modal.querySelector(".modal-alert-description").textContent = description;

    const iconContainer = modal.querySelector(".modal-alert-icon");
    if (iconContainer) {
      iconContainer.innerHTML = type === "success"
        ? `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none"
            viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
            width="24" height="24" style="color: #22c55e;">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        `
        : `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none"
            viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
            width="24" height="24" style="color: #f87171;">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        `;
    }

    // Restart timer bar animation
    const timerBar = modal.querySelector(".modal-timer");
    if (timerBar) {
      timerBar.style.animation = "none";
      void timerBar.offsetWidth; // Force reflow
      timerBar.style.animation = "shrink 5s linear forwards";
    }

    // Handle animation class
    modal.classList.remove("hidden");
    modal.classList.remove("show"); // reset
    void modal.offsetWidth; // force reflow to re-trigger animation
    modal.classList.add("show");

    clearTimeout(modal.dismissTimeout);
    modal.dismissTimeout = setTimeout(() => {
      hideModalAlert();
    }, 5000);
  }

  function hideModalAlert() {
    const modal = document.getElementById("alertModal");
    if (!modal) return;
    modal.classList.remove("show");
    modal.classList.add("hidden");
  }

  window.showModalAlert = showModalAlert;
  window.hideModalAlert = hideModalAlert;

  return {
    showModalAlert,
    hideModalAlert
  };
});
