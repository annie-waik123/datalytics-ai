import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import get_settings


def send_html_email(recipient_email: str, subject: str, html_content: str) -> None:
    settings = get_settings()
    if not settings.email_user or not settings.email_pass:
        print(f"[EMAIL MOCK] To: {recipient_email} | Subject: {subject}")
        return

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"DATALYTICS <{settings.email_user}>"
    message["To"] = recipient_email
    message.attach(MIMEText(html_content, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.email_user, settings.email_pass)
        server.sendmail(settings.email_user, recipient_email, message.as_string())


def otp_email_template(otp: str, purpose: str) -> str:
    action_text = "account verification" if purpose == "signup" else "secure login"
    return f"""
    <html>
      <body style="margin:0;padding:0;background:#f7f5ef;font-family:'Segoe UI',sans-serif;color:#1f2937;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 24px 60px rgba(180,83,9,0.18);">
                <tr>
                  <td style="padding:28px 36px;background:linear-gradient(135deg,#f97316,#fb7185,#facc15);color:#ffffff;">
                    <div style="font-weight:800;letter-spacing:0.12em;font-size:18px;">DATALYTICS</div>
                    <div style="margin-top:8px;font-size:14px;opacity:0.92;">Secure Access Layer</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:34px 36px;">
                    <h1 style="margin:0 0 12px;font-size:24px;color:#111827;">Your OTP for {action_text}</h1>
                    <p style="margin:0 0 20px;line-height:1.6;color:#4b5563;">
                      Enter this one-time code in the DATALYTICS app to continue.
                      The code expires in 10 minutes and can be used only once.
                    </p>
                    <div style="font-size:36px;letter-spacing:10px;font-weight:800;color:#111827;background:#fff7ed;border:1px solid #fed7aa;border-radius:16px;padding:20px 24px;text-align:center;">
                      {otp}
                    </div>
                    <p style="margin:20px 0 0;line-height:1.6;color:#6b7280;">
                      If you did not request this code, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """


def welcome_email_template(name: str) -> str:
    safe_name = name or "there"
    settings = get_settings()
    return f"""
    <html>
      <body style="margin:0;padding:0;background:#f5f7fb;font-family:'Segoe UI',sans-serif;color:#101828;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
          <tr>
            <td align="center">
              <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 24px 65px rgba(15,23,42,0.14);">
                <tr>
                  <td style="padding:34px 40px;background:linear-gradient(135deg,#0f172a,#1d4ed8,#06b6d4);color:#ffffff;">
                    <div style="font-size:12px;letter-spacing:0.2em;font-weight:700;opacity:0.88;">WELCOME TO</div>
                    <div style="font-size:30px;font-weight:800;letter-spacing:0.08em;margin-top:6px;">DATALYTICS</div>
                    <div style="margin-top:12px;font-size:15px;opacity:0.9;">Build faster insights with secure intelligence workflows.</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:38px 40px 28px;">
                    <h1 style="margin:0 0 14px;font-size:28px;color:#0f172a;">Hey {safe_name}, you are in.</h1>
                    <p style="margin:0 0 22px;line-height:1.7;color:#475467;font-size:16px;">
                      Your account is now active. DATALYTICS is ready to help you turn raw data into
                      confident product and business decisions.
                    </p>
                    <a href="{settings.frontend_url}/login" style="display:inline-block;padding:14px 24px;border-radius:12px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.02em;">
                      Get Started
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 40px 34px;color:#667085;font-size:13px;line-height:1.7;border-top:1px solid #eaecf0;">
                    Need help? Reply to this email and our team will assist you quickly.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """
