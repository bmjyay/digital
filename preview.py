"""Run the portal with sample data instead of the real database.

For looking at the design locally when you don't have the MySQL credentials:

    python3 preview.py

Then open http://localhost:3030. Any email and code will log you in.
Nothing is saved, and the organizer upload/match tools won't work.
"""
import sys
import types


class PreviewDB:
    def __init__(self):
        self.friends = {3}
        self.incoming = {2}
        self.outgoing = set()

    def portal_info(self, email):
        return {
            "name": "Amina Khan",
            "email": email,
            "hostees": [
                {"name": "Sara Malik", "email": "sara.malik@princeton.edu", "phone": "(609) 555-0142"},
                {"name": "Huda Rahman", "email": "hrahman@cornell.edu", "phone": ""},
            ],
        }

    def sign_in(self, email, code):
        return {"u_id": 1, "h_id": 1}

    def fetch_all_users(self):
        return [
            {"u_id": 1, "name": "Amina Khan", "email": "amina.khan@yale.edu"},
            {"u_id": 2, "name": "Zainab Noor", "email": "zainab.noor@yale.edu"},
            {"u_id": 3, "name": "Maryam Ali", "email": "maryam.ali@yale.edu"},
            {"u_id": 4, "name": "Fatima Hassan", "email": "fatima.hassan@yale.edu"},
        ]

    def fetch_friends(self, u_id, kind):
        return [{"u_id": i} for i in self.friends]

    def fetch_incoming_requests(self, u_id):
        return [{"u_id": i} for i in self.incoming]

    def fetch_outgoing_requests(self, u_id):
        return [{"u_id": i} for i in self.outgoing]

    def add_friend(self, u_id, friend):
        self.outgoing.add(int(friend))
        return {"ok": True}

    def accept_request(self, u_id, friend):
        self.incoming.discard(int(friend))
        self.friends.add(int(friend))
        return {"ok": True}

    def decline_request(self, u_id, friend):
        self.outgoing.discard(int(friend))
        self.incoming.discard(int(friend))
        return {"ok": True}

    def remove_friend(self, u_id, friend):
        self.friends.discard(int(friend))
        return {"ok": True}

    def post_feedback(self, *args):
        pass

    def get_feedback(self):
        return []


# Stand in for db.py so app.py never tries to reach MySQL.
fake_db = types.ModuleType("db")
fake_db.IMCDB = PreviewDB
sys.modules["db"] = fake_db

from app import create_app  # noqa: E402

if __name__ == "__main__":
    print("Preview mode: sample data, no database. Open http://localhost:3030")
    create_app().run(host="0.0.0.0", port=3030, debug=True)
