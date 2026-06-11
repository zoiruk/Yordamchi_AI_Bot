from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Sponsor(db.Model):
    """Модель лицензированного спонсора"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, unique=True)
    license_number = db.Column(db.String(50), nullable=False, unique=True)
    salt = db.Column(db.String(64), nullable=False)  # Соль для хеширования
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    cos_records = db.relationship('CosRecord', backref='sponsor', lazy=True)
    
    def __repr__(self):
        return f'<Sponsor {self.name}>'

class CosRecord(db.Model):
    """Модель записи CoS (хранятся только хеши)"""
    id = db.Column(db.Integer, primary_key=True)
    cos_number = db.Column(db.String(20), nullable=False)  # Номер CoS (можно хранить открыто или хешировать)
    cos_number_hash = db.Column(db.String(64), nullable=False)  # Хеш номера CoS для безопасности
    
    # Хеши персональных данных работника
    first_name_hash = db.Column(db.String(64), nullable=False)
    last_name_hash = db.Column(db.String(64), nullable=False)
    passport_hash = db.Column(db.String(64), nullable=False)
    date_of_birth_hash = db.Column(db.String(64), nullable=False)
    
    sponsor_id = db.Column(db.Integer, db.ForeignKey('sponsor.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_verified = db.Column(db.Boolean, default=True)
    expiry_date = db.Column(db.DateTime, nullable=True)
    
    def __repr__(self):
        return f'<CosRecord {self.cos_number}>'
