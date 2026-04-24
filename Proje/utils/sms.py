from twilio.rest import Client

def send_sms(to, message):
    # Replace with your Twilio credentials
    account_sid = 'your_account_sid'
    auth_token = 'your_auth_token'
    client = Client(account_sid, auth_token)

    try:
        message = client.messages.create(
            body=message,
            from_='+1234567890',  # Your Twilio number
            to=to
        )
        print(f"SMS sent: {message.sid}")
        return True
    except Exception as e:
        print(f"Failed to send SMS: {e}")
        return False