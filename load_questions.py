import json
import argparse
import os
from app import db, create_app
from app.models import Question

# Parse command-line arguments
parser = argparse.ArgumentParser(description="Load questions from all JSON files in a folder.")
parser.add_argument("folder", help="Path to the folder containing JSON files")
args = parser.parse_args()

# Set up Flask app context
app = create_app()

with app.app_context():
    total_loaded = 0

    for filename in os.listdir(args.folder):
        if filename.endswith(".json"):
            filepath = os.path.join(args.folder, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError as e:
                    print(f"Skipping {filename} (invalid JSON): {e}")
                    continue

                for q in data:
                    question = Question(
                        text=q["text"],
                        answer=q["answer"]
                    )
                    if "hints" in q:
                        question.hints = q["hints"]
                    if "value" in q:
                        question.value = q["value"]

                    db.session.add(question)

                total_loaded += len(data)
                print(f"Loaded {len(data)} questions from {filename}")

    db.session.commit()
    print(f"\nLoaded a total of {total_loaded} questions from folder: {args.folder}")
