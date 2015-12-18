var baseMsHealthModel = require('./baseMsHealth.model');

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

exports.toMinutesChartJson = function (minutes) {
  var labels = [],
    calorieData = [],
    heartRateData = [],
    rollingHeartRateCount = 0;

  for (var i = 0; i < minutes.length; i++) {
    if (i > 0 && i % 15 === 0) {
      var avg = Math.round((i/60)*100)/100;
      var label = (avg > 1 ? avg : 1) + ' hour(s)';
      labels.push(label);

      heartRateData.push(Math.round(rollingHeartRateCount / 15));
      rollingHeartRateCount = 0;
    } else {
      rollingHeartRateCount += minutes[i].averageHeartRate;
    }
  }

  var primaryDataSet = baseMsHealthModel.getChartOptions('Line', 'Avg Heart Rate', 'primary');
  primaryDataSet.data = heartRateData;

  return {
    labels: labels,
    datasets: [primaryDataSet]
  };
};

exports.fromJson = function (msHealthSleepMinute) {
  var sleepMinute = {};

  sleepMinute = baseMsHealthModel.getStartAndEndTime(msHealthSleepMinute, sleepMinute);
  sleepMinute = baseMsHealthModel.getCaloricSummary(msHealthSleepMinute, sleepMinute);
  sleepMinute = baseMsHealthModel.getHeartRateSummary(msHealthSleepMinute, sleepMinute);

  return sleepMinute;
};
