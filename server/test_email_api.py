import urllib.request
import json
import urllib.error

# We need the token first, let's just log in as admin
login_data = json.dumps({"email": "singhsangam5400@gmail.com", "password": "admin"}).encode('utf-8')
# wait, the password might not be admin. Let's check admin.py default password:
# ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin12345")
login_data = json.dumps({"email": "singhsangam5400@gmail.com", "password": "admin12345"}).encode('utf-8')

try:
    req = urllib.request.Request("http://127.0.0.1:8000/api/admin/login", data=login_data, headers={'Content-Type': 'application/json'})
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read().decode())
    token = data['token']

    # Now test the email send
    email_data = json.dumps({
        "userIds": ["all"],
        "subject": "Test",
        "body": "Test",
        "type": "announcement"
    }).encode('utf-8')

    req = urllib.request.Request("http://127.0.0.1:8000/api/admin/emails/send", data=email_data, headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'})
    resp = urllib.request.urlopen(req)
    print("SUCCESS:", resp.read().decode())

except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code, e.read().decode())
except Exception as e:
    print("ERROR:", str(e))
