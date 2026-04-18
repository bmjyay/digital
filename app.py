from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    session,
    redirect,
    url_for,
    send_file,
)
from db import IMCDB
import os

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "changeme")

def create_app():
    app = Flask(__name__)
    app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret")  
    db = IMCDB()
    @app.get("/")
    def portal():
        """Main housing portal UI."""
        return render_template("portal.html")

    @app.get("/api/hosts")
    def get_hosts():
        email = session.get("user_email")
        if not email:
            return jsonify({"error": "Must be signed in."}), 401
        all_hosts = db.fetch_all_users()
        return jsonify({"hosts": all_hosts}), 200

    @app.get("/api/hostees")
    def get_hostees():
        """
        Lookup housing info by email.

        Expects:
            GET /api/hostees?email=first.last@yale.edu
        """
        email = (request.args.get("email") or "").strip().lower()
        if not email:
            email = session.get("user_email")

        if not email:
            return jsonify({"error": "Missing email"}), 400

        try:
            resp = db.portal_info(email)
        except Exception:
            app.logger.exception("Error in db.portal_info for %s", email)
            return jsonify({"error": "Lookup failed"}), 500

        if not resp:
            return jsonify({"error": "Not found"}), 404

        return (
            jsonify(
                {
                    "name": resp.get("name", ""),
                    "email": resp.get("email", ""),
                    "hostees": resp.get("hostees", []),
                }
            ),
            200,
        )

    @app.post("/api/auth/verify-code")
    def auth_verify_code():
        """Verify a one-time login code and establish a user session."""
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        code = (data.get("code") or "").strip()

        if not email or not code:
            return jsonify({"error": "Missing email or code"}), 400

        try:
            account = db.sign_in(email, code)
        except Exception:
            app.logger.exception("Error in db.sign_in during auth for %s", email)
            account = {"error": "Sign-in failed."}

        if not account or account.get("error"):
            return jsonify({"error": account.get("error", "Invalid email/code")}), 400

        u_id = account["u_id"]
        h_id = account["h_id"]

        try:
            info = db.portal_info(email) or {}
        except Exception:
            app.logger.exception("Error in db.portal_info for %s", email)
            info = {}

        name = info.get("name") or ""
        hostees = info.get("hostees", [])

        session.permanent = True
        session["user_email"] = email
        session["user_name"] = name
        session["user_u_id"] = u_id
        session["user_h_id"] = h_id

        return (
            jsonify(
                {
                    "email": email,
                    "name": name,
                    "u_id": u_id,
                    "h_id": h_id,
                    "hostees": hostees,
                }
            ),
            200,
        )

    @app.post("/api/logout")
    def api_logout():
        """Clear the current user's session (non-admin)."""
        for key in ["user_email", "user_name", "user_u_id", "user_h_id"]:
            session.pop(key, None)
        return jsonify({"ok": True}), 200

    @app.get("/api/me")
    def api_me():
        """Returns the currently authenticated user (for navbar chip)."""
        email = session.get("user_email")
        if not email:
            return (
                jsonify(
                    {
                        "email": None,
                        "name": None,
                        "u_id": None,
                        "h_id": None,
                        "hostees": [],
                    }
                ),
                200,
            )

        name = session.get("user_name")
        u_id = session.get("user_u_id")
        h_id = session.get("user_h_id")

        try:
            info = db.portal_info(email) or {}
        except Exception:
            app.logger.exception("Error in db.portal_info for %s", email)
            info = {}

        hostees = info.get("hostees", [])

        return (
            jsonify(
                {
                    "email": email,
                    "name": name,
                    "u_id": u_id,
                    "h_id": h_id,
                    "hostees": hostees,
                }
            ),
            200,
        )

    @app.get("/api/friend/my_friends")
    def my_friends():
        email = session.get("user_email")
        if not email:
            return jsonify({"error": "Must be signed in."}), 401

        user_u_id = session.get("user_u_id")
        friends = db.fetch_friends(user_u_id, "friends")
        return jsonify({"friends": friends}), 200

    @app.get("/api/friend/incoming_requests")
    def incoming_requests():
        """People who waved at *you* (user2 == you)."""
        email = session.get("user_email")
        if not email:
            return jsonify({"error": "Must be signed in."}), 401

        user_u_id = session.get("user_u_id")
        requests = db.fetch_incoming_requests(user_u_id)
        return jsonify({"requests": requests}), 200

    @app.get("/api/friend/outgoing_requests")
    def outgoing_requests():
        """People you waved at (user1 == you)."""
        email = session.get("user_email")
        if not email:
            return jsonify({"error": "Must be signed in."}), 401

        user_u_id = session.get("user_u_id")
        requests = db.fetch_outgoing_requests(user_u_id)
        return jsonify({"requests": requests}), 200

    @app.post("/api/friend/send_request")
    def send_friend_request():
        email = session.get("user_email")
        if not email:
            return jsonify({"error": "Must be signed in."}), 401

        friend_u_id = request.args.get("friend_u_id")
        if not friend_u_id:
            return jsonify({"error": "Missing friend_u_id"}), 400

        user_u_id = session.get("user_u_id")
        friend_request = db.add_friend(user_u_id, friend_u_id)
        if "error" in friend_request:
            return jsonify({"error": friend_request["error"]}), 400
        return jsonify(friend_request), 200

    @app.post("/api/friend/accept_request")
    def accept_friend_request():
        email = session.get("user_email")
        if not email:
            return jsonify({"error": "Must be signed in."}), 401

        friend_u_id = request.args.get("friend_u_id")
        if not friend_u_id:
            return jsonify({"error": "Missing friend_u_id"}), 400

        user_u_id = session.get("user_u_id")
        friend_request = db.accept_request(user_u_id, friend_u_id)
        if "error" in friend_request:
            return jsonify({"error": friend_request["error"]}), 400
        return jsonify(friend_request), 200

    @app.post("/api/friend/decline_request")
    def decline_friend_request():
        email = session.get("user_email")
        if not email:
            return jsonify({"error": "Must be signed in."}), 401

        friend_u_id = request.args.get("friend_u_id")
        if not friend_u_id:
            return jsonify({"error": "Missing friend_u_id"}), 400

        user_u_id = session.get("user_u_id")
        friend_request = db.decline_request(user_u_id, friend_u_id)
        if "error" in friend_request:
            return jsonify({"error": friend_request["error"]}), 400
        return jsonify(friend_request), 200

    @app.post("/api/friend/remove_friend")
    def remove_friend():
        email = session.get("user_email")
        if not email:
            return jsonify({"error": "Must be signed in."}), 401

        friend_u_id = request.args.get("friend_u_id")
        if not friend_u_id:
            return jsonify({"error": "Missing friend_u_id"}), 400

        user_u_id = session.get("user_u_id")
        friend_request = db.remove_friend(user_u_id, friend_u_id)
        if "error" in friend_request:
            return jsonify({"error": friend_request["error"]}), 400
        return jsonify(friend_request), 200

    @app.post("/api/post_feedback")
    def post_feedback():
        email = session.get("user_email")
        if not email:
            return jsonify({"error": "Must be signed in."}), 401

        u_id = session.get("user_u_id")
        data = request.get_json(silent=True) or {}
        content = (data.get("content") or "").strip()
        category = (data.get("category") or "").strip()
        if not content:
            return jsonify({"error": "Missing content"}), 400
        if not category:
            category = "other"

        try:
            db.post_feedback(u_id, content, category)
        except Exception:
            app.logger.exception("Error posting feedback")
            return jsonify({"error": "Failed to post feedback"}), 500

        return jsonify({"ok": True}), 200

    @app.get("/admin")
    def admin_login():
        if session.get("admin"):
            return redirect(url_for("admin_panel"))
        return render_template("admin_login.html")

    @app.post("/admin")
    def admin_login_post():
        password = request.form.get("password", "")
        if password == ADMIN_PASSWORD:
            session["admin"] = True
            return redirect(url_for("admin_panel"))
        return render_template("admin_login.html", error="Incorrect password")

    @app.post("/admin/logout")
    def admin_logout():
        session.clear()
        return redirect(url_for("portal"))

    @app.get("/admin/panel")
    def admin_panel():
        if not session.get("admin"):
            return redirect(url_for("admin_login"))
        return render_template("admin.html")

    @app.get("/admin/get-feedback")
    def fetch_feedback_admin():
        if not session.get("admin"):
            return jsonify({"error": "Unauthorized"}), 401

        all_feedback = db.get_feedback()
        return jsonify({"feedback": all_feedback}), 200
    @app.get("/api/admin/feedback")
    def fetch_feedback_api():
        return fetch_feedback_admin()

    @app.post("/api/admin/upload")
    def admin_upload():
        if not session.get("admin"):
            return jsonify({"error": "Unauthorized"}), 401

        hosts_file = request.files.get("hosts")
        hostees_file = request.files.get("hostees")
        if not hosts_file or not hostees_file:
            return jsonify({"error": "Both hosts.csv and hostees.csv are required"}), 400

        db.upload(hosts_file, hostees_file)
        db.import_users()
        return jsonify({"message": "Upload complete. Database refreshed."}), 200

    @app.post("/api/admin/match")
    def admin_match():
        if not session.get("admin"):
            return jsonify({"error": "Unauthorized"}), 401

        prematches_file = request.files.get("prematches")
        if not prematches_file:
            return jsonify({"error": "prematches.csv is required"}), 400

        csv_path = "./output/final.csv"
        txt_path = "./output/matches.txt"

        db.pre_match(prematches_file)
        db.match_all("Male")
        db.match_all("Female")
        db.create_spreadsheet(csv_path, txt_path)

        session["has_match"] = True
        return jsonify({"message": "Matching complete. Downloads are ready."}), 200

    @app.get("/api/admin/download/final.csv")
    def admin_download_final():
        if not session.get("admin"):
            return redirect(url_for("admin_login"))
        path = "./output/final.csv"
        if not os.path.exists(path):
            return "File not found", 404
        return send_file(path, as_attachment=True, download_name="final.csv")

    @app.get("/api/admin/download/matches.txt")
    def admin_download_matches():
        if not session.get("admin"):
            return redirect(url_for("admin_login"))
        path = "./output/matches.txt"
        if not os.path.exists(path):
            return "File not found", 404
        return send_file(path, as_attachment=True, download_name="matches.txt")

    @app.post("/api/admin/clear-matches")
    def admin_clear_matches():
        if not session.get("admin"):
            return jsonify({"error": "Unauthorized"}), 401

        db.clear_matches()

        for p in ("./output/final.csv", "./output/matches.txt"):
            try:
                os.remove(p)
            except FileNotFoundError:
                pass

        session["has_match"] = False
        return jsonify({"message": "Matches cleared and database updated."}), 200

    @app.get("/admin/download/final.csv")
    def admin_download_final_redirect():
        return redirect(url_for("admin_download_final"))

    @app.get("/admin/download/matches.txt")
    def admin_download_matches_redirect():
        return redirect(url_for("admin_download_matches"))

    # ── Itinerary & Explore pages ──────────────────────────────────────────

    @app.get("/itinerary")
    def itinerary_page():
        return render_template("itinerary.html")

    @app.get("/explore")
    def explore_page():
        return render_template("explore.html")

    # ── Messaging API ──────────────────────────────────────────────────────

    @app.get("/api/messages")
    def get_conversations():
        u_id = session.get("user_u_id")
        if not u_id:
            return jsonify({"error": "Must be signed in."}), 401
        return jsonify({"conversations": db.get_conversations(u_id)}), 200

    @app.get("/api/messages/unread")
    def get_unread():
        u_id = session.get("user_u_id")
        if not u_id:
            return jsonify({"count": 0}), 200
        return jsonify({"count": db.unread_count(u_id)}), 200

    @app.get("/api/messages/<int:other_u_id>")
    def get_thread(other_u_id):
        u_id = session.get("user_u_id")
        if not u_id:
            return jsonify({"error": "Must be signed in."}), 401
        db.mark_read(u_id, other_u_id)
        return jsonify({"messages": db.get_thread(u_id, other_u_id)}), 200

    @app.post("/api/messages/<int:other_u_id>")
    def send_message(other_u_id):
        u_id = session.get("user_u_id")
        if not u_id:
            return jsonify({"error": "Must be signed in."}), 401
        data = request.get_json(silent=True) or {}
        content = (data.get("content") or "").strip()
        if not content:
            return jsonify({"error": "Empty message"}), 400
        return jsonify(db.send_message(u_id, other_u_id, content)), 200

    # ── Tags API ───────────────────────────────────────────────────────────

    @app.get("/api/tags")
    def get_tags():
        return jsonify({"tags": db.get_all_tags()}), 200

    @app.get("/api/host/tags")
    def get_my_tags():
        h_id = session.get("user_h_id")
        if not h_id:
            return jsonify({"error": "Must be signed in."}), 401
        return jsonify({"tags": db.get_host_tags(h_id)}), 200

    @app.post("/api/host/tags")
    def set_my_tags():
        h_id = session.get("user_h_id")
        if not h_id:
            return jsonify({"error": "Must be signed in."}), 401
        data = request.get_json(silent=True) or {}
        tag_ids = data.get("tag_ids", [])
        db.set_host_tags(h_id, tag_ids)
        return jsonify({"ok": True}), 200

    @app.get("/api/hosts/tags")
    def get_all_hosts_tags():
        return jsonify({"hosts": db.get_all_hosts_with_tags()}), 200

    # ── Friend hosting API ─────────────────────────────────────────────────

    @app.get("/api/friend/hosting")
    def friend_hosting():
        u_id = session.get("user_u_id")
        if not u_id:
            return jsonify({"error": "Must be signed in."}), 401
        return jsonify({"hosting": db.get_friends_hosting(u_id)}), 200

    # ── Recommendations API ────────────────────────────────────────────────

    @app.get("/api/recommendations")
    def get_recommendations():
        return jsonify({"recommendations": db.get_recommendations()}), 200

    @app.post("/api/admin/recommendations")
    def add_recommendation():
        if not session.get("admin"):
            return jsonify({"error": "Unauthorized"}), 401
        data = request.get_json(silent=True) or {}
        r = db.add_recommendation(
            data.get("name", ""),
            data.get("category", "general"),
            data.get("address", ""),
            data.get("description", ""),
            data.get("url", ""),
        )
        return jsonify(r), 200

    @app.delete("/api/admin/recommendations/<int:r_id>")
    def delete_recommendation(r_id):
        if not session.get("admin"):
            return jsonify({"error": "Unauthorized"}), 401
        db.delete_recommendation(r_id)
        return jsonify({"ok": True}), 200

    # ── Itinerary API ──────────────────────────────────────────────────────

    @app.get("/api/itinerary")
    def get_itinerary():
        return jsonify({"itinerary": db.get_itinerary()}), 200

    @app.post("/api/admin/itinerary")
    def add_itinerary():
        if not session.get("admin"):
            return jsonify({"error": "Unauthorized"}), 401
        data = request.get_json(silent=True) or {}
        r = db.add_itinerary_item(
            data.get("title", ""),
            data.get("description", ""),
            data.get("location", ""),
            data.get("start_time") or None,
            data.get("end_time") or None,
            data.get("category", "general"),
        )
        return jsonify(r), 200

    @app.delete("/api/admin/itinerary/<int:i_id>")
    def delete_itinerary(i_id):
        if not session.get("admin"):
            return jsonify({"error": "Unauthorized"}), 401
        db.delete_itinerary_item(i_id)
        return jsonify({"ok": True}), 200

    # ── Map API ────────────────────────────────────────────────────────────

    @app.get("/api/map/locations")
    def map_locations():
        return jsonify({"locations": db.get_map_locations()}), 200

    @app.post("/api/admin/host-location")
    def set_host_location():
        if not session.get("admin"):
            return jsonify({"error": "Unauthorized"}), 401
        data = request.get_json(silent=True) or {}
        db.set_host_location(data.get("h_id"), data.get("address"), data.get("lat"), data.get("lng"))
        return jsonify({"ok": True}), 200

    # ── Admin: tags management ─────────────────────────────────────────────

    @app.post("/api/admin/tags")
    def admin_add_tag():
        if not session.get("admin"):
            return jsonify({"error": "Unauthorized"}), 401
        data = request.get_json(silent=True) or {}
        return jsonify(db.add_tag(data.get("name", "").strip())), 200

    @app.delete("/api/admin/tags/<int:tag_id>")
    def admin_delete_tag(tag_id):
        if not session.get("admin"):
            return jsonify({"error": "Unauthorized"}), 401
        db.delete_tag(tag_id)
        return jsonify({"ok": True}), 200

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=3030, debug=True)
