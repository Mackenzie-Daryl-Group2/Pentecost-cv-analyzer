import os
import streamlit as st
from twilio.rest import Client
from streamlit.errors import StreamlitSecretNotFoundError

def send_sms(to, message):
    try:
        twilio_secrets = st.secrets.get("twilio", {})
    except StreamlitSecretNotFoundError:
        twilio_secrets = {}

    account_sid = twilio_secrets.get("account_sid", os.getenv("TWILIO_ACCOUNT_SID"))
    auth_token = twilio_secrets.get("auth_token", os.getenv("TWILIO_AUTH_TOKEN"))
    from_number = twilio_secrets.get("from_number", os.getenv("TWILIO_FROM_NUMBER"))

    if not all([account_sid, auth_token, from_number]):
        print("Failed to send SMS: Twilio credentials not configured.")
        return False

    try:
        client = Client(account_sid, auth_token)
        message = client.messages.create(
            body=message,
            from_=from_number,
            to=to
        )
        print(f"SMS sent: {message.sid}")
        return True
    except Exception as e:
        print(f"Failed to send SMS: {e}")
        return False