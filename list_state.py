from app import create_app, db
from app.models import Polygon, Question
from sqlalchemy import func

app = create_app()

with app.app_context():
    # Get polygon counts grouped by value
    polygon_counts = dict(
        db.session.query(Polygon.value, func.count()).group_by(Polygon.value).all()
    )

    # Get question counts grouped by value
    question_counts = dict(
        db.session.query(Question.value, func.count()).group_by(Question.value).all()
    )

    # Get all unique values from both sets
    all_values = sorted(set(polygon_counts.keys()) | set(question_counts.keys()))

    print("Value | Questions | Polygons")
    print("------|-----------|----------")
    for value in all_values:
        q_count = question_counts.get(value, 0)
        p_count = polygon_counts.get(value, 0)
        print(f"{value:>5} | {q_count:>9} | {p_count:>8}")
