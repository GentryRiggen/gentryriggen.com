var baseMsHealthModel = require('./baseMsHealth.model'),
  conf = require('../config/conf');

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

exports.toHoursChartJson = function (minutes) {
  var labels = [],
    calorieData = [],
    heartRateData = [];

  for (var i = 0; i < minutes.length; i++) {
    labels.push(i + 1);
    calorieData.push(minutes[i].caloriesBurned);
    heartRateData.push(minutes[i].averageHeartRate);
  }

  var primaryDataSet = baseMsHealthModel.getPrimaryBarChartDataSet('Calories');
  primaryDataSet.data = calorieData;

  var secondaryDataSet = baseMsHealthModel.getPrimaryBarChartDataSet('Avg Heart Rate');
  secondaryDataSet.data = heartRateData;

  return {
    labels: labels,
    datasets: [primaryDataSet, secondaryDataSet]
  };
};

exports.fromJson = function (msHealthRunMinute) {
  var runMinute = {
    steps_taken: msHealthRunMinute.stepsTaken
  };

  runMinute = baseMsHealthModel.getStartAndEndTime(msHealthRunMinute, runMinute);
  runMinute = baseMsHealthModel.getCaloricSummary(msHealthRunMinute, runMinute);
  runMinute = baseMsHealthModel.getHeartRateSummary(msHealthRunMinute, runMinute);

  return runMinute;
};
