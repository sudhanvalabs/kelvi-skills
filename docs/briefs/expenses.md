# Brief: Expenses (a second skill)

Record what the person spends from receipts and messages, and give totals by month, trip, category
or client.

## Messages and replies

- A receipt photo or PDF with "expense", or a message: "₹450 cab to the airport". Kelvi records the
  date, vendor, amount, currency, category and, for travel, from and to, and says what it recorded.
- "my expenses this month", "expenses for the Goa trip", "by category": totals, in code.
- "the cab bill from Bangalore airport": what was recorded, with the original kept.
- "make 3 travel", "delete the Uber one".

## The toolkit parts it uses

`ctx.documents.recent(30)` for the receipt's text (Kelvi has already read the photo),
`ctx.ai.read` to turn it into fields (Forge masks it and charges the person's credits),
`ctx.documents.keep` to save the original under Expenses, `ctx.rates.inr` for other currencies,
one register `skill_expenses`, and a `page` entry for the sidebar.

## Boundaries for the routing description

Recurring payments are Subscriptions; invoices the person raises are Invoices; a bill to file
without tracking is "store it"; medical bills and prescriptions are Health records.

## Not possible yet

Sending a file back (a PDF expense claim for a trip) and a scheduled message (a monthly total on
the 1st) need toolkit additions. Build without them first and say in the pull request that you
want them.
