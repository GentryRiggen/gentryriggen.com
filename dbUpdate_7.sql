ALTER TABLE broboto_pong_match ADD winnerPoints INT DEFAULT 0 NOT NULL;
ALTER TABLE broboto_pong_match ADD loserPoints INT DEFAULT 0 NOT NULL;
ALTER TABLE broboto_pong_match ADD skunk TINYINT DEFAULT 0 NOT NULL;
ALTER TABLE broboto_pong_ranking ADD pointDifferential INT DEFAULT 0 NOT NULL;
ALTER TABLE broboto_pong_ranking ADD totalPoints INT DEFAULT 0 NOT NULL;

UPDATE broboto_pong_match SET loserPoints = 19, winnerPoints = 21;

