#!/usr/bin/env python3
import sys
import os

# Добавляем корень проекта в путь
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, render_template
from app.models import db
from app.routes import api
from app.security import hash_data, create_sponsor_token

def create_app():
    app = Flask(__name__, 
                template_folder=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'templates'),
                static_folder=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static'))
    
    # Конфигурация
    app.config['SECRET_KEY'] = 'dev-key-change-in-production'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///cos_verify.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Инициализация расширений
    db.init_app(app)
    
    # Регистрация API
    app.register_blueprint(api)
    
    # Создание таблиц БД
    with app.app_context():
        db.create_all()
    
    # Маршруты для страниц
    @app.route('/')
    def index():
        return render_template('index.html')
    
    @app.route('/verify')
    def verify_page():
        return render_template('verify.html')
    
    @app.route('/sponsor')
    def sponsor_page():
        return render_template('sponsor.html')
    
    return app

if __name__ == '__main__':
    app = create_app()
    print("Starting CoS Verify MVP server...")
    print("Access the application at: http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
