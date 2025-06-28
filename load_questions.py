import json
from app import db, create_app
from app.models import Question

app = create_app()

with app.app_context():
    with open("questions.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    for q in data:
        question = Question(
            text=q["text"],
            answer=q["answer"]
        )

        if "hints" in q:
            question.hints = q["hints"]

        db.session.add(question)

    db.session.commit()
    print(f"Loaded {len(data)} questions into the database.")
