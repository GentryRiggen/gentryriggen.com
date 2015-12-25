var baseMsHealthModel = require('./baseMsHealth.model');

exports.toJson = function (dailySummaryHour) {
  return {
    id: dailySummaryHour.id,
    userDailySummaryId: dailySummaryHour.user_daily_summary,
    dayId: dailySummaryHour.day_id.formatLocalYearMonthDay(),
    startTime: dailySummaryHour.start_time.toLocalMysqlFormat(),
    endTime: dailySummaryHour.end_time.toLocalMysqlFormat(),
    stepsTaken: dailySummaryHour.steps_taken,
    caloriesBurned: dailySummaryHour.calories_burned,
    averageHeartRate: dailySummaryHour.average_heart_rate,
    peakHeartRate: dailySummaryHour.peak_heart_rate,
    lowestHeartRate: dailySummaryHour.lowest_heart_rate
  };
};

exports.toHoursChartJson = function (hours) {
  var labels = [],
    calorieData = [],
    heartRateData = [],
    stepsData = [];

  hours.forEach(function (hour) {
    labels.push(baseMsHealthModel.getLocalMoment(hour.startTime).format('hA') + ' - ' + baseMsHealthModel.getLocalMoment(hour.endTime).format('hA'));
    calorieData.push(hour.caloriesBurned);
    heartRateData.push(hour.averageHeartRate);
    stepsData.push(hour.stepsTaken);
  });

  var primaryDataSet = baseMsHealthModel.getChartOptions('Line', 'Calories', 'primary');
  primaryDataSet.data = calorieData;

  var secondaryDataSet = baseMsHealthModel.getChartOptions('Line', 'Avg Heart Rate', 'secondary');
  secondaryDataSet.data = heartRateData;

  return {
    labels: labels,
    datasets: [primaryDataSet, secondaryDataSet]
  };
};

exports.fromJson = function (msHealthDailySummaryHour) {
  var dailySummaryHour = {
    steps_taken: msHealthDailySummaryHour.stepsTaken
  };

  dailySummaryHour = baseMsHealthModel.getDayId(msHealthDailySummaryHour, dailySummaryHour);
  dailySummaryHour = baseMsHealthModel.getStartAndEndTime(msHealthDailySummaryHour, dailySummaryHour);
  dailySummaryHour = baseMsHealthModel.getCaloricSummary(msHealthDailySummaryHour, dailySummaryHour);
  dailySummaryHour = baseMsHealthModel.getHeartRateSummary(msHealthDailySummaryHour, dailySummaryHour);

  return dailySummaryHour;
};
