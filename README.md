# Equipment Share

A platform for renting second-hand professional and heavy equipment.
Rentals only — no buying, bidding, or payment gateway.

This build has a **separate Buyer and Seller experience**, chosen once at
onboarding, so buyers never see the equipment-management screens and
sellers never see the browse/rent screens.

---

## What changed in this version

- **Onboarding (`/start`)**: pick "I want to rent" or "I want to list",
  enter your name + phone once (same validation rules as before — letters
  only for name, exactly 10 digits for phone). This is saved in the
  browser so buyers never re-type it when booking.
- **Buyer flow**: `/rent` (browse/search/filter) → equipment details →
  booking (name/phone auto-filled, just pick rental days) → `/bookings`
  (their own rental history, with a clear "rented until" date) →
  `/profile` (their stats: total bookings, total spent).
- **Seller flow**: `/sell` (add/edit/delete equipment, mark availability,
  attach a real photo) → `/bookings` (all bookings platform-wide) →
  `/profile` (equipment listed, times rented out, unique customers).
- **Equipment photos**: sellers can now attach a real photo when adding
  or editing equipment (stored as base64 in MySQL — no cloud storage
  needed). If no photo is attached, a clean category icon is shown
  instead of a broken image or endless spinner.
- **Notifications**: buyers get a "you booked X successfully" notification
  right after booking. Sellers get a "X is now out for renting"
  notification (checked via a short poll of the bookings list) with a
  toast + a bell dropdown showing recent activity.
- **Simplified visuals**: removed the cosmetic star ratings and
  "#1 match / 92%" badges, removed all gradients in favor of a flat
  navy/light-blue palette, replaced the "Ask our AI" pill with a plain
  search shortcut (typing "mobile generator" into the real search box —
  no AI call happens), replaced the "A" avatar with a simple flat logo,
  and made the bottom nav genuinely fixed so it no longer shifts while
  scrolling. The nav is now labeled **Rent** (buyer home) and **Sell**
  (seller home) with icons that match.

### An important note on "sellers"

The original project scope (and the required MySQL schema) has a single
shared equipment pool with no per-seller ownership column — there's one
`OwnerManager` for the whole platform, not a multi-vendor marketplace.
So in this build, **"Seller" effectively means "the business owner"**:
any browser that picks "I want to list" gets full management access to
the entire equipment catalog, and the seller profile's stats
(equipment listed, times rented out, unique customers) are platform-wide
totals, not filtered to "equipment this specific seller listed." If you
want genuine multi-vendor ownership (each seller only sees their own
equipment), that requires adding an `owner_id` column to `equipment` and
changing every query to filter by it — let me know if you'd like that as
a follow-up.

---

## 1. Folder structure

```
equipment-share/
│
├── frontend/
│   ├── app/
│   │   ├── page.js                     Redirects to /start, /rent or /sell
│   │   ├── start/page.js               Onboarding — role + name/phone
│   │   ├── rent/page.js                Buyer home (browse/search/filter)
│   │   ├── sell/page.js                Seller home (equipment CRUD)
│   │   ├── equipment/[id]/page.js      Equipment details (buyer only)
│   │   ├── bookings/page.js            Role-aware bookings list
│   │   ├── profile/page.js             Role-aware profile + stats
│   │   ├── layout.js                   Root layout, loads fonts
│   │   └── globals.css                 All design tokens + styles
│   │
│   ├── components/
│   │   ├── EquipmentCard.js
│   │   ├── SearchBar.js
│   │   ├── CategoryFilter.js
│   │   ├── CategoryIcon.js             Shared icon (chips + image fallback)
│   │   ├── BookingForm.js
│   │   ├── BottomNav.js                Role-aware, fixed positioning
│   │   ├── Logo.js                     Flat brand mark
│   │   ├── Toast.js
│   │   ├── NotificationBell.js
│   │   └── ImageUploadField.js         Photo attach → base64
│   │
│   ├── lib/
│   │   ├── api.js                      Fetch wrapper for the backend
│   │   ├── display.js                  Formatting helpers (currency, dates)
│   │   ├── session.js                  Buyer/seller role + name/phone
│   │   └── notifications.js            Local notification log + polling
│   │
│   ├── package.json
│   ├── next.config.js
│   ├── jsconfig.json
│   └── .env.local.example
│
├── backend/
│   ├── main.py                         FastAPI app + all endpoints
│   ├── database.py                     MySQL connection + schema + seed data
│   ├── user.py                         User class
│   ├── equipment.py                    Equipment class
│   ├── booking.py                      Booking class
│   ├── owner_manager.py                OwnerManager class
│   ├── requirements.txt
│   └── .env.example
│
├── database/
│   └── schema.sql
│
└── README.md
```

---

## 2. Local setup — MySQL

Make sure MySQL Server is installed and running, then either let the
backend create everything automatically on first run (recommended), or
run the schema yourself:

```bash
mysql -u root -p < database/schema.sql
```

If you already ran an older version of this project, the backend will
automatically add the new `image_base64` column to your existing
database the next time it starts — you don't need to drop anything.

---

## 3. Local setup — Backend (FastAPI)

```bash
cd backend
python -m venv venv
```

Activate it:
- **macOS/Linux:** `source venv/bin/activate`
- **Windows:** `venv\Scripts\activate`

```bash
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` with your real MySQL credentials, then run:

```bash
uvicorn main:app --reload --port 8000
```

API docs: http://127.0.0.1:8000/docs

---

## 4. Local setup — Frontend (Next.js)

In a second terminal:

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open **http://localhost:3000**. You'll land on the onboarding screen
first — pick a role and enter a name + phone to continue.

To test both sides, open the buyer flow in one browser (or a normal
window) and the seller flow in another (or an incognito/private window)
— since the role is stored per-browser, this lets you book as a buyer in
one tab and watch the seller notification appear in the other.

---

## 5. What to test locally

- **Onboarding:** try an invalid name (numbers/symbols) and an invalid
  phone (not 10 digits) — both should show inline errors and refuse to
  continue.
- **Buyer:** browse, search, filter by category, open a machine's
  details, rent it (no need to re-enter name/phone), then check
  `/bookings` — you should see a clear "rented until" date, and
  `/profile` should show your updated total spent.
- **Seller:** add a new machine with a real photo attached, edit it,
  toggle its availability, and try deleting one that already has a
  booking (should be blocked with an explanation). Within ~15 seconds of
  a buyer completing a booking, the seller should see a toast and a bell
  notification saying that equipment is now out for renting.
- **Switch role:** from the Profile page, "Switch role / Sign out" clears
  the stored session and sends you back to onboarding.
- **Persistence:** restart both servers and confirm equipment, images,
  and bookings are all still there, and sample data isn't duplicated.

---

## 6. Environment variables reference

**Backend (`backend/.env`)**
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YOUR_PASSWORD
DB_NAME=equipment_share
CORS_ORIGINS=http://localhost:3000
```

**Frontend (`frontend/.env.local`)**
```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

---

## 7. Deploying the frontend to Vercel

```
Working locally in VS Code
        ↓
Push the project to GitHub
        ↓
Open vercel.com → Import Project
        ↓
Select your repo, set Root Directory to "frontend"
        ↓
Add environment variable: NEXT_PUBLIC_API_URL = <your deployed backend URL>
        ↓
Deploy
```

Vercel only hosts the Next.js frontend. You'll need to separately deploy
the FastAPI backend (Render, Railway, Fly.io, or a VPS) and the MySQL
database (PlanetScale, Railway MySQL, AWS RDS, etc.), then update
`NEXT_PUBLIC_API_URL` and the backend's `CORS_ORIGINS` accordingly.

---

## 8. OOP classes (for grading / review)

| Class | File | Responsibility |
|---|---|---|
| `User` | `backend/user.py` | Validates and stores customer name/phone |
| `Equipment` | `backend/equipment.py` | Validates and formats equipment data (incl. image) |
| `Booking` | `backend/booking.py` | Validates rental days, calculates total, saves booking |
| `OwnerManager` | `backend/owner_manager.py` | CRUD for equipment + booking viewing (with phone filter) |

`database.py` is a plain helper module (connection + schema + seed data +
auto-migration), not one of the four main classes.
