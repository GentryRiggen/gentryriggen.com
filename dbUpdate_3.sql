ALTER TABLE user ADD mshealth_token VARCHAR(1024);
ALTER TABLE user ADD mshealth_refresh_token VARCHAR(1024);
ALTER TABLE user ADD mshealth_last_update DATETIME;

CREATE TABLE user_run
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  mshealth_id BIGINT UNSIGNED NOT NULL,
  user_id INT NOT NULL,
  day_id DATETIME NOT NULL,
  finish_heart_rate INT,
  under_aerobic_time INT,
  aerobic_time INT,
  anaerobic_time INT,
  fitness_zone_time INT,
  healthy_heart_time INT,
  redline_time INT,
  total_distance INT,
  actual_distance INT,
  elevation_gain INT,
  elevation_loss INT,
  pace INT,
  split_distance INT,
  start_time DATETIME,
  end_time DATETIME,
  duration INT,
  calories_burned INT,
  average_heart_rate INT,
  peak_heart_rate INT,
  lowest_heart_rate INT
);
CREATE UNIQUE INDEX unique_id ON user_run (id);
CREATE UNIQUE INDEX unique_mshealth_id ON user_run (mshealth_id);
ALTER TABLE user_run ADD FOREIGN KEY (user_id) REFERENCES user(id);

CREATE TABLE user_workout
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  mshealth_id BIGINT UNSIGNED NOT NULL,
  user_id INT NOT NULL,
  day_id DATETIME NOT NULL,
  start_time DATETIME,
  end_time DATETIME,
  duration INT,
  calories_burned INT,
  average_heart_rate INT,
  peak_heart_rate INT,
  lowest_heart_rate INT,
  finish_heart_rate INT,
  under_aerobic_time INT,
  aerobic_time INT,
  anaerobic_time INT,
  fitness_zone_time INT,
  healthy_heart_time INT,
  redline_time INT
);
CREATE UNIQUE INDEX unique_id ON user_workout (id);
CREATE UNIQUE INDEX unique_mshealth_id ON user_workout (mshealth_id);
ALTER TABLE user_workout ADD FOREIGN KEY (user_id) REFERENCES user(id);

CREATE TABLE user_sleep
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  mshealth_id BIGINT UNSIGNED NOT NULL,
  user_id INT NOT NULL,
  day_id DATETIME NOT NULL,
  start_time DATETIME,
  end_time DATETIME,
  number_of_wakeups INT,
  fall_asleep_time DATETIME,
  wakeup_time DATETIME,
  total_duration INT,
  awake_duration INT,
  sleep_duration INT,
  restless_sleep_duration INT,
  restfull_sleep_duration INT,
  time_to_fall_asleep INT,
  sleep_efficiency INT,
  calories_burned INT,
  average_heart_rate INT,
  peak_heart_rate INT,
  lowest_heart_rate INT
);
CREATE UNIQUE INDEX unique_id ON user_sleep (id);
CREATE UNIQUE INDEX unique_mshealth_id ON user_sleep (mshealth_id);
ALTER TABLE user_sleep ADD FOREIGN KEY (user_id) REFERENCES user(id);

CREATE TABLE user_daily_summary
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  day_id DATETIME NOT NULL,
  steps_taken INT,
  calories_burned INT,
  distance INT,
  average_heart_rate INT,
  peak_heart_rate INT,
  lowest_heart_rate INT
);
CREATE UNIQUE INDEX unique_id ON user_daily_summary (id);
ALTER TABLE user_daily_summary ADD FOREIGN KEY (user_id) REFERENCES user(id);
