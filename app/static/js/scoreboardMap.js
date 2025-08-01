require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/GeoJSONLayer",
  "esri/layers/GraphicsLayer",
  "esri/Graphic"
], (
  Map, MapView,
  GeoJSONLayer, GraphicsLayer, Graphic
) => {
  const map = new Map({ basemap: "dark-gray-vector" });

  const view = new MapView({
    container: "mapView",
    map: map,
    constraints: { rotationEnabled: false }
  });

  view.when(() => {
    const refLayers = map.basemap.referenceLayers;
    if (refLayers) refLayers.removeAll();
  });

  const countiesLayer = new GeoJSONLayer({
    url: "/static/data/dev_day_Polygons.geojson",
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        style: "forward-diagonal",
        outline: { color: [0, 0, 0, 0.8], width: 1.5 },
        color: [255, 255, 255, 0.4]
      }
    }
  });

  const claimedLayer = new GraphicsLayer();
  map.addMany([countiesLayer, claimedLayer]);

  const polygonGraphicsMap = new Map();

  countiesLayer.when(() => {
    // Zoom to full extent of the counties layer
    countiesLayer.queryExtent().then((result) => {
      if (result.extent) {
        view.goTo(result.extent.expand(1.05)).then(() => {
          view.constraints = {
            geometry: result.extent,
            rotationEnabled: false,
            minScale: view.scale
          };
        }); // slight padding
      }
    });

    // Build lookup map for geometries
    countiesLayer.queryFeatures({
      returnGeometry: true,
      outFields: ["areacd"]
    }).then(featureSet => {
      featureSet.features.forEach(f => {
        polygonGraphicsMap.set(f.attributes.areacd, f.geometry);
      });
      updateClaimedPolygons();
    });
  });

  function updateClaimedPolygons() {
    fetch("/api/claimed-polygons")
      .then(res => res.json())
      .then(data => {
        claimedLayer.removeAll();

        data.claimed.forEach(entry => {
          const geom = polygonGraphicsMap.get(entry.polygonId);
          if (!geom) return;

          const isDefended = entry.defendedUntil &&
            new Date(entry.defendedUntil) > new Date();

          const symbol = {
            type: "simple-fill",
            style: isDefended ? "backward-diagonal" : "solid",
            color: entry.teamColor,
            outline: { color: [0, 0, 0, 0.8], width: 1 }
          };

          const graphic = new Graphic({ geometry: geom, symbol });
          claimedLayer.add(graphic);
        });
      });
  }

  setInterval(updateClaimedPolygons, 30000);
});