from app import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import json
from sqlalchemy import Float

class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, unique=True, nullable=False)
    color = db.Column(db.String, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

    claimed_polygons = db.relationship("ClaimedPolygon", backref="team", lazy=True)

    money = db.Column(Float, default=100.0, nullable=False)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=False)
    answer = db.Column(db.String, nullable=False)
    hints_json = db.Column(db.Text, nullable=True)
    value = db.Column(db.Integer, default=30, nullable=False)

    @property
    def hints(self):
        return json.loads(self.hints_json or "[]")

    @hints.setter
    def hints(self, value):
        self.hints_json = json.dumps(value)


class Polygon(db.Model):
    __tablename__ = "polygons"

    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String, nullable=False)
    area = db.Column(db.Float)  # Area in square meters
    value = db.Column(db.Integer)


class ClaimedPolygon(db.Model):
    __tablename__ = "claimed_polygons"

    id = db.Column(db.Integer, primary_key=True)
    polygon_id = db.Column(db.String, db.ForeignKey("polygons.id"), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("team.id"), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    defended_until = db.Column(db.DateTime, nullable=True)


class AnsweredQuestion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('question.id'), nullable=False)
    correct = db.Column(db.Boolean, default=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)


class AssignedQuestion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    polygon_id = db.Column(db.String, db.ForeignKey('polygons.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('question.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    # Optional relationships
    team = db.relationship('Team', backref='assigned_questions')
    polygon = db.relationship('Polygon', backref='assigned_questions')
    question = db.relationship('Question')
