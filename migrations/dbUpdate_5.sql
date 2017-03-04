CREATE TABLE user_aggregate_fitness
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  date_created DATETIME NOT NULL,
  cals_weekends_weekdays TEXT NOT NULL,
  cals_days_of_week TEXT NOT NULL,
  cals_monthly TEXT NOT NULL,
  cals_seasonally TEXT NOT NULL,
  cals_hourly TEXT NOT NULL
);
CREATE UNIQUE INDEX unique_id ON user_aggregate_fitness (id);
ALTER TABLE user_aggregate_fitness ADD FOREIiGN KEY (user_id) REFERENCES user(id);

