-- Defense in depth for trusted operator scripts as well as API writes.
ALTER TABLE "Account" ADD CONSTRAINT "Account_role_check" CHECK ("role" IN ('USER', 'ADMIN'));
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_price_check" CHECK ("pricePaise" >= 0);
ALTER TABLE "LoginChallenge" ADD CONSTRAINT "LoginChallenge_attempts_check" CHECK ("attempts" >= 0 AND "attempts" <= 5);
