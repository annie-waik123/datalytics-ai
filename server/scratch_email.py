import smtplib
import ssl
from email.message import EmailMessage

SMTP_USERNAME = "DatalyticsOfficial@gmail.com"
SMTP_PASSWORD = "mxfnibjofpmxghpp"

msg = EmailMessage()
msg["Subject"] = "Test"
msg["From"] = f"DATALYTICS <{SMTP_USERNAME}>"
msg["To"] = "singhsangam1800@gmail.com"
msg.set_content("Test body")

try:
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        print("Success SSL")
except Exception as e:
    print(f"Failed SSL: {e}")

try:
    context = ssl.create_default_context()
    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        print("Success STARTTLS")
except Exception as e:
    print(f"Failed STARTTLS: {e}")
