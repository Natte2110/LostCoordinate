# app/routes/main.py
from flask import Blueprint, render_template, request
from app.models import ClaimedPolygon, Team
from app import db
from sqlalchemy import func
main_bp = Blueprint("main", __name__)

@main_bp.route("/")
def index():
    return render_template("index.html")

@main_bp.route("/team", methods=["GET"])
def team_form():
    join = request.args.get("join") == "1"
    return render_template("create_team.html", join=join)

@main_bp.route("/scoreboard-page", methods=["GET"])
def scoreboard_page():
    teams = Team.query.all()

    data = []
    for team in teams:
        claimed_count = ClaimedPolygon.query.filter_by(team_id=team.id).count()
        last_claim = db.session.query(func.max(ClaimedPolygon.timestamp)).filter_by(team_id=team.id).scalar()

        data.append({
            "name": team.name,
            "color": team.color,
            "money": round(team.money, 2),
            "claimedCount": claimed_count,
            "lastClaimed": last_claim.strftime('%H:%M:%S') if last_claim else "—"
        })

    # Sort by most claimed
    data.sort(key=lambda x: x["claimedCount"], reverse=True)

    return render_template("scoreboard.html", teams=data)