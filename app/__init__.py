from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_apscheduler import APScheduler
from app.tasks.money_processor import accumulate_team_money
import logging
from logging.handlers import RotatingFileHandler
import os

scheduler = APScheduler()
db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    app.config.from_object("app.config.Config")
    db.init_app(app)
    CORS(app)
    if not os.path.exists('logs'):
        os.mkdir('logs')

    file_handler = RotatingFileHandler('logs/game.log', maxBytes=10240, backupCount=5)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s [%(levelname)s] %(message)s'
    ))
    file_handler.setLevel(logging.INFO)

    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('Game startup')
    # Register main UI blueprint
    from app.routes.main import main_bp
    app.register_blueprint(main_bp)

    # Register API endpoints
    from app.routes.api import api_bp
    app.register_blueprint(api_bp, url_prefix="/api")

    # Create tables
    with app.app_context():
        db.create_all()

    scheduler.init_app(app)
    scheduler.start()

    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        if not scheduler.get_job('accumulate-money'):
            scheduler.add_job(
                id='accumulate-money',
                func=accumulate_team_money,
                args=[app],
                trigger='interval',
                minutes=30
            )
    
    return app
