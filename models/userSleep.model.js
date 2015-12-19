var baseMsHealthModel = require('./baseMsHealth.model'),
  conf = require('../config/conf');

exports.toJson = function (sleep) {
  return {
    id: sleep.id,
    msHealthId: sleep.mshealth_id,
    userId: sleep.user_id,
    dayId: sleep.day_id,
    startTime: sleep.start_time,
    endTime: sleep.end_time,
    numberOfWakeups: sleep.number_of_wakeups,
    fallAsleepTime: sleep.fall_asleep_time,
    wakeupTime: sleep.wakeup_time,
    totalDuration: sleep.total_duration,
    awakeDuration: sleep.awake_duration,
    sleepDuration: sleep.sleep_duration,
    restlessSleepDuration: sleep.restless_sleep_duration,
    restfullSleepDuration: sleep.restfull_sleep_duration,
    timeToFallAsleep: sleep.time_to_fall_asleep,
    sleepEfficiency: sleep.sleep_efficiency,
    caloriesBurned: sleep.calories_burned,
    averageHeartRate: sleep.average_heart_rate,
    peakHeartRate: sleep.peak_heart_rate,
    lowestHeartRate: sleep.lowest_heart_rate
  };
};

exports.fromJson = function (msHealthSleep) {
  var sleep = {
    mshealth_id: msHealthSleep.id,
    user_id: conf.msftHealth.gentryId,
    number_of_wakeups: msHealthSleep.numberOfWakeups,
    fall_asleep_time: (new Date(msHealthSleep.fallAsleepTime)).toLocalMysqlFormat(),
    wakeup_time: (new Date(msHealthSleep.wakeupTime)).toLocalMysqlFormat(),
    total_duration: msHealthSleep.duration ? baseMsHealthModel.durationToSeconds(msHealthSleep.duration) : 0,
    awake_duration: msHealthSleep.awakeDuration ? baseMsHealthModel.durationToSeconds(msHealthSleep.awakeDuration) : 0,
    sleep_duration: msHealthSleep.sleepDuration ? baseMsHealthModel.durationToSeconds(msHealthSleep.sleepDuration) : 0,
    restless_sleep_duration: msHealthSleep.totalRestlessSleepDuration ? baseMsHealthModel.durationToSeconds(msHealthSleep.totalRestlessSleepDuration) : 0,
    restfull_sleep_duration: msHealthSleep.totalRestfulSleepDuration ? baseMsHealthModel.durationToSeconds(msHealthSleep.totalRestfulSleepDuration) : 0,
    time_to_fall_asleep: msHealthSleep.fallAsleepDuration ? baseMsHealthModel.durationToSeconds(msHealthSleep.fallAsleepDuration) : 0,
    sleep_efficiency: msHealthSleep.sleepEfficiencyPercentage
  };

  sleep = baseMsHealthModel.getDayId(msHealthSleep, sleep);
  sleep = baseMsHealthModel.getStartAndEndTime(msHealthSleep, sleep);
  sleep = baseMsHealthModel.getCaloricSummary(msHealthSleep, sleep);
  sleep = baseMsHealthModel.getHeartRateSummary(msHealthSleep, sleep);

  return sleep;
};
