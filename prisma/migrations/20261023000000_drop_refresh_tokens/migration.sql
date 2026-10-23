-- HOA protocol 04: access tokens never expire, so there is nothing to refresh.
-- Dropping the table also drops its foreign key to "User" and its indexes.
DROP TABLE "RefreshToken";
