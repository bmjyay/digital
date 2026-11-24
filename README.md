# digital
## Demo mode

Run the portal with built-in sample data and no MySQL database:

```bash
pip install -r requirements.txt
DEMO_MODE=1 python app.py
```

Open http://localhost:3030 and log in with any demo host, e.g. `sarah.mahmoud@yale.edu`, code `1234`.
The admin panel password is `changeme` (or `ADMIN_PASSWORD`). Demo data lives in memory and resets on restart.

## Pages

- `/` Housing portal: hosts log in to see their hostees and connect with the community
- `/explore` Explore New Haven: cafes, restaurants and activities
- `/itinerary` Conference schedule grouped by day
- `/admin` Admin panel: upload data, run matching, manage Explore recommendations and Itinerary events, read feedback

The `recommendations` and `events` tables are created automatically on first start if the database doesn't have them.
