# digital
## Demo mode

Run the portal with built-in sample data and no MySQL database:

```bash
pip install -r requirements.txt
DEMO_MODE=1 python app.py
```

Open http://localhost:3030 and log in with any demo host, e.g. `sarah.mahmoud@yale.edu`, code `1234`.
The admin panel password is `changeme` (or `ADMIN_PASSWORD`). Demo data lives in memory and resets on restart.
