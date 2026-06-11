# CoS Verify MVP - Certificate of Sponsorship Verification Platform

## Описание
Платформа для проверки подлинности номеров CoS (Certificate of Sponsorship) для сезонных рабочих Великобритании.

## Архитектура
- **Backend**: Python + Flask
- **Database**: SQLite (для MVP), легко мигрируется на PostgreSQL
- **Security**: Хеширование персональных данных (SHA-256 + соль)
- **Frontend**: HTML/CSS/JS (минималистичный интерфейс)

## Функционал MVP
1. **Для спонсоров**: Загрузка зашифрованных записей CoS
2. **Для работников**: Проверка соответствия CoS и личных данных
3. **Безопасность**: Данные хранятся только в захешированном виде

## Установка и запуск

```bash
# Установка зависимостей
pip install -r requirements.txt

# Запуск приложения
python app/main.py
```

Приложение будет доступно по адресу: http://localhost:5000

## Структура проекта
```
cos_verify_mvp/
├── app/
│   ├── __init__.py
│   ├── main.py          # Точка входа
│   ├── models.py        # Модели данных
│   ├── routes.py        # API маршруты
│   └── security.py      # Функции безопасности
├── templates/
│   ├── base.html
│   ├── index.html       # Главная страница
│   ├── sponsor.html     # Интерфейс спонсора
│   └── verify.html      # Страница проверки
├── static/
│   ├── css/
│   └── js/
├── requirements.txt
└── README.md
```

## Безопасность
- Персональные данные никогда не хранятся в открытом виде
- Используется хеширование с солью для каждого спонсора
- Соответствие принципам GDPR
