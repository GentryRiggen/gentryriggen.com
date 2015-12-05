var baseMsHealthModel = require('./baseMsHealth.model');

exports.toJson = function (dailySummaryHour) {
  return {
    id: dailySummaryHour.id,
    userDailySummaryId: dailySummaryHour.user_daily_summary,
    dayId: dailySummaryHour.day_id,
    startTime: dailySummaryHour.start_time,
    endTime: dailySummaryHour.end_time,
    stepsTaken: dailySummaryHour.steps_taken,
    caloriesBurned: dailySummaryHour.calories_burned,
    averageHeartRate: dailySummaryHour.average_heart_rate,
    peakHeartRate: dailySummaryHour.peak_heart_rate,
    lowestHeartRate: dailySummaryHour.lowest_heart_rate
  };
};

exports.fromJson = function (msHealthDailySummaryHour) {
  var dailySummary = {
    start_time: (new Date(msHealthDailySummaryHour.startTime)).toLocalMysqlFormat(),
    end_time: (new Date(msHealthDailySummaryHour.endTime)).toLocalMysqlFormat(),
    day_id: (new Date(msHealthDailySummaryHour.parentDay)).formatLocalYearMonthDay(),
    steps_taken: msHealthDailySummaryHour.stepsTaken
  };

  dailySummary = baseMsHealthModel.getCaloricSummary(msHealthDailySummaryHour, dailySummary);
  dailySummary = baseMsHealthModel.getHeartRateSummary(msHealthDailySummaryHour, dailySummary);

  return dailySummary;
};
