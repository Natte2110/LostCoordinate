def accumulate_team_money(app):
    from app import db
    from app.models import Team, ClaimedPolygon, Polygon
    from datetime import datetime
    import logging

    with app.app_context():
        logger = app.logger  # Use the Flask app's logger
        logger.info(f"[{datetime.utcnow()}] #######################################")
        logger.info(f"[{datetime.utcnow()}] Applying income updates.")
        
        teams = Team.query.all()
        for team in teams:
            claims = ClaimedPolygon.query.filter_by(team_id=team.id).all()
            total_value = 0
            for claim in claims:
                polygon = Polygon.query.get(claim.polygon_id)
                if polygon and polygon.value:
                    total_value += polygon.value
            team.money += total_value
            logger.info(f"[{datetime.utcnow()}] Added £{total_value} to team '{team.name}'")

        db.session.commit()
