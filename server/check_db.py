import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def check_users():
    uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("MONGODB_DB", "datalytics")
    client = AsyncIOMotorClient(uri)
    db = client[db_name]
    users = await db.users.find().to_list(100)
    print("USERS IN DB:")
    for u in users:
        print(f" - {u.get('email')} : {u.get('diamonds')} diamonds")
    client.close()

if __name__ == "__main__":
    asyncio.run(check_users())
