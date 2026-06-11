import hashlib
import secrets

def generate_salt():
    """Генерация криптографически стойкой соли"""
    return secrets.token_hex(16)

def hash_data(data: str, salt: str) -> str:
    """
    Хеширование данных с солью используя SHA-256
    Возвращает хеш в формате: hash(salt + data)
    """
    combined = salt + data
    return hashlib.sha256(combined.encode('utf-8')).hexdigest()

def verify_data(data: str, salt: str, expected_hash: str) -> bool:
    """
    Проверка соответствия данных хешу
    """
    computed_hash = hash_data(data, salt)
    return computed_hash == expected_hash

def create_sponsor_token(sponsor_name: str) -> str:
    """
    Создание уникального токена для спонсора
    Используется как соль для хеширования данных работников
    """
    # Генерируем соль на основе имени спонсора и случайного значения
    random_part = secrets.token_hex(8)
    combined = f"{sponsor_name}:{random_part}"
    return hash_data(combined, "master_salt_cos_verify")
