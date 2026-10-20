DO $$
DECLARE
  active_count integer;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM "Event"
  WHERE "status" = 'ACTIVE';

  IF active_count > 1 THEN
    RAISE EXCEPTION 'Cannot enforce one active event: found % rows with status ACTIVE. Review event records before retrying this migration.', active_count;
  END IF;
END $$;

CREATE UNIQUE INDEX "Event_one_active_status_key"
ON "Event" ("status")
WHERE "status" = 'ACTIVE';
