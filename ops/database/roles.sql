-- Run as the database owner after migrations. Provision login credentials through
-- your secrets manager; this file deliberately creates only a non-login group.
CREATE ROLE grocery_runtime NOLOGIN;
GRANT CONNECT ON DATABASE grocerycompare TO grocery_runtime;
GRANT USAGE ON SCHEMA public TO grocery_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grocery_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO grocery_runtime;
-- Run these as the migration owner so future objects receive the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO grocery_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO grocery_runtime;
REVOKE ALL ON TABLE "_prisma_migrations" FROM grocery_runtime;
REVOKE UPDATE, DELETE ON TABLE "AuditLog" FROM grocery_runtime;
-- Account deletion's FK SET NULL needs UPDATE(actorId) without allowing edits to evidence.
GRANT UPDATE ("actorId") ON TABLE "AuditLog" TO grocery_runtime;
-- GRANT grocery_runtime TO your_secret_managed_application_login;
-- Do not grant CREATE, schema ownership, SUPERUSER or migration-owner membership.
