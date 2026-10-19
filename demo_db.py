"""In-memory SQLite stand-in for the MySQL database, used when DEMO_MODE=1.

Lets the portal run locally with sample data and no database credentials.
Every demo host signs in with code 1234 (see IMCDB.import_users).
"""
import re
import sqlite3
from datetime import datetime, timedelta

SCHEMA = """
CREATE TABLE hosts (
    h_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, gender TEXT, email TEXT, phone TEXT, capacity INTEGER
);
CREATE TABLE hostees (
    he_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, gender TEXT, email TEXT, phone TEXT, h_id INTEGER
);
CREATE TABLE users (
    u_id INTEGER PRIMARY KEY AUTOINCREMENT,
    h_id INTEGER, password TEXT
);
CREATE TABLE friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1 INTEGER, user2 INTEGER, status TEXT, requested_at TEXT, accepted_at TEXT
);
CREATE TABLE feedback (
    f_id INTEGER PRIMARY KEY AUTOINCREMENT,
    u_id INTEGER, published_at TEXT, content TEXT, category TEXT
);
CREATE TABLE recommendations (
    r_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, category TEXT NOT NULL, address TEXT, url TEXT, description TEXT
);
CREATE TABLE events (
    e_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL, category TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT,
    location TEXT, description TEXT
);
"""

# name, gender, email, phone, capacity
HOSTS = [
    ("Sarah Mahmoud", "Female", "sarah.mahmoud@yale.edu", "203-555-0101", 2),
    ("Aisha Khan", "Female", "aisha.khan@yale.edu", "203-555-0102", 2),
    ("Maryam Siddiqui", "Female", "maryam.siddiqui@yale.edu", "203-555-0103", 1),
    ("Omar Ali", "Male", "omar.ali@yale.edu", "203-555-0104", 2),
    ("Yusuf Rahman", "Male", "yusuf.rahman@yale.edu", "203-555-0105", 2),
    ("Bilal Hussain", "Male", "bilal.hussain@yale.edu", "203-555-0106", 1),
]

# name, gender, email, phone, host name (or None if unmatched)
HOSTEES = [
    ("Layla Hassan", "Female", "layla.hassan@harvard.edu", "617-555-0111", "Sarah Mahmoud"),
    ("Noor Abdullah", "Female", "noor.abdullah@princeton.edu", "609-555-0112", "Sarah Mahmoud"),
    ("Fatima Zahra", "Female", "fatima.zahra@columbia.edu", "212-555-0113", "Aisha Khan"),
    ("Hana Yilmaz", "Female", "hana.yilmaz@brown.edu", "401-555-0114", "Maryam Siddiqui"),
    ("Ibrahim Diallo", "Male", "ibrahim.diallo@upenn.edu", "215-555-0115", "Omar Ali"),
    ("Zaid Karim", "Male", "zaid.karim@cornell.edu", "607-555-0116", "Omar Ali"),
    ("Hamza Qureshi", "Male", "hamza.qureshi@dartmouth.edu", "603-555-0117", "Yusuf Rahman"),
]

# (from, to, status) by host name; demo users' u_id follows HOSTS order
FRIENDSHIPS = [
    ("Aisha Khan", "Sarah Mahmoud", "requested"),
    ("Sarah Mahmoud", "Maryam Siddiqui", "friends"),
    ("Sarah Mahmoud", "Omar Ali", "requested"),
]


# name, category, address, url, description
RECOMMENDATIONS = [
    ("Arwa Cafe", "cafe", "", "", "Cozy spot for coffee and pastries between sessions."),
    ("Atticus Bookstore Cafe", "cafe", "1082 Chapel St, New Haven, CT", "",
     "Great coffee and soup surrounded by bookshelves."),
    ("Starbucks Coffee", "cafe", "", "", "Reliable caffeine close to campus."),
    ("Mamoun's Falafel", "restaurant", "85 Howe St, New Haven, CT", "",
     "Late-night Middle Eastern classic, popular with conference attendees."),
    ("Claire's Corner Copia", "restaurant", "1000 Chapel St, New Haven, CT", "",
     "Vegetarian comfort food and famous carrot cake."),
    ("Yale University Art Gallery", "activity", "1111 Chapel St, New Haven, CT", "",
     "Free admission and an excellent Islamic art collection."),
    ("East Rock Park", "activity", "", "", "Short hike with the best view of New Haven."),
]

# day offset from the first conference day, start, end, title, category, location, description
EVENTS = [
    (0, "16:00", "18:00", "Check-in & housing pickup", "general", "Dwight Hall, Yale",
     "Collect your badge and meet your host."),
    (0, "18:15", "18:30", "Maghrib prayer", "prayer", "Dwight Chapel", ""),
    (0, "19:00", "21:00", "Opening dinner", "meal", "Commons, Schwarzman Center",
     "Welcome remarks and dinner with all attendees."),
    (1, "09:00", "10:00", "Breakfast", "meal", "Commons, Schwarzman Center", ""),
    (1, "10:15", "11:45", "Keynote address", "session", "Woolsey Hall, Yale",
     "Opening keynote followed by Q&A."),
    (1, "12:30", "12:45", "Dhuhr prayer", "prayer", "Dwight Chapel", ""),
    (1, "14:00", "16:00", "Breakout workshops", "session", "Linsly-Chittenden Hall",
     "Choose from four student-led workshops."),
    (1, "20:00", "22:00", "Community night", "social", "Schwarzman Center",
     "Nasheeds, games and dessert."),
    (2, "10:00", "11:30", "Closing brunch", "meal", "Commons, Schwarzman Center",
     "Farewell brunch and closing reflections."),
]


def _first_conference_day():
    """The demo conference always starts on the coming Friday."""
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    return today + timedelta(days=(4 - today.weekday()) % 7)


class _DemoCursor:
    """Accepts the MySQL-flavoured SQL that IMCDB issues and runs it on SQLite."""

    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, sql, params=()):
        statement = sql.strip()
        if statement.upper().startswith("SET FOREIGN_KEY_CHECKS"):
            return self
        statement = re.sub(r"^TRUNCATE\s+TABLE\s+(\w+)", r"DELETE FROM \1", statement, flags=re.I)
        params = tuple(p.isoformat(sep=" ") if isinstance(p, datetime) else p for p in params)
        self._cursor.execute(statement.replace("%s", "?"), params)
        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def __iter__(self):
        return iter(self._cursor)


def _seed(cursor):
    cursor.executescript(SCHEMA)
    for host in HOSTS:
        cursor.execute(
            "INSERT INTO hosts (name, gender, email, phone, capacity) VALUES (?, ?, ?, ?, ?)", host
        )
    host_ids = {name: i + 1 for i, (name, *_rest) in enumerate(HOSTS)}
    for name, gender, email, phone, host_name in HOSTEES:
        cursor.execute(
            "INSERT INTO hostees (name, gender, email, phone, h_id) VALUES (?, ?, ?, ?, ?)",
            (name, gender, email, phone, host_ids.get(host_name)),
        )
    for h_id in host_ids.values():
        cursor.execute("INSERT INTO users (h_id, password) VALUES (?, ?)", (h_id, "1234"))
    for rec in RECOMMENDATIONS:
        cursor.execute(
            "INSERT INTO recommendations (name, category, address, url, description) VALUES (?, ?, ?, ?, ?)",
            rec,
        )
    first_day = _first_conference_day()
    for offset, start, end, title, category, location, description in EVENTS:
        day = (first_day + timedelta(days=offset)).strftime("%Y-%m-%d")
        cursor.execute(
            "INSERT INTO events (title, category, start_time, end_time, location, description) VALUES (?, ?, ?, ?, ?, ?)",
            (title, category, f"{day} {start}", f"{day} {end}", location, description),
        )
    now = datetime.now().isoformat(sep=" ", timespec="seconds")
    for user1, user2, status in FRIENDSHIPS:
        cursor.execute(
            "INSERT INTO friendships (user1, user2, status, requested_at, accepted_at) VALUES (?, ?, ?, ?, ?)",
            (host_ids[user1], host_ids[user2], status, now, now if status == "friends" else None),
        )


def demo_connect():
    conn = sqlite3.connect(":memory:", check_same_thread=False, isolation_level=None)
    cursor = conn.cursor()
    _seed(cursor)
    return conn, _DemoCursor(cursor)
