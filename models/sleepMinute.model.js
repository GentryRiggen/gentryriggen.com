var baseMsHealthModel = require('./baseMsHealth.model'),
  conf = require('../config/conf');

exports.toJson = function (sleepMinute) {
  return {
    id: sleepMinute.id,
    userSleepId: sleepMinute.user_sleep_id,
    startTime: sleepMinute.start_time.toLocalMysqlFormat(),
    endTime: sleepMinute.end_time.toLocalMysqlFormat(),
    caloriesBurned: sleepMinute.calories_burned,
    averageHeartRate: sleepMinute.average_heart_rate,
    peakHeartRate: sleepMinute.peak_heart_rate,
    lowestHeartRate: sleepMinute.lowest_heart_rate
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

exports.fromJson = function (msHealthSleepMinute) {
  var sleepMinute = {};

  sleepMinute = baseMsHealthModel.getStartAndEndTime(msHealthSleepMinute, sleepMinute);
  sleepMinute = baseMsHealthModel.getCaloricSummary(msHealthSleepMinute, sleepMinute);
  sleepMinute = baseMsHealthModel.getHeartRateSummary(msHealthSleepMinute, sleepMinute);

  return sleepMinute;
};
