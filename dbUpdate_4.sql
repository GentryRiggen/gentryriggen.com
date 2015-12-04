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
