var baseMsHealthModel = require('./baseMsHealth.model'),
  conf = require('../config/conf');

exports.toJson = function (sleepSegment) {
  return {
    id: sleepSegment.id,
    userSleepId: sleepSegment.user_sleep_id,
    startTime: sleepSegment.start_time.toLocalMysqlFormat(),
    endTime: sleepSegment.end_time.toLocalMysqlFormat(),
    duration: sleepSegment.duration,
    caloriesBurned: sleepSegment.calories_burned,
    averageHeartRate: sleepSegment.average_heart_rate,
    peakHeartRate: sleepSegment.peak_heart_rate,
    lowestHeartRate: sleepSegment.lowest_heart_rate,
    segmentType: sleepSegment.segment_type,
    sleepType: sleepSegment.sleep_type
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

exports.fromJson = function (msHealthSleepSegment) {
  var sleepSegment = {
    segment_type: msHealthSleepSegment.segmentType,
    sleep_type: msHealthSleepSegment.sleep_type
  };

  sleepSegment = baseMsHealthModel.getStartAndEndTime(msHealthSleepSegment, sleepSegment);
  sleepSegment = baseMsHealthModel.getCaloricSummary(msHealthSleepSegment, sleepSegment);
  sleepSegment = baseMsHealthModel.getHeartRateSummary(msHealthSleepSegment, sleepSegment);

  return sleepSegment;
};
