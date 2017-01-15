CREATE TABLE broboto_pong_team
(
  id VARCHAR(64) PRIMARY KEY NOT NULL,
  name VARCHAR(64) KEY NOT NULL,
  captainId VARCHAR(64) NOT NULL,
  dateCreated DATETIME NOT NULL
);
CREATE UNIQUE INDEX unique_id ON broboto_pong_team (id);

CREATE TABLE broboto_pong_user
(
  id VARCHAR(64) PRIMARY KEY NOT NULL,
  teamId VARCHAR(64) NOT NULL,
  name VARCHAR(512) NOT NULL,
  dateCreated DATETIME NOT NULL
);
CREATE UNIQUE INDEX unique_id ON broboto_pong_user (id);
ALTER TABLE broboto_pong_user ADD FOREIGN KEY (teamId) REFERENCES broboto_pong_team(id);

CREATE TABLE broboto_pong_season
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  teamId VARCHAR(64) NOT NULL,
  name VARCHAR(512) NOT NULL,
  closed TINYINT NOT NULL DEFAULT 0,
  dateCreated DATETIME NOT NULL
);
CREATE UNIQUE INDEX unique_id ON broboto_pong_season (id);
ALTER TABLE broboto_pong_season ADD FOREIGN KEY (teamId) REFERENCES broboto_pong_team(id);

CREATE TABLE broboto_pong_match
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  seasonId INT NOT NULL,
  loserId VARCHAR(64) NOT NULL,
  loserOldELO INT NOT NULL,
  loserNewELO INT NOT NULL,
  winnerId VARCHAR(64) NOT NULL,
  winnerOldELO INT NOT NULL,
  winnerNewELO INT NOT NULL,
  dateCreated DATETIME NOT NULL
);
CREATE UNIQUE INDEX unique_id ON broboto_pong_match (id);
ALTER TABLE broboto_pong_match ADD FOREIGN KEY (seasonId) REFERENCES broboto_pong_season(id);
ALTER TABLE broboto_pong_match ADD FOREIGN KEY (loserId) REFERENCES broboto_pong_user(id);
ALTER TABLE broboto_pong_match ADD FOREIGN KEY (winnerId) REFERENCES broboto_pong_user(id);

CREATE TABLE broboto_pong_ranking
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  seasonId INT NOT NULL,
  userId VARCHAR(64) NOT NULL,
  elo INT NOT NULL,
  wins INT NOT NULL,
  losses INT NOT NULL,
  lws INT NOT NULL,
  lls INT NOT NULL,
  whippingBoi VARCHAR(64),
  nemesis VARCHAR(64),
  dateCreated DATETIME NOT NULL,
  dateModified DATETIME NOT NULL
);
CREATE UNIQUE INDEX unique_id ON broboto_pong_ranking (id);
ALTER TABLE broboto_pong_ranking ADD FOREIGN KEY (seasonId) REFERENCES broboto_pong_season(id);
ALTER TABLE broboto_pong_ranking ADD FOREIGN KEY (userId) REFERENCES broboto_pong_user(id);
ALTER TABLE broboto_pong_ranking ADD FOREIGN KEY (whippingBoi) REFERENCES broboto_pong_user(id);
ALTER TABLE broboto_pong_ranking ADD FOREIGN KEY (nemesis) REFERENCES broboto_pong_user(id);
