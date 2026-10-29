-- Abort before any schema change if existing scores need human reconciliation.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Score" GROUP BY "participantId", "roundId", "holeId" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate scores found. Reconcile explicitly before retrying; no scores were deleted.';
  END IF;
  IF EXISTS (SELECT 1 FROM "Score" s LEFT JOIN "Round" r ON r.id = s."roundId" WHERE r.id IS NULL) THEN
    RAISE EXCEPTION 'Orphan round references found. Reconcile explicitly before retrying.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Score" s
    JOIN "Round" r ON r.id = s."roundId"
    JOIN "Participant" p ON p.id = s."participantId"
    JOIN "Hole" h ON h.id = s."holeId"
    WHERE r."competitionId" <> p."competitionId" OR r."courseId" <> h."courseId"
  ) THEN RAISE EXCEPTION 'Inconsistent score ownership found. Reconcile explicitly before retrying.';
  END IF;
END $$;

ALTER TABLE "Match" ADD COLUMN "weight" DOUBLE PRECISION;
-- Freeze the EXACT legacy rule, including case and the 1-9 special case.
UPDATE "Match" m SET "weight" = CASE WHEN m.type = 'SINGLES' AND (
  strpos(r.name, 'VM') > 0 OR strpos(r.name, 'NM') > 0 OR
  strpos(r.name, 'Vormittag') > 0 OR strpos(r.name, 'Nachmittag') > 0 OR m."holeRange" = '1-9'
) THEN 0.5 ELSE 1 END FROM "Round" r WHERE r.id = m."roundId";
ALTER TABLE "Match" ADD CONSTRAINT "Match_weight_check" CHECK ("weight" IS NULL OR "weight" IN (0.5, 1));
ALTER TABLE "Score" ALTER COLUMN "points" TYPE DOUBLE PRECISION;
CREATE UNIQUE INDEX "Score_participantId_roundId_holeId_key" ON "Score"("participantId", "roundId", "holeId");
ALTER TABLE "Score" ADD CONSTRAINT "Score_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
