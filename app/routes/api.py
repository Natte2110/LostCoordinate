from flask import Blueprint, request, jsonify
from app.models import Team, Polygon, Question, ClaimedPolygon, AnsweredQuestion, AssignedQuestion
from app import db
from datetime import datetime, timedelta
from sqlalchemy import func, and_
import json
from flask import current_app

api_bp = Blueprint("api", __name__)

@api_bp.route("/team", methods=["POST"])
def create_team():
    data = request.get_json()
    name = data.get("name")
    color = data.get("color")
    password = data.get("password")
    if not all([name, color, password]):
        return jsonify({"success": False, "message": "All fields required"}), 400

    if Team.query.filter_by(name=name).first():
        return jsonify({"success": False, "message": "Team name taken"}), 409
    if Team.query.filter_by(color=color).first():
        return jsonify({"success": False, "message": "Color already taken"}), 409

    team = Team(name=name, color=color)
    team.set_password(password)
    db.session.add(team)
    db.session.commit()
    logger = current_app.logger
    logger.info(f"[{datetime.utcnow()}] Team {name} created.")
    return jsonify({"success": True, "teamId": team.id})

@api_bp.route("/team/<int:team_id>", methods=["DELETE"])
def delete_team(team_id):
    team = Team.query.get_or_404(team_id)

    ClaimedPolygon.query.filter_by(team_id=team.id).delete()
    AnsweredQuestion.query.filter_by(team_id=team.id).delete()
    db.session.delete(team)
    db.session.commit()
    logger = current_app.logger
    logger.info(f"[{datetime.utcnow()}] Team {team.name} (ID: {team.id}) deleted.")

    return jsonify({"success": True}), 200

@api_bp.route("/team/leave/<int:team_id>", methods=["POST"])
def leave_team(team_id):
    # Only removes association client-side; doesn’t delete team
    team = Team.query.get_or_404(team_id)
    logger = current_app.logger
    logger.info(f"[{datetime.utcnow()}] Team {team.name} (ID: {team.id}) leave triggered.")

    return jsonify({"success": True}), 200

@api_bp.route("/join", methods=["POST"])
def join_team():
    data = request.json
    name = data.get("name")
    password = data.get("password")
    team = Team.query.filter_by(name=name).first()
    if not team or not team.check_password(password):
        return jsonify({"success": False, "message": "Invalid name or password"}), 401
    logger = current_app.logger
    if team:
        logger.info(f"[{datetime.utcnow()}] Login attempt for team '{name}': {'Success' if team.check_password(password) else 'Failed'}")
    return jsonify({"success": True, "teamId": team.id})


@api_bp.route("/map", methods=["GET"])
def get_map():
    polygons = Polygon.query.all()
    data = []

    for poly in polygons:
        claimed = ClaimedPolygon.query.filter_by(polygon_id=poly.id).first()
        data.append({
            "id": poly.id,
            "rings": poly.rings,
            "claimedBy": claimed.team_id if claimed else None,
            "color": claimed.team.color if claimed else None
        })

    return jsonify({"polygons": data})

@api_bp.route("/question/<int:polygon_id>", methods=["GET"])
def get_question(polygon_id):
    polygon = Polygon.query.get_or_404(polygon_id)
    question = polygon.question
    logger = current_app.logger
    logger.info(f"[{datetime.utcnow()}] Question requested for polygon {polygon_id}.")

    if not question:
        return jsonify({"error": "No question assigned to this polygon"}), 404

    return jsonify({"id": question.id, "text": question.text})

@api_bp.route("/state", methods=["GET"])
def game_state():
    teams = Team.query.all()
    team_data = []

    for team in teams:
        count = ClaimedPolygon.query.filter_by(team_id=team.id).count()
        team_data.append({
            "id": team.id,
            "name": team.name,
            "color": team.color,
            "claimedCount": count,
            "money": team.money
        })

    return jsonify({"teams": team_data})

@api_bp.route("/claim-start", methods=["POST"])
def claim_starting_tile():
    data = request.get_json()
    team_id = data.get("teamId")
    polygon_id = data.get("polygonId")

    if not all([team_id, polygon_id]):
        return jsonify({"success": False, "message": "Missing teamId or polygonId"}), 400

    team = Team.query.get(team_id)
    if not team:
        return jsonify({"success": False, "message": "Team not found"}), 404

    # Already claimed?
    if ClaimedPolygon.query.filter_by(polygon_id=polygon_id).first():
        return jsonify({"success": False, "message": "Tile already claimed"}), 409

    db.session.add(ClaimedPolygon(
        polygon_id=polygon_id,
        team_id=team.id,
        timestamp=datetime.utcnow()
    ))
    db.session.commit()
    logger = current_app.logger
    logger.info(f"[{datetime.utcnow()}] Claim start requested by team {team.name} for polygon {polygon_id}")
    return jsonify({"success": True}), 200

@api_bp.route("/claimed-polygons", methods=["GET"])
def claimed_polygons():
    claimed = ClaimedPolygon.query.all()
    result = []

    for cp in claimed:
        result.append({
            "polygonId": cp.polygon_id,
            "teamId": cp.team_id,
            "teamColor": cp.team.color,
            "defendedUntil": cp.defended_until.isoformat() + "Z" if cp.defended_until else None
        })

    return jsonify({"claimed": result})

@api_bp.route("/question-for/<int:team_id>/<polygon_id>", methods=["GET"])
def question_for(team_id, polygon_id):
    # Check if the polygon is already claimed by this team
    already_claimed = ClaimedPolygon.query.filter_by(team_id=team_id, polygon_id=polygon_id).first()
    if already_claimed:
        return jsonify({"error": "Polygon already claimed by this team"}), 403

    # Check if a question has already been assigned for this team and polygon
    existing = AssignedQuestion.query.filter_by(team_id=team_id, polygon_id=polygon_id).first()
    if existing:
        q = existing.question
        return jsonify({
            "id": q.id,
            "text": q.text,
            "hints": json.loads(q.hints_json) if q.hints_json else []
        })

    # Get polygon value
    polygon = Polygon.query.get(polygon_id)
    if not polygon or polygon.value not in [15, 30, 50]:
        return jsonify({"error": "Polygon not found or has invalid value"}), 400

    # Get question IDs already used (answered OR assigned)
    used_ids = set(
        q.question_id for q in AnsweredQuestion.query.filter_by(team_id=team_id)
    ).union(
        q.question_id for q in AssignedQuestion.query.filter_by(team_id=team_id)
    )

    # Select an unused question matching the polygon value
    available_question = Question.query.filter(
        and_(
            Question.value == polygon.value,
            ~Question.id.in_(used_ids)
        )
    ).order_by(func.random()).first()

    if not available_question:
        return jsonify({"error": f"No available questions left for value {polygon.value}"}), 404

    # Assign the question to this team and polygon
    assigned = AssignedQuestion(
        team_id=team_id,
        polygon_id=polygon_id,
        question_id=available_question.id
    )
    db.session.add(assigned)
    db.session.commit()

    current_app.logger.info(
        f"[{datetime.utcnow()}] Assigned question {available_question.id} (value {available_question.value}) to team {team_id} for polygon {polygon_id}"
    )

    return jsonify({
        "id": available_question.id,
        "text": available_question.text,
        "hints": json.loads(available_question.hints_json) if available_question.hints_json else []
    })
    
@api_bp.route("/answer", methods=["POST"])
def submit_answer():
    data = request.get_json()
    team_id = data.get("teamId")
    polygon_id = data.get("polygonId")
    submitted_answer = data.get("answer", "").strip()
    question_id = data.get("questionId")

    if not all([team_id, polygon_id, submitted_answer, question_id]):
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    # Validate assignment
    assigned = AssignedQuestion.query.filter_by(
        team_id=team_id, polygon_id=polygon_id, question_id=question_id
    ).first()

    if not assigned:
        return jsonify({"success": False, "message": "Invalid question assignment"}), 400

    question = Question.query.get(question_id)
    if not question:
        return jsonify({"success": False, "message": "Question not found"}), 404

    is_correct = submitted_answer.lower() == question.answer.lower()

    # Log the answer
    answer_log = AnsweredQuestion(
        team_id=team_id,
        question_id=question.id,
        correct=is_correct,
        timestamp=datetime.utcnow()
    )
    db.session.add(answer_log)

    if is_correct:
        # Update or insert ClaimedPolygon
        existing_claim = ClaimedPolygon.query.filter_by(polygon_id=polygon_id).first()
        if existing_claim:
            existing_claim.team_id = team_id
            existing_claim.timestamp = datetime.utcnow()
        else:
            db.session.add(ClaimedPolygon(
                polygon_id=polygon_id,
                team_id=team_id,
                timestamp=datetime.utcnow()
            ))

        # Delete all assigned questions for this polygon (across teams)
        AssignedQuestion.query.filter_by(polygon_id=polygon_id).delete()

    db.session.commit()
    logger = current_app.logger
    logger.info(f"[{datetime.utcnow()}] Team {team_id} answered question {question_id} for polygon {polygon_id}: {'Correct' if is_correct else 'Incorrect'}")

    return jsonify({"success": True, "correct": is_correct})


@api_bp.route("/polygon/<polygon_id>/value", methods=["GET"])
def get_polygon_value(polygon_id):
    polygon = Polygon.query.get(polygon_id)
    if not polygon:
        return jsonify({"error": "Polygon not found"}), 404

    return jsonify({
        "id": polygon.id,
        "name": polygon.name,
        "value": polygon.value
    })


@api_bp.route("/team/<int:team_id>/spend", methods=["POST"])
def spend_money(team_id):
    from app.models import Team
    team = Team.query.get_or_404(team_id)

    data = request.get_json()
    amount = data.get("amount", 0)

    if amount <= 0:
        return jsonify({"error": "Invalid amount"}), 400

    if team.money < amount:
        return jsonify({"error": "Not enough funds"}), 400

    team.money -= amount
    db.session.commit()
    logger = current_app.logger
    logger.info(f"[{datetime.utcnow()}] Team {team_id} spent £{amount}. Remaining: £{team.money}")
    return jsonify({"success": True, "remaining": team.money})


@api_bp.route("/defend/<polygon_id>", methods=["POST"])
def defend_tile(polygon_id):
    team_id = request.json.get("teamId")
    if not team_id:
        return jsonify({"error": "Missing teamId"}), 400

    claimed = ClaimedPolygon.query.filter_by(polygon_id=polygon_id, team_id=team_id).first()
    if not claimed:
        return jsonify({"error": "You do not control this tile"}), 403

    polygon = Polygon.query.get(polygon_id)
    if not polygon or polygon.value is None:
        return jsonify({"error": "Polygon value not found"}), 404

    team = Team.query.get(team_id)
    if team.money < polygon.value:
        return jsonify({"error": f"Not enough money. Defending this tile costs £{polygon.value}"}), 400

    # Deduct polygon-specific amount and defend
    team.money -= polygon.value
    claimed.defended_until = datetime.utcnow() + timedelta(minutes=30)

    db.session.commit()

    logger = current_app.logger
    logger.info(f"[{datetime.utcnow()}] Team {team_id} defended polygon {polygon_id} for £{polygon.value}. Defended until {claimed.defended_until.isoformat()}")

    return jsonify({
        "success": True,
        "defendedUntil": claimed.defended_until.isoformat(),
        "cost": polygon.value,
        "remainingMoney": team.money
    })

@api_bp.route("/scoreboard", methods=["GET"])
def scoreboard():
    teams = Team.query.all()

    data = []
    for team in teams:
        claimed_count = ClaimedPolygon.query.filter_by(team_id=team.id).count()
        last_claim = db.session.query(func.max(ClaimedPolygon.timestamp)).filter_by(team_id=team.id).scalar()

        data.append({
            "teamId": team.id,
            "name": team.name,
            "color": team.color,
            "money": round(team.money, 2),
            "claimedCount": claimed_count,
            "lastClaimed": last_claim.isoformat() if last_claim else None
        })

    data.sort(key=lambda x: x["claimedCount"], reverse=True)

    return jsonify({"teams": data})

