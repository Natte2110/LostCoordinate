from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    app.config.from_object("app.config.Config")
    db.init_app(app)
    CORS(app)
    
    # Register main UI blueprint
    from app.routes.main import main_bp
    app.register_blueprint(main_bp)

    # Register API endpoints
    from app.routes.api import api_bp
    app.register_blueprint(api_bp, url_prefix="/api")

    # Create tables
    with app.app_context():
        db.create_all()

    return app
