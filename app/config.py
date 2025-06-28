class Config:
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///dev.db"  # or your actual DB
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = "your-secret-key"
