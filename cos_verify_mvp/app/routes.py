from flask import Blueprint, request, jsonify, render_template
from app.models import db, Sponsor, CosRecord
from app.security import hash_data, create_sponsor_token

api = Blueprint('api', __name__, url_prefix='/api')

@api.route('/sponsors', methods=['POST'])
def register_sponsor():
    """Регистрация нового спонсора"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Нет данных'}), 400
    
    name = data.get('name')
    license_number = data.get('license_number')
    
    if not name or not license_number:
        return jsonify({'error': 'Имя и номер лицензии обязательны'}), 400
    
    # Проверка существования спонсора
    existing = Sponsor.query.filter_by(license_number=license_number).first()
    if existing:
        return jsonify({'error': 'Спонсор с таким номером лицензии уже существует'}), 409
    
    # Создание спонсора с уникальной солью
    salt = create_sponsor_token(name)
    sponsor = Sponsor(name=name, license_number=license_number, salt=salt)
    
    try:
        db.session.add(sponsor)
        db.session.commit()
        return jsonify({
            'message': 'Спонсор успешно зарегистрирован',
            'sponsor_id': sponsor.id,
            'salt': sponsor.salt  # В реальном приложении соль нужно хранить безопасно
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@api.route('/cos/upload', methods=['POST'])
def upload_cos_records():
    """Загрузка записей CoS спонсором (только хеши)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Нет данных'}), 400
    
    sponsor_license = data.get('license_number')
    records = data.get('records', [])
    
    if not sponsor_license or not records:
        return jsonify({'error': 'Номер лицензии и записи обязательны'}), 400
    
    # Поиск спонсора
    sponsor = Sponsor.query.filter_by(license_number=sponsor_license).first()
    if not sponsor:
        return jsonify({'error': 'Спонсор не найден'}), 404
    
    if not sponsor.is_active:
        return jsonify({'error': 'Спонсор не активен'}), 403
    
    uploaded_count = 0
    errors = []
    
    for record in records:
        try:
            cos_number = record.get('cos_number')
            first_name = record.get('first_name')
            last_name = record.get('last_name')
            passport = record.get('passport')
            date_of_birth = record.get('date_of_birth')
            
            if not all([cos_number, first_name, last_name, passport, date_of_birth]):
                errors.append(f"Пропущены обязательные поля для CoS {cos_number}")
                continue
            
            # Хеширование всех данных с солью спонсора
            cos_record = CosRecord(
                cos_number=cos_number,
                cos_number_hash=hash_data(cos_number, sponsor.salt),
                first_name_hash=hash_data(first_name.upper(), sponsor.salt),
                last_name_hash=hash_data(last_name.upper(), sponsor.salt),
                passport_hash=hash_data(passport.upper(), sponsor.salt),
                date_of_birth_hash=hash_data(date_of_birth, sponsor.salt),
                sponsor_id=sponsor.id
            )
            
            db.session.add(cos_record)
            uploaded_count += 1
            
        except Exception as e:
            errors.append(f"Ошибка при обработке записи: {str(e)}")
    
    try:
        db.session.commit()
        return jsonify({
            'message': f'Успешно загружено {uploaded_count} записей',
            'errors': errors if errors else None
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@api.route('/cos/verify', methods=['POST'])
def verify_cos():
    """Проверка соответствия CoS данным работника"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Нет данных'}), 400
    
    cos_number = data.get('cos_number')
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    passport = data.get('passport')
    date_of_birth = data.get('date_of_birth')
    
    if not all([cos_number, first_name, last_name]):
        return jsonify({'error': 'CoS номер, имя и фамилия обязательны'}), 400
    
    # Поиск записи по номеру CoS
    cos_record = CosRecord.query.filter_by(cos_number=cos_number, is_verified=True).first()
    
    if not cos_record:
        return jsonify({
            'verified': False,
            'message': 'CoS не найден в системе'
        }), 200
    
    # Проверка спонсора
    sponsor = cos_record.sponsor
    if not sponsor.is_active:
        return jsonify({
            'verified': False,
            'message': 'Спонсор более не активен'
        }), 200
    
    # Хеширование введенных данных
    input_first_name_hash = hash_data(first_name.upper(), sponsor.salt)
    input_last_name_hash = hash_data(last_name.upper(), sponsor.salt)
    
    # Проверка соответствия
    name_match = (
        input_first_name_hash == cos_record.first_name_hash and
        input_last_name_hash == cos_record.last_name_hash
    )
    
    # Дополнительная проверка паспорта и даты рождения (если предоставлены)
    full_match = name_match
    if passport:
        input_passport_hash = hash_data(passport.upper(), sponsor.salt)
        full_match = full_match and (input_passport_hash == cos_record.passport_hash)
    
    if date_of_birth:
        input_dob_hash = hash_data(date_of_birth, sponsor.salt)
        full_match = full_match and (input_dob_hash == cos_record.date_of_birth_hash)
    
    if name_match:
        return jsonify({
            'verified': True,
            'full_match': full_match,
            'message': 'CoS принадлежит указанному лицу' if full_match else 'CoS найден, но данные не полностью совпадают',
            'sponsor_name': sponsor.name,
            'cos_number': cos_number
        }), 200
    else:
        return jsonify({
            'verified': False,
            'message': 'Данные не соответствуют этому CoS. Возможная попытка мошенничества!',
            'warning': 'Этот CoS был выдан другому человеку'
        }), 200

@api.route('/sponsors/<int:sponsor_id>/stats', methods=['GET'])
def get_sponsor_stats(sponsor_id):
    """Получение статистики спонсора"""
    sponsor = Sponsor.query.get_or_404(sponsor_id)
    
    total_cos = CosRecord.query.filter_by(sponsor_id=sponsor_id).count()
    verified_cos = CosRecord.query.filter_by(sponsor_id=sponsor_id, is_verified=True).count()
    
    return jsonify({
        'sponsor_name': sponsor.name,
        'total_cos_records': total_cos,
        'verified_cos_records': verified_cos,
        'license_number': sponsor.license_number
    }), 200
