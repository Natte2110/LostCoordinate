require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/GeoJSONLayer",
  "esri/renderers/SimpleRenderer",
  "esri/core/reactiveUtils",
  "esri/layers/GraphicsLayer",
  "esri/Graphic",
  "esri/geometry/geometryEngine",
  "esri/geometry/projection",
  "esri/geometry/SpatialReference",
  'static/js/showModalAlert.js',
  'static/js/confirmModal.js'
], (
  Map, MapView, GeoJSONLayer, SimpleRenderer,
  reactiveUtils, GraphicsLayer, Graphic,
  geometryEngine, projection, SpatialReference, modalUtils, confirmModal
) => {
  (async function init() {
    const map = new Map({ basemap: "dark-gray-vector" });
    const view = new MapView({
      container: "mapView",
      map: map,
      zoom: 6
    });
    document.querySelector(".modal-alert-close").addEventListener("click", modalUtils.hideModalAlert);

    // Remove labels
    view.when(() => {
      const refLayers = map.basemap.referenceLayers;
      if (refLayers) refLayers.removeAll();
    });

    const teamId = localStorage.getItem("teamId");
    let userHasClaimed = false;

    if (teamId) {
      const res = await fetch("/api/claimed-polygons");
      const data = await res.json();
      userHasClaimed = data.claimed.some(c => String(c.teamId) === String(teamId));
    }

    const claimAction = {
      title: "Claim as Starting Tile",
      id: "claim-start-tile",
      className: "esri-icon-map-pin"
    };

    const countiesLayer = new GeoJSONLayer({
      url: "/static/data/uk_counties.geojson",
      outFields: ["*"],
      renderer: new SimpleRenderer({
        symbol: {
          type: "simple-fill",
          style: "forward-diagonal",
          outline: { color: [0, 0, 0, 0.8], width: 1.5 },
          color: [255, 255, 255, 0.4]
        }
      }),
      popupTemplate: {
        title: "{LAD13NM}",
        content: [{
          type: "fields",
          fieldInfos: [
            { fieldName: "LAD13NM", label: "County Name" },
            { fieldName: "id", label: "Polygon ID" }
          ]
        }]
      }
    });

    const claimedLayer = new GraphicsLayer();

    map.add(countiesLayer);
    map.add(claimedLayer);  // Add after countiesLayer
    view.popup.autoOpenEnabled = false;

    view.on("click", async (event) => {
      const hit = await view.hitTest(event);
      const feature = hit.results.find(r => r.graphic?.layer === countiesLayer)?.graphic;
      if (!feature) return;

      const teamId = localStorage.getItem("teamId");
      const polygonId = feature.attributes.LAD13CD;


      // Optional: Show a loading spinner or disable further action while checking
      try {
        const claimRes = await fetch("/api/claimed-polygons");
        const claimData = await claimRes.json();

        const claimed = claimData.claimed || [];
        const tile = claimed.find(c => String(c.polygonId) === String(polygonId));

        if (tile && String(tile.teamId) !== String(teamId)) {
          const defendingClaims = claimed.filter(c => String(c.teamId) === String(tile.teamId));
          if (defendingClaims.length === 1) {
            showModalAlert(
              "Tile Protected",
              "You can't claim the last remaining county of another team.",
              "error"
            );
            return; // Stop the popup from showing
          }
        }
      } catch (err) {
        console.warn("Failed to check defending team claims:", err);
      }

      const popupTemplate = countiesLayer.popupTemplate.clone();

      // Dynamically check if team has claimed any tiles
      let hasClaimedAny = false;
      try {
        const res = await fetch("/api/claimed-polygons");
        const data = await res.json();
        hasClaimedAny = data.claimed.some(c => String(c.teamId) === String(teamId));
      } catch (e) {
        console.warn("Failed to fetch claim status:", e);
      }

      const isAdjacent = await isAdjacentToTeam(feature.geometry, teamId);

      // Default: no actions
      popupTemplate.actions = [];

      popupTemplate.content = () => {
        const container = document.createElement("div");

        if (!teamId) {
          container.innerHTML = "You must join a team to interact with this tile.";
          return container;
        }

        if (!hasClaimedAny) {
          // Starting tile claim allowed
          container.innerHTML = "Claim this as your starting tile.";
          popupTemplate.actions = [claimAction];
          return container;
        }

        if (!isAdjacent) {
          container.innerHTML = "This tile is locked. You may only claim adjacent tiles.";
          return container;
        }

        // Fetch question
        container.innerHTML = "Loading question...";
        fetch(`/api/question-for/${teamId}/${polygonId}`)
          .then(res => res.json())
          .then(q => {
            if (q.text) {
              const hints = q.hints || [];
              let shownHintIndex = -1;

              container.innerHTML = `
            <b>Answer this to claim:</b><br><br>
            <div><strong>${q.text}</strong></div><br>
            <input type="text" id="answerInput" placeholder="Your answer" style="width: 100%; padding: 4px;"><br><br>
            <button id="submitAnswerBtn">Submit Answer</button>
            <button id="showHintBtn">Show Hint</button>
            <div id="hintBox" style="margin-top: 10px; display: none;"></div>
            <input type="hidden" id="questionId" value="${q.id}">
          `;

              const submitBtn = container.querySelector("#submitAnswerBtn");
              const showHintBtn = container.querySelector("#showHintBtn");
              const answerInput = container.querySelector("#answerInput");
              const hintBox = container.querySelector("#hintBox");

              showHintBtn.addEventListener("click", () => {
                if (shownHintIndex + 1 < hints.length) {
                  shownHintIndex++;
                  hintBox.style.display = "block";
                  hintBox.innerHTML += `<div>- ${hints[shownHintIndex]}</div>`;
                } else {
                  hintBox.innerHTML += "<div><i>No more hints available</i></div>";
                }
              });

              submitBtn.addEventListener("click", () => {
                const answer = answerInput.value.trim();
                if (!answer) return showModalAlert("Error!", "Please enter an answer.", "error");

                fetch("/api/answer", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ teamId, polygonId, answer, questionId: q.id })
                })
                  .then(res => res.json())
                  .then(data => {
                    if (data.correct) {
                      showModalAlert("Correct!", "You claimed the county.", "success");
                      view.popup.close();
                      updateClaimedPolygons();
                      updateTeamScore();
                    } else {
                      showModalAlert("Error!", "Wrong answer. Try again.", "error");
                    }
                  });
              });
            } else {
              container.innerHTML = q.error || "Could not fetch a question.";
            }
          })
          .catch(() => {
            container.innerHTML = "Error loading question.";
          });

        return container;
      };

      feature.popupTemplate = popupTemplate;
      view.popup.open({
        location: event.mapPoint,
        features: [feature]
      });
    });

    countiesLayer.when().then(() => {
      countiesLayer.queryExtent().then((result) => {
        const extent = result.extent;
        view.goTo(extent).then(() => {
          view.constraints = {
            geometry: extent,
            rotationEnabled: false,
            minScale: view.scale
          };
        });
        countiesLayer.queryFeatures({ returnGeometry: true, outFields: ["LAD13CD", "LAD13NM"] })
          .then((featureSet) => {
            featureSet.features.forEach((f) => {

              const graphic = new Graphic({
                geometry: f.geometry,
                attributes: f.attributes
                // No symbol here – symbol is handled in updateClaimedPolygons
              });
              polygonGraphicsMap.set(f.attributes.LAD13CD, graphic);
              polygonGraphicsMap.set(f.attributes.LAD13NM, graphic);
            });


            // Start polling
            updateClaimedPolygons();
            setInterval(updateClaimedPolygons, 30000);
          });

      });
    });

    function isAdjacentToTeam(featureGeometry, teamId) {
      const teamGeometries = claimedTeamPolygons.get(Number(teamId)) || [];
      if (!teamGeometries.length) return false;

      const targetSR = teamGeometries[0].spatialReference;

      // Ensure projection module is loaded
      if (!projection.isLoaded()) {
        return projection.load().then(() => {
          const projected = projection.project(featureGeometry, targetSR);
          return checkAdjacency(projected, teamGeometries);
        });
      }

      const projected = projection.project(featureGeometry, targetSR);
      return checkAdjacency(projected, teamGeometries);
    }

    function checkAdjacency(projectedFeature, teamGeometries) {
      return teamGeometries.some((teamGeom, i) => {
        const result = geometryEngine.intersects(teamGeom, projectedFeature);
        return result;
      });
    }

    reactiveUtils.on(() => view.popup, "trigger-action", (event) => {
      if (event.action.id === "claim-start-tile") {
        const graphic = view.popup.selectedFeature;
        if (!graphic) return showModalAlert("Error!", "No Graphic Selected.", "error");

        const countyId = graphic.attributes.LAD13CD
        const countyName = graphic.attributes.LAD13NM || "Unknown";
        confirmModal.showConfirmModal("Confirm", `Claim ${countyName} as your starting tile?`)
          .then((confirmed) => {
            if (!confirmed) return;
            const teamId = localStorage.getItem("teamId");
            if (!teamId) return showModalAlert("Error!", "You must be in a team to claim a starting tile.", "error");

            fetch("/api/claim-start", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ teamId, polygonId: countyId })
            })
              .then(res => res.json())
              .then(json => {
                if (!json.success) return showModalAlert("Error!", "Someone already owns this!", "error");

                showModalAlert("Success!", `You ${countyName} as your starting tile!`, "success");
                view.popup.close();
                userHasClaimed = true;
                countiesLayer.actions = [];
                updateClaimedPolygons();
              });
          });

      }
    });
    reactiveUtils.on(
      () => view.popup,
      "selectedFeature",
      () => {
        const feature = view.popup.selectedFeature;
        if (!feature) return;

        // Remove claim action if already claimed
        if (userHasClaimed) {
          view.popup.actions.removeAll();
        }
      }
    );

    let polygonGraphicsMap = new window.Map(); // Use native Map

    const claimedTeamPolygons = new window.Map(); // teamId -> array of geometries

    function updateClaimedPolygons() {
      fetch("/api/claimed-polygons")
        .then(res => res.json())
        .then(data => {
          const claimedMap = new window.Map();
          claimedTeamPolygons.clear();

          for (const entry of data.claimed) {
            claimedMap.set(entry.polygonId, entry.teamColor);

            // Store for adjacency check
            if (!claimedTeamPolygons.has(entry.teamId)) {
              claimedTeamPolygons.set(entry.teamId, []);
            }
            const g = polygonGraphicsMap.get(entry.polygonId);
            if (g) claimedTeamPolygons.get(entry.teamId).push(g.geometry);
          }

          claimedLayer.removeAll();
          for (const [ladCode, teamColor] of claimedMap.entries()) {
            const graphic = polygonGraphicsMap.get(ladCode);
            if (!graphic) continue;

            const clone = graphic.clone();
            clone.symbol = {
              type: "simple-fill",
              style: "solid",
              color: teamColor,
              outline: { color: [0, 0, 0, 0.8], width: 1.5 }
            };
            claimedLayer.add(clone);
          }
          updateTeamScore();
        });
    }
  })();


  function updateTeamScore() {
    const teamId = localStorage.getItem("teamId");
    const teamScore = document.getElementById("teamScore");

    if (!teamId || !teamScore) return;

    fetch('/api/claimed-polygons')
      .then(res => res.json())
      .then(json => {
        const claimed = json.claimed || [];
        const score = claimed.filter(p => String(p.teamId) === String(teamId)).length;
        teamScore.textContent = `Score: ${score}`;
      });
  }

});
