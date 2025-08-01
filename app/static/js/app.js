require([
  // ArcGIS Core
  "esri/Map",
  "esri/views/MapView",

  // Layers
  "esri/layers/GeoJSONLayer",
  "esri/layers/GraphicsLayer",

  // Renderers & Graphics
  "esri/renderers/SimpleRenderer",
  "esri/Graphic",

  // Geometry & Projection
  "esri/geometry/geometryEngine",
  "esri/geometry/projection",

  // Custom App Modules
  "static/js/showModalAlert.js",
  "static/js/confirmModal.js",
  "static/js/defendTile.js",
  "static/js/claimStartTile.js",
  "static/js/questionModal.js"
], (
  Map, MapView,
  GeoJSONLayer, GraphicsLayer,
  SimpleRenderer, Graphic,
  geometryEngine, projection,
  modalUtils, confirmModal, defendTile, claimStartTile, questionModal
) => {
  (async function init() {
    const loader = document.getElementById("mapLoader");
    const showLoader = () => {
      loader.classList.remove("hidden");
    }
    const hideLoader = () => {
      loader.classList.add("hidden");
    }

    const map = new Map({ basemap: "dark-gray-vector" });
    const view = new MapView({
      container: "mapView",
      map: map,
      zoom: 6
    });
    document.querySelector(".modal-alert-close").addEventListener("click", modalUtils.hideModalAlert);

    function autoLink(text) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      return text.replace(urlRegex, (url) => {
        const safeUrl = url.replace(/"/g, '&quot;');
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>`;
      });
    }

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

    const countiesLayer = new GeoJSONLayer({
      url: "/static/data/dev_day_Polygons.geojson",
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
        title: "{areanm}",
        content: [{
          type: "fields",
          fieldInfos: [
            { fieldName: "areanm", label: "County Name" },
            { fieldName: "id", label: "Polygon ID" }
          ]
        }]
      }
    });

    const claimedLayer = new GraphicsLayer();
    const highlightLayer = new GraphicsLayer();
    
    map.add(countiesLayer);
    map.add(claimedLayer);  // Add after countiesLayer
    map.add(highlightLayer);
    view.popup.autoOpenEnabled = false;

    view.on("click", async (event) => {
      showLoader()
      const hit = await view.hitTest(event);
      const feature = hit.results.find(r => r.graphic?.layer === countiesLayer)?.graphic;
      if (!feature) {
        highlightLayer.removeAll();
        hideLoader()
        showModalAlert(
              "No Tile At Click",
              "There is no tile here.",
              "error"
            );
        return
      };

      highlightLayer.removeAll();
      const highlightGraphic = new Graphic({
        geometry: feature.geometry,
        symbol: {
          type: "simple-fill",
          style: "solid",
          color: [255, 255, 255, 0],
          outline: {
            color: [255, 255, 255],
            width: 10
          }
        }
      });
      highlightLayer.add(highlightGraphic);

      const teamId = localStorage.getItem("teamId");
      const polygonId = feature.attributes.areacd;
      view.goTo(feature)

      // Optional: Show a loading spinner or disable further action while checking
      let claimed = [];
      let tile = null;
      let isOwnedByTeam = false;
      try {
        const claimRes = await fetch("/api/claimed-polygons");
        const claimData = await claimRes.json();

        claimed = claimData.claimed || [];
        tile = claimed.find(c => String(c.polygonId) === String(polygonId));
        isOwnedByTeam = tile && String(tile.teamId) === String(teamId);
        if (tile && String(tile.teamId) !== String(teamId)) {
          const defendingClaims = claimed.filter(c => String(c.teamId) === String(tile.teamId));
          if (defendingClaims.length === 1) {
            showModalAlert(
              "Tile Protected",
              "You can't claim the last remaining county of another team.",
              "error"
            );
            hideLoader()
            highlightLayer.removeAll();
            return; // Stop the popup from showing
          }
        }
      } catch (err) {
        console.warn("Failed to check defending team claims:", err);
      }

      const popupTemplate = countiesLayer.popupTemplate.clone();

      // Dynamically check if team has claimed any tiles
      let hasClaimedAny = false;
      let isDefended = false;

      try {
        const res = await fetch("/api/claimed-polygons");
        const data = await res.json();

        const claimed = data.claimed || [];

        hasClaimedAny = claimed.some(c => String(c.teamId) === String(teamId));

        const currentTile = claimed.find(c => String(c.polygonId) === String(feature.attributes.areacd));
        if (currentTile?.defendedUntil) {
          const defendedUntil = new Date(currentTile.defendedUntil);
          isDefended = defendedUntil > new Date(); // true if it's in the future
        }

      } catch (e) {
        console.warn("Failed to fetch claim status:", e);
      }

      const isAdjacent = await isAdjacentToTeam(feature.geometry, teamId);

      // Default: no actions
      popupTemplate.actions = [];

      popupTemplate.content = async () => {
        const container = document.createElement("div");

        if (!teamId) {
          showModalAlert("Not in a Team", "You must join a team to interact with this tile.", "error");
          hideLoader()
          highlightLayer.removeAll();
          return;
        }

        if (isOwnedByTeam) {
          const countyName = feature.attributes.areanm || "Unknown County";

          const defendedUntil = tile?.defendedUntil;
          const now = new Date();
          const isCurrentlyDefended = defendedUntil && new Date(defendedUntil) > now;

          let defendCost = 100; // Default fallback value

          // Fetch value of the polygon
          try {
            const valRes = await fetch(`/api/polygon/${polygonId}/value`);
            if (valRes.ok) {
              const valJson = await valRes.json();
              if (typeof valJson.value === "number") {
                defendCost = valJson.value;
              }
            }
          } catch (err) {
            console.warn("Failed to fetch polygon value for defend cost:", err);
          }

          let defendInfo = isCurrentlyDefended
            ? `<div>This tile is defended until <strong>${new Date(defendedUntil).toLocaleTimeString()}</strong>.</div>`
            : `<div>This tile is not currently defended.</div>`;

          defendInfo += `<div>Defending a tile costs the same amount as the income for that tile and prevents other teams from taking it from you for 30 minutes.</div>`;

          const defendBtnHtml = isCurrentlyDefended
            ? ""
            : `<button id="defendBtn" style="margin-top:10px;">Defend Tile (£${defendCost})</button>`;

          modalBody.innerHTML = `
            <div><strong>${countyName}</strong> (Owned)</div>
            ${defendInfo}
            ${defendBtnHtml}
          `;

          modal.classList.remove("hidden");

          const defendBtn = document.getElementById("defendBtn");
          if (defendBtn) {
            defendBtn.onclick = () => defendTile.handleDefendTile({
              teamId,
              polygonId,
              countyName,
              defendCost,
              modalBody,
              modal,
              updateClaimedPolygons,
            });
          }
          hideLoader()
          highlightLayer.removeAll();
          return;
        }

        if (!hasClaimedAny) {
          const countyId = feature.attributes.areacd;
          const countyName = feature.attributes.areanm || "Unknown";

          claimStartTile.claimStartTile({
            teamId,
            countyId,
            countyName,
            updateClaimedPolygons,
            hideLoader
          });

          return;
        }

        if (isDefended) {
          showModalAlert("Tile Defended", "This tile is temporarily protected.", "error");
          hideLoader()
          highlightLayer.removeAll();
          return;
        }

        if (!isAdjacent) {
          showModalAlert("Tile Locked", "You may only claim adjacent tiles.", "error");
          hideLoader()
          highlightLayer.removeAll();
          return;
        }

        questionModal.showQuestionModal({
          feature,
          polygonId,
          teamId,
          updateClaimedPolygons,
          updateTeamScore,
          hideLoader
        });

        return container;

      };

      const modal = document.getElementById("questionModal");
      const modalBody = modal.querySelector(".modal-body");
      highlightLayer.removeAll();
      await popupTemplate.content(); // Let the function manage the modal itself

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
        countiesLayer.queryFeatures({ returnGeometry: true, outFields: ["areacd", "areanm"] })
          .then((featureSet) => {
            featureSet.features.forEach((f) => {

              const graphic = new Graphic({
                geometry: f.geometry,
                attributes: f.attributes
                // No symbol here – symbol is handled in updateClaimedPolygons
              });
              polygonGraphicsMap.set(f.attributes.areacd, graphic);
              polygonGraphicsMap.set(f.attributes.areanm, graphic);
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

    let polygonGraphicsMap = new window.Map(); // Use native Map

    const claimedTeamPolygons = new window.Map(); // teamId -> array of geometries

    function updateClaimedPolygons() {
      fetch("/api/claimed-polygons")
        .then(res => res.json())
        .then(data => {
          const claimedMap = new window.Map();
          claimedTeamPolygons.clear();

          for (const entry of data.claimed) {
            claimedMap.set(entry.polygonId, {
              teamColor: entry.teamColor,
              defendedUntil: entry.defendedUntil
            });

            // Store for adjacency check
            if (!claimedTeamPolygons.has(entry.teamId)) {
              claimedTeamPolygons.set(entry.teamId, []);
            }
            const g = polygonGraphicsMap.get(entry.polygonId);
            if (g) claimedTeamPolygons.get(entry.teamId).push(g.geometry);
          }

          claimedLayer.removeAll();
          for (const [ladCode, { teamColor, defendedUntil }] of claimedMap.entries()) {
            const graphic = polygonGraphicsMap.get(ladCode);
            if (!graphic) continue;

            const isDefended = defendedUntil && new Date(defendedUntil) > new Date();

            const clone = graphic.clone();
            clone.symbol = {
              type: "simple-fill",
              style: isDefended ? "backward-diagonal" : "solid",
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
