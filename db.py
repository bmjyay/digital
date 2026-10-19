import mysql.connector
import csv
import sys
from dotenv import load_dotenv
import os
from datetime import datetime
import random

load_dotenv()

RDS_HOST = os.getenv("RDS_HOST")
RDS_PORT = int(os.getenv("RDS_PORT", "3306"))
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_NAME = os.getenv("DB_NAME")
DEMO_MODE = os.getenv("DEMO_MODE") == "1"


def db_connect():
    if DEMO_MODE:
        from demo_db import demo_connect
        return demo_connect()
    try:
        conn = mysql.connector.connect(
            host=RDS_HOST,
            port=RDS_PORT,
            user=DB_USER,
            password=DB_PASS,
            database=DB_NAME,
        )
        conn.autocommit = True
        cursor = conn.cursor()
        return conn, cursor
    except Exception as e:
        sys.stderr.write(f"Cannot connect to database: {e}\n")
        sys.exit(1)


class IMCDB:
    def __init__(self):
        self.conn, self.cursor = db_connect()
    def upload(self, hosts_file, hostees_file):
        self.cursor.execute("SET FOREIGN_KEY_CHECKS = 0")

        try:
            self.cursor.execute("TRUNCATE TABLE feedback")
            self.cursor.execute("TRUNCATE TABLE friendships")
            self.cursor.execute("TRUNCATE TABLE users")
            self.cursor.execute("TRUNCATE TABLE hostees")
            self.cursor.execute("TRUNCATE TABLE hosts")

            host_reader = csv.reader(
                hosts_file.stream.read().decode("utf-8").splitlines(), delimiter="|"
            )
            hostees_reader = csv.reader(
                hostees_file.stream.read().decode("utf-8").splitlines(), delimiter=","
            )

            for row in host_reader:
                self.cursor.execute(
                    "INSERT INTO hosts (name, gender, email, phone, capacity) VALUES (%s, %s, %s, %s, %s)",
                    (row[0], row[3], row[1], row[2], int(row[4])),
                )

            for row in hostees_reader:
                self.cursor.execute(
                    "INSERT INTO hostees (name, gender, email, phone) VALUES (%s, %s, %s, %s)",
                    (row[0], row[3], row[1], row[2]),
                )
        finally:
            self.cursor.execute("SET FOREIGN_KEY_CHECKS = 1")

    def find_host(self, name):
        try:
            self.cursor.execute(
                "SELECT * FROM hosts WHERE LOWER(hosts.name) = LOWER(%s)", (name,)
            )
            person = {}
            for host in self.cursor:
                person.update(
                    {
                        "h_id": host[0],
                        "name": host[1],
                        "gender": host[2],
                        "email": host[3],
                        "phone": host[4],
                        "capacity": host[5],
                    }
                )
            return person if person else {"error": "Host not found."}
        except Exception as e:
            print(e)
            return {"error": "Host lookup failed."}

    def find_hostee(self, name):
        try:
            self.cursor.execute(
                "SELECT * FROM hostees WHERE LOWER(hostees.name) = LOWER(%s)", (name,)
            )
            person = {}
            for hostee in self.cursor:
                person.update(
                    {
                        "he_id": hostee[0],
                        "name": hostee[1],
                        "gender": hostee[2],
                        "email": hostee[3],
                        "phone": hostee[4],
                        "h_id": hostee[5],
                    }
                )
            return person if person else {"error": "Hostee not found."}
        except Exception as e:
            print(e)
            return {"error": "Hostee lookup failed."}

    def get_hostees(self, name):
        host = self.find_host(name)
        if "error" in host:
            return []
        self.cursor.execute(
            "SELECT name FROM hostees WHERE hostees.h_id = %s", (host["h_id"],)
        )
        return [row[0] for row in self.cursor.fetchall()]

    def get_host(self, h_id):
        self.cursor.execute(
            "SELECT name, email, phone FROM hosts WHERE hosts.h_id = %s", (h_id,)
        )
        host = self.cursor.fetchone()
        if not host:
            return {"name": "", "email": "", "phone": ""}
        return {"name": host[0], "email": host[1], "phone": host[2]}

    def match(self, host_name, hostee_name):
        host = self.find_host(host_name)
        hostee = self.find_hostee(hostee_name)
        if "error" in host or "error" in hostee:
            return
        self.cursor.execute(
            "UPDATE hostees SET h_id = %s WHERE he_id = %s",
            (host["h_id"], hostee["he_id"]),
        )

    def pre_match(self, prematches_file):
        prematch_reader = csv.reader(
            prematches_file.stream.read().decode("utf-8").splitlines(), delimiter="|"
        )
        for row in prematch_reader:
            self.match(row[0], row[1])

    def match_all(self, gender):
        hosts = []
        hostees = []

        self.cursor.execute("SELECT * FROM hosts WHERE gender = %s", (gender,))
        for host in self.cursor.fetchall():
            hosts.append(
                {
                    "h_id": host[0],
                    "name": host[1],
                    "gender": host[2],
                    "email": host[3],
                    "phone": host[4],
                    "capacity": host[5],
                }
            )

        for host in hosts:
            self.cursor.execute(
                "SELECT COUNT(*) FROM hostees WHERE h_id = %s", (host["h_id"],)
            )
            prematches = self.cursor.fetchone()[0]
            host["capacity"] -= prematches

        self.cursor.execute("SELECT * FROM hostees WHERE gender = %s", (gender,))
        for hostee in self.cursor.fetchall():
            hostees.append(
                {
                    "he_id": hostee[0],
                    "name": hostee[1],
                    "gender": hostee[2],
                    "email": hostee[3],
                    "phone": hostee[4],
                    "h_id": hostee[5],
                }
            )

        hostees = [h for h in hostees if h["h_id"] is None]

        supply = sum(h["capacity"] for h in hosts)
        demand = len(hostees)

        if supply < demand:
            print(
                f"Not enough hosts. We have {demand} hostees and can only accommodate {supply} people."
            )
            return
        else:
            print(
                f"Perfect! We have {demand} hostees, {supply} spots, with {supply - demand} spots remaining."
            )

        host_index = 0
        hostees_index = 0
        while hostees_index < demand:
            if hosts[host_index]["capacity"] > 0:
                self.match(hosts[host_index]["name"], hostees[hostees_index]["name"])
                hosts[host_index]["capacity"] -= 1
                hostees_index += 1
            else:
                host_index += 1
                if host_index >= len(hosts):
                    host_index = 0
                continue

            host_index += 1
            if host_index >= len(hosts):
                host_index = 0

    def create_spreadsheet(self, csv_path, txt_path):
        final = ""
        all_hosts = []
        all_hostees = []

        self.cursor.execute("SELECT * FROM hosts")
        for host in self.cursor.fetchall():
            all_hosts.append(
                {
                    "h_id": host[0],
                    "name": host[1],
                    "gender": host[2],
                    "email": host[3],
                    "phone": host[4],
                    "capacity": host[5],
                }
            )

        self.cursor.execute("SELECT * FROM hostees")
        for hostee in self.cursor.fetchall():
            all_hostees.append(
                {
                    "he_id": hostee[0],
                    "name": hostee[1],
                    "gender": hostee[2],
                    "email": hostee[3],
                    "phone": hostee[4],
                    "h_id": hostee[5],
                }
            )

        with open(txt_path, "w") as f1:
            for k in range(len(all_hosts)):
                f1.write(
                    f'Host: {all_hosts[k]["name"]} | {all_hosts[k]["email"]} | {all_hosts[k]["phone"]}\n'
                )
                hostees = self.get_hostees(all_hosts[k]["name"])
                for i in range(len(hostees)):
                    info = self.find_hostee(hostees[i])
                    f1.write(
                        f'Hostee {i + 1}: {hostees[i]} | {info.get("email","")} | {info.get("phone","")}\n'
                    )
                f1.write("\n")

        for host in all_hosts:
            hostees = self.get_hostees(host["name"])
            final += (
                f"{host['name']}|{host['email']}|{host['name']}|{host['phone']}|{host['email']}|{', '.join(hostees)}\n"
            )

        for hostee in all_hostees:
            host = self.get_host(hostee["h_id"])
            hostees = self.get_hostees(host["name"])
            final += (
                f"{hostee['name']}|{hostee['email']}|{host['name']}|{host['phone']}|{host['email']}|{', '.join(hostees)}\n"
            )

        with open(csv_path, "w") as f2:
            f2.write(final)

    def portal_info(self, email):
        self.cursor.execute("SELECT name, email, phone FROM hosts WHERE email = %s", (email,))
        host_cursor = self.cursor.fetchone()
        if not host_cursor:
            return None

        host = {"name": host_cursor[0], "email": host_cursor[1], "phone": host_cursor[2]}
        hostees_names = self.get_hostees(host["name"])

        hostees = []
        for name in hostees_names:
            person = self.find_hostee(name)
            if "error" in person:
                continue
            hostees.append({"name": person["name"], "email": person["email"], "phone": person["phone"]})

        return {"name": host["name"], "email": host["email"], "phone": host["phone"], "hostees": hostees}

    def import_users(self):
        self.cursor.execute("UPDATE users SET h_id = NULL")
        self.cursor.execute("DELETE FROM users")
        self.cursor.execute("SELECT h_id FROM hosts")
        hosts = self.cursor.fetchall()
        for host in hosts:
            #nonce = random.randrange(1000, 9999)
            nonce = 1234 # only for demo
            self.cursor.execute(
                "INSERT INTO users (h_id, password) VALUES (%s, %s)", (host[0], nonce)
            )

    def sign_in(self, email, password):
        self.cursor.execute("SELECT h_id FROM hosts WHERE email = %s", (email,))
        try:
            h_id = self.cursor.fetchone()[0]
        except Exception:
            return {"error": "This email is not associated with a Yale host."}

        try:
            self.cursor.execute(
                "SELECT u_id, h_id FROM users WHERE h_id = %s AND password = %s",
                (h_id, password),
            )
            account_cursor = self.cursor.fetchone()
            account = {"u_id": account_cursor[0], "h_id": account_cursor[1]}
        except Exception:
            return {"error": "Incorrect password."}

        return account

    def post_feedback(self, u_id, feedback, category):
        timestamp = datetime.now()
        self.cursor.execute(
            "INSERT INTO feedback (u_id, published_at, content, category) VALUES (%s, %s, %s, %s)",
            (u_id, timestamp, feedback, category),
        )

    def get_feedback(self):
        self.cursor.execute(
            """SELECT feedback.f_id, feedback.u_id, feedback.published_at, feedback.content, feedback.category,
                      hosts.name, hosts.email
                 FROM feedback
                 JOIN users ON feedback.u_id = users.u_id
                 JOIN hosts ON users.h_id = hosts.h_id"""
        )
        feedback_cursor = self.cursor.fetchall()
        results = []
        for feedback in feedback_cursor:
            ts = feedback[2]
            try:
                published_at = ts.isoformat(sep=" ", timespec="seconds")
            except Exception:
                published_at = str(ts)

            results.append(
                {
                    "f_id": feedback[0],
                    "u_id": feedback[1],
                    "published_at": published_at,
                    "content": feedback[3],
                    "category": feedback[4],
                    "name": feedback[5],
                    "email": feedback[6],
                }
            )
        return results
    
    def fetch_all_users(self):
        self.cursor.execute(
            "SELECT users.u_id, hosts.name, hosts.email FROM users JOIN hosts ON users.h_id = hosts.h_id"
        )
        users_cursor = self.cursor.fetchall()
        return [{"u_id": u[0], "name": u[1], "email": u[2]} for u in users_cursor]

    def check_friendship(self, user1, user2, category):
        if user1 == user2:
            return False
        try:
            self.cursor.execute(
                """SELECT * FROM friendships
                   WHERE ((user1 = %s AND user2 = %s) OR (user1 = %s AND user2 = %s))
                     AND status = %s""",
                (user1, user2, user2, user1, category),
            )
        except Exception:
            return False

        return len(self.cursor.fetchall()) > 0

    def add_friend(self, user_u_id, friend_u_id):
        isFriends = self.check_friendship(user_u_id, friend_u_id, "friends")
        if isFriends:
            return {"error": "Users are already friends."}

        isRequested = self.check_friendship(user_u_id, friend_u_id, "requested")
        if isRequested:
            return {"error": "Friend request already sent."}

        timestamp = datetime.now()
        self.cursor.execute(
            "INSERT INTO friendships (user1, user2, status, requested_at, accepted_at) VALUES (%s, %s, %s, %s, %s)",
            (user_u_id, friend_u_id, "requested", timestamp, None),
        )
        return {"message": "Friend request sent."}

    def remove_friend(self, user_u_id, friend_u_id):
        isFriends = self.check_friendship(user_u_id, friend_u_id, "friends")
        if not isFriends:
            return {"error": "Users are not friends already."}

        self.cursor.execute(
            """DELETE FROM friendships
               WHERE ((user1 = %s AND user2 = %s) OR (user1 = %s AND user2 = %s))
                 AND status = %s""",
            (user_u_id, friend_u_id, friend_u_id, user_u_id, "friends"),
        )
        return {"message": "Friend removed."}

    def accept_request(self, user_u_id, friend_u_id):
        isRequested = self.check_friendship(user_u_id, friend_u_id, "requested")
        if not isRequested:
            return {"error": "Friend request not found."}

        timestamp = datetime.now()
        self.cursor.execute(
            """UPDATE friendships
                  SET accepted_at = %s,
                      status = %s
                WHERE ((user1 = %s AND user2 = %s) OR (user1 = %s AND user2 = %s))
                  AND status = %s""",
            (timestamp, "friends", user_u_id, friend_u_id, friend_u_id, user_u_id, "requested"),
        )
        return {"message": "Friend request accepted."}

    def decline_request(self, user_u_id, friend_u_id):
        isRequested = self.check_friendship(user_u_id, friend_u_id, "requested")
        if not isRequested:
            return {"error": "Friend request not found."}

        self.cursor.execute(
            """DELETE FROM friendships
               WHERE ((user1 = %s AND user2 = %s) OR (user1 = %s AND user2 = %s))
                 AND status = %s""",
            (user_u_id, friend_u_id, friend_u_id, user_u_id, "requested"),
        )
        return {"message": "Friend request declined."}

    def fetch_friends(self, user_u_id, category):
        """For category='friends' this returns mutual matches. For 'requested', use the directional methods."""
        self.cursor.execute(
            """SELECT users.u_id, hosts.name, hosts.email
               FROM (
                    SELECT CASE WHEN user1 = %s THEN user2 ELSE user1 END AS friend_id
                      FROM friendships
                     WHERE (user1 = %s OR user2 = %s) AND status = %s
               ) AS f
               JOIN users ON users.u_id = f.friend_id
               JOIN hosts ON hosts.h_id = users.h_id""",
            (user_u_id, user_u_id, user_u_id, category),
        )
        friends_cursor = self.cursor.fetchall()
        return [{"u_id": f[0], "name": f[1], "email": f[2]} for f in friends_cursor]

    def fetch_incoming_requests(self, user_u_id):
        """Requests where someone else waved at you (user2 == you)."""
        self.cursor.execute(
            """SELECT users.u_id, hosts.name, hosts.email
                 FROM friendships
                 JOIN users ON users.u_id = friendships.user1
                 JOIN hosts ON hosts.h_id = users.h_id
                WHERE friendships.user2 = %s AND friendships.status = %s""",
            (user_u_id, "requested"),
        )
        rows = self.cursor.fetchall()
        return [{"u_id": r[0], "name": r[1], "email": r[2]} for r in rows]

    def fetch_outgoing_requests(self, user_u_id):
        """Requests you sent (user1 == you)."""
        self.cursor.execute(
            """SELECT users.u_id, hosts.name, hosts.email
                 FROM friendships
                 JOIN users ON users.u_id = friendships.user2
                 JOIN hosts ON hosts.h_id = users.h_id
                WHERE friendships.user1 = %s AND friendships.status = %s""",
            (user_u_id, "requested"),
        )
        rows = self.cursor.fetchall()
        return [{"u_id": r[0], "name": r[1], "email": r[2]} for r in rows]

    def clear_matches(self):
        """Clears hostee assignments and friendships."""
        self.cursor.execute("UPDATE hostees SET h_id = NULL")
        self.cursor.execute("TRUNCATE TABLE friendships")

    def close(self):
        self.conn.close()
