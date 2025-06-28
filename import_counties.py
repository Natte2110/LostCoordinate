import json
from app import db, create_app
from app.models import Polygon

app = create_app()  

with app.app_context():
    with open("./app/static/data/uk_counties.geojson") as f:
        geojson = json.load(f)

    for feature in geojson["features"]:
        props = feature["properties"]
        polygon_id = props.get("LAD13CD")
        name = props.get("LAD13NM")

        if polygon_id and name:
            db.session.add(Polygon(id=polygon_id, name=name))

    db.session.commit()
    print("Imported polygons.")
