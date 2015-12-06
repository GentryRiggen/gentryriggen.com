CREATE TABLE daily_summary_hour
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  user_daily_summary_id INT NOT NULL,
  day_id DATETIME NOT NULL,
  start_time DATETIME,
  end_time DATETIME,
  steps_taken INT,
  calories_burned INT,
  average_heart_rate INT,
  peak_heart_rate INT,
  lowest_heart_rate INT
);
CREATE UNIQUE INDEX unique_id ON daily_summary_hour (id);
ALTER TABLE daily_summary_hour ADD FOREIGN KEY (user_daily_summary_id) REFERENCES user_daily_summary(id);

CREATE TABLE workout_minute
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  user_workout_id INT NOT NULL,
  start_time DATETIME,
  end_time DATETIME,
  steps_taken INT,
  calories_burned INT,
  average_heart_rate INT,
  peak_heart_rate INT,
  lowest_heart_rate INT
);
CREATE UNIQUE INDEX unique_id ON workout_minute (id);
ALTER TABLE workout_minute ADD FOREIGN KEY (user_workout_id) REFERENCES user_workout(id);

CREATE TABLE run_minute
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  user_run_id INT NOT NULL,
  start_time DATETIME,
  end_time DATETIME,
  steps_taken INT,
  calories_burned INT,
  average_heart_rate INT,
  peak_heart_rate INT,
  lowest_heart_rate INT
);
CREATE UNIQUE INDEX unique_id ON run_minute (id);
ALTER TABLE run_minute ADD FOREIGN KEY (user_run_id) REFERENCES user_run(id);

CREATE TABLE sleep_minute
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  user_sleep_id INT NOT NULL,
  start_time DATETIME,
  end_time DATETIME,
  calories_burned INT,
  average_heart_rate INT,
  peak_heart_rate INT,
  lowest_heart_rate INT
);
CREATE UNIQUE INDEX unique_id ON sleep_minute (id);
ALTER TABLE sleep_minute ADD FOREIGN KEY (user_sleep_id) REFERENCES user_sleep(id);

CREATE TABLE sleep_segment
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  user_sleep_id INT NOT NULL,
  start_time DATETIME,
  end_time DATETIME,
  duration INT,
  steps_taken INT,
  calories_burned INT,
  average_heart_rate INT,
  peak_heart_rate INT,
  lowest_heart_rate INT,
  segment_type VARCHAR(32),
  sleep_type VARCHAR(32)
);
CREATE UNIQUE INDEX unique_id ON sleep_segment (id);
ALTER TABLE sleep_segment ADD FOREIGN KEY (user_sleep_id) REFERENCES user_sleep(id);
