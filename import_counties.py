import json
from shapely.geometry import shape
from shapely.ops import transform
from pyproj import Transformer

from app import db, create_app
from app.models import Polygon

app = create_app()

# Transformer: WGS84 -> British National Grid (EPSG:4326 -> EPSG:27700)
transformer = Transformer.from_crs("EPSG:4326", "EPSG:27700", always_xy=True)

def project_geometry(geom):
    return transform(transformer.transform, geom)

with app.app_context():
    with open("./app/static/data/uk_counties.geojson") as f:
        geojson = json.load(f)

    polygons = []

    # Step 1: Calculate area for each feature and store temporarily
    for feature in geojson["features"]:
        props = feature["properties"]
        geom = feature["geometry"]

        polygon_id = props.get("LAD13CD")
        name = props.get("LAD13NM")

        if polygon_id and name and geom:
            shapely_geom = shape(geom)
            projected_geom = project_geometry(shapely_geom)
            area_sqm = projected_geom.area

            polygons.append({
                "id": polygon_id,
                "name": name,
                "area": area_sqm
            })

    # Step 2: Sort areas and calculate thresholds
    sorted_by_area = sorted(polygons, key=lambda p: p["area"])
    total = len(sorted_by_area)
    one_third = total // 3

    for i, p in enumerate(sorted_by_area):
        if i >= 2 * one_third:
            value = 50  # Top third
        elif i >= one_third:
            value = 30  # Middle third
        else:
            value = 15  # Bottom third

        db.session.add(Polygon(
            id=p["id"],
            name=p["name"],
            area=p["area"],
            value=value  # assumes your Polygon model has a `value` column
        ))

    db.session.commit()
    print("Imported polygons with area and value.")
