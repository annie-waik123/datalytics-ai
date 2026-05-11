import requests
import json
import jwt
from datetime import datetime, timedelta

SECRET_KEY = 'super-secret-key-datalytics'
payload = {
    'sub': 'singhsangam5400@gmail.com',
    'role': 'admin',
    'exp': datetime.utcnow() + timedelta(minutes=720)
}
token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')

data = {
    'userIds': ['all'],
    'subject': 'Test',
    'body': 'Test body',
    'type': 'announcement'
}
try:
    res = requests.post('http://localhost:8000/api/admin/emails/send', json=data, headers={'Authorization': f'Bearer {token}'})
    print('STATUS_CODE:', res.status_code)
    print('RESPONSE:', res.text)
except Exception as e:
    print('Error:', e)
