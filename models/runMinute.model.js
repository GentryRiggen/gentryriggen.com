var baseMsHealthModel = require('./baseMsHealth.model');

exports.toJson = function (runMinute) {
  return {
    id: runMinute.id,
    userRunId: runMinute.user_run_id,
    startTime: runMinute.start_time.toLocalMysqlFormat(),
    endTime: runMinute.end_time.toLocalMysqlFormat(),
    stepsTaken: runMinute.steps_taken,
    caloriesBurned: runMinute.calories_burned,
    averageHeartRate: runMinute.average_heart_rate,
    peakHeartRate: runMinute.peak_heart_rate,
    lowestHeartRate: runMinute.lowest_heart_rate
  };
};

exports.toMinutesChartJson = baseMsHealthModel.toMinutesChartJson;

exports.fromJson = function (msHealthRunMinute) {
  var runMinute = {
    steps_taken: msHealthRunMinute.stepsTaken
  };

  runMinute = baseMsHealthModel.getStartAndEndTime(msHealthRunMinute, runMinute);
  runMinute = baseMsHealthModel.getCaloricSummary(msHealthRunMinute, runMinute);
  runMinute = baseMsHealthModel.getHeartRateSummary(msHealthRunMinute, runMinute);

  return runMinute;
};
