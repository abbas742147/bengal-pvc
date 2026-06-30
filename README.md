
# Bengal PVC - Railway Migration

Keeps ALL existing theme features and functions same. Migrated from Google Apps Script to Node.js on Railway.app for speed and reliability.

## Features kept
- Same frontend (index.html)
- All actions: register, login, orders, payments, discounts, franchise, withdrawals, analytics
- File uploads stored on Railway Volume
- Auto-delete files after 10 days when DELIVERED/CANCELLED/REFUNDED (fixed from 12 days)
- Discount max uses FIX: code stops working when limit reached and auto-deactivates

## Step-by-step Railway deployment
...
