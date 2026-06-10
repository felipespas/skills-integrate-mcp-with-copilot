"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import FastAPI, HTTPException, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import secrets
import os
import json
import time
from collections import OrderedDict
from pathlib import Path

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")


class LoginRequest(BaseModel):
    username: str
    password: str


TEACHERS_FILE = current_dir / "teachers.json"

with open(TEACHERS_FILE, "r", encoding="utf-8") as file:
    teacher_data = json.load(file)

teacher_credentials = {
    teacher["username"]: teacher["password"]
    for teacher in teacher_data.get("teachers", [])
}

TOKEN_TTL_SECONDS = 60 * 60
MAX_ACTIVE_ADMIN_TOKENS = 1000
active_admin_tokens = OrderedDict()

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


def cleanup_expired_tokens() -> None:
    """Remove expired admin sessions from the in-memory token store."""
    now = time.time()
    expired_tokens = [
        token
        for token, session in active_admin_tokens.items()
        if session["expires_at"] <= now
    ]

    for token in expired_tokens:
        active_admin_tokens.pop(token, None)


def get_teacher_username(authorization: str) -> str:
    """Return the teacher username associated with the bearer token."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Teacher login required")

    token = authorization.replace("Bearer ", "", 1).strip()
    cleanup_expired_tokens()
    session = active_admin_tokens.get(token)

    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return session["username"]


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.post("/auth/login")
def login_as_teacher(login_request: LoginRequest):
    """Authenticate a teacher and create an admin session token."""
    expected_password = teacher_credentials.get(login_request.username)

    if expected_password != login_request.password:
        raise HTTPException(status_code=401, detail="Invalid teacher credentials")

    cleanup_expired_tokens()
    token = secrets.token_urlsafe(24)
    while len(active_admin_tokens) >= MAX_ACTIVE_ADMIN_TOKENS:
        active_admin_tokens.popitem(last=False)

    active_admin_tokens[token] = {
        "username": login_request.username,
        "expires_at": time.time() + TOKEN_TTL_SECONDS,
    }

    return {
        "message": "Teacher login successful",
        "token": token,
        "username": login_request.username,
    }


@app.post("/auth/logout")
def logout_teacher(authorization: str = Header(default="")):
    """Invalidate the current admin session token."""
    if authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "", 1).strip()
        active_admin_tokens.pop(token, None)

    return {"message": "Logged out"}


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str, _teacher: str = Header(default="", alias="Authorization")):
    """Sign up a student for an activity"""
    get_teacher_username(_teacher)

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, _teacher: str = Header(default="", alias="Authorization")):
    """Unregister a student from an activity"""
    get_teacher_username(_teacher)

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
