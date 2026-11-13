
import os
from urllib.parse import quote_plus
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(override=True)

MONGODB_URI = os.getenv("MONGODB_URI")

if not MONGODB_URI:
    raise ValueError("MONGODB_URI missing in .env")

# Encode username and password safely
prefix, rest = MONGODB_URI.split("://", 1)
credentials, address = rest.split("@", 1)
username, password = credentials.split(":", 1)

MONGODB_URI = (
    f"{prefix}://{quote_plus(username)}:"
    f"{quote_plus(password)}@{address}"
)

client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=15000
)

database = client["agentflow"]
conversations_collection = database["conversations"]


def test_database_connection():
    try:
        client.admin.command("ping")
        print("MongoDB connected successfully!")
        return True
    except Exception as error:
        print(f"MongoDB connection failed: {error}")
        return False


def close_database_connection():
    client.close()
