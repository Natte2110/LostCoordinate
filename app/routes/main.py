# app/routes/main.py
from flask import Blueprint, render_template, request

main_bp = Blueprint("main", __name__)

@main_bp.route("/")
def index():
    return render_template("index.html")

@main_bp.route("/team", methods=["GET"])
def team_form():
    # Optionally, handle join vs create logic via URL param: ?join=1
    join = request.args.get("join") == "1"
    return render_template("create_team.html", join=join)