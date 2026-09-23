# MillBooks — Rice Mill Party & Received From Party

SvelteKit + TypeScript + Tailwind CSS, with Firebase Authentication and Cloud Firestore
as the only backend. Deployed as a single-page app on Firebase Hosting.

## One-time Firebase setup (project `party-20dd9`)

1. **Authentication** → Get started → Sign-in method → enable **Email/Password**.
2. **Authentication → Users → Add user** for each person who should log in
   (there is no public sign-up).
3. **Firestore Database** → Create database (production mode, pick a region near you).
4. Deploy the security rules and indexes:
   ```sh
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   Indexes take a few minutes to build; combined filters show a friendly
   "index still building" message until they are ready.

## Develop

```sh
npm install
cp .env.example .env   # fill in the Firebase web config (already filled for party-20dd9)
npm run dev
npm test               # calculation + validation unit tests
npm run check          # type-check
```

## Deploy

```sh
npm run deploy         # vite build → firebase deploy (hosting + rules + indexes)
```

## Business rules

Defined once in `src/lib/utils/calculations.ts`:

- `Total = Load − Empty`
- `Bags = floor(Total ÷ KG_PER_BAG)`, with `KG_PER_BAG = 62`
- `Kg = Total − (Bags × KG_PER_BAG)` — the loose remainder, always under 62

The total weight is expressed as whole bags plus what is left over, so a Total of 95
reads as "1 bag 33 kg". Bags and Kg are both derived from Load and Empty; neither is
typed in.

Price, Amount and Freight Charge are manual inputs with no formula.

Total, Bags and Kg are read-only in the UI. They are recalculated from the raw inputs just
before every write (`src/lib/firebase/firestore.ts`), and `firestore.rules` checks the
same formulas on the server, so tampered values are rejected. If a rule changes, update
both `calculations.ts` and `firestore.rules`.

Parties and entries are never deleted. They are marked `inactive`, and the rules deny
deletes. New entries can only reference an Active party.

## Data model

- `parties/{id}`: `partyName, place, phoneNumber, status, createdAt, updatedAt`
- `received_from_party/{id}`: `transactionDate, purchaseType, wayNumber, partyId, itemName,
  load, empty, total, bagCount, kg, freightCharge, narration, price, amount, status,
  createdAt, updatedAt`

## Searching and performance

- The party master is kept live in memory, since it is small reference data. It powers party
  search, the party dropdown, and showing party names on entries.
- Transaction lists use server-side `where` / `orderBy` / `limit` with query cursors
  (20 / 50 / 100 rows per page). Counts and report totals use Firestore server
  aggregations (`count`, `sum`), so the transaction collection is never downloaded in full.
- The Party Name / Phone filter on transactions is resolved to matching party IDs, then
  applied as `partyId in [...]`. Firestore allows 30 values per `in` filter, so the list asks
  you to narrow a search that matches more than 30 parties. Reports split larger matches
  into batches and add the totals together.
