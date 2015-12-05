var baseMsHealthModel = require('./baseMsHealth.model'),
  conf = require('../config/conf');

exports.toJson = function (dailySummary) {
  return {
    id: dailySummary.id,
    userId: dailySummary.user_id,
    dayId: dailySummary.day_id,
    stepsTaken: dailySummary.steps_taken,
    caloriesBurned: dailySummary.calories_burned,
    distance: dailySummary.distance,
    averageHeartRate: dailySummary.average_heart_rate,
    peakHeartRate: dailySummary.peak_heart_rate,
    lowestHeartRate: dailySummary.lowest_heart_rate
  };
};

exports.fromJson = function (msHealthDailySummary) {
  var dailySummary = {
    user_id: conf.msftHealth.gentryId,
    day_id: (new Date(msHealthDailySummary.parentDay)).formatLocalYearMonthDay(),
    steps_taken: msHealthDailySummary.stepsTaken,
    distance: msHealthDailySummary.distanceSummary.totalDistance
  };

  dailySummary = baseMsHealthModel.getCaloricSummary(msHealthDailySummary, dailySummary);
  dailySummary = baseMsHealthModel.getHeartRateSummary(msHealthDailySummary, dailySummary);


  return dailySummary;
};
