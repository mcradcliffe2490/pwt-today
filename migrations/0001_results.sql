-- One row per visitor per day for the "N% of players won today" line.
CREATE TABLE IF NOT EXISTS results (
  date TEXT NOT NULL,
  visitor TEXT NOT NULL,
  won INTEGER NOT NULL,
  PRIMARY KEY (date, visitor)
);
