# Brief: Lent and borrowed (a good first skill)

Keep track of money the person lends to people or borrows from them, and who owes what.

**Why it is a good first skill:** one register, sums in code, no AI, no documents, no exchange
rates, so it exercises the whole path (manifest, logic, tests, bench, pull request) with the fewest
moving parts.

## Messages and replies

| The person | Kelvi |
|---|---|
| "lent Ravi 2000 for the hotel" | "Noted: you lent *Ravi* ₹2,000 (hotel). Ravi owes you ₹2,000." |
| "borrowed 500 from Meena" | "Noted: you owe *Meena* ₹500." |
| "Ravi paid back 500" | "Noted. Ravi now owes you ₹1,500." |
| "paid Meena back" | "Noted. You and Meena are settled." |
| "who owes me?", "/lent" | Each person and what they owe, then what you owe others, numbered |
| "Ravi" or "what about Ravi?" | Every entry with Ravi, newest first, and the balance |
| "delete 3" | Deletes the third entry of the last list |

## Data

One register, `skill_lent`: person (text), amount (currency, positive when they owe the person,
negative when the person owes them), note (text), on (date). A repayment is an entry with the
opposite sign. Balances are sums per person, in `logic.ts`, with tests.

## Not yours

"remind me to ask Ravi for the money on Friday" is a reminder (Kelvi's actions). A recurring payment
is Subscriptions. "pay Ravi 2000" with nothing about lending is not yours: ask nothing, let the
sorting step place it.

## Done means

Tests for reading amounts ("2000", "2,000", "₹2k", "Rs. 500"), names, repayments and balances;
bench conversations for each row above; `npm run check` passing.
