-- SQLite runtime compatibility helpers for the VPS PostgreSQL migration.
--
-- These functions preserve SQL patterns used by the Version 61 application
-- without changing business data. PostgreSQL's MIN/MAX are aggregate
-- functions, while SQLite also supports scalar MIN(a,b)/MAX(a,b). PostgreSQL
-- also lacks ROUND(double precision, integer).
--
-- Keep these helpers in the public schema so unqualified SQL from the existing
-- application resolves them through the normal search_path.

CREATE OR REPLACE FUNCTION public.min(integer, double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT LEAST($1::double precision, $2)
$$;

CREATE OR REPLACE FUNCTION public.min(double precision, integer)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT LEAST($1, $2::double precision)
$$;

CREATE OR REPLACE FUNCTION public.min(double precision, double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT LEAST($1, $2)
$$;

CREATE OR REPLACE FUNCTION public.max(integer, double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT GREATEST($1::double precision, $2)
$$;

CREATE OR REPLACE FUNCTION public.max(double precision, integer)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT GREATEST($1, $2::double precision)
$$;

CREATE OR REPLACE FUNCTION public.max(double precision, double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT GREATEST($1, $2)
$$;

CREATE OR REPLACE FUNCTION public.round(double precision, integer)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT pg_catalog.round($1::numeric, $2)::double precision
$$;
