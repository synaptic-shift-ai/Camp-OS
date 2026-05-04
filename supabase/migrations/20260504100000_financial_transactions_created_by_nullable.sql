-- Guest/booking-site payments are not created by property staff; allow null created_by.
ALTER TABLE financial_transactions
  ALTER COLUMN created_by DROP NOT NULL;
