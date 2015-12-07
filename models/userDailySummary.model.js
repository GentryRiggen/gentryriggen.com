var baseMsHealthModel = require('./baseMsHealth.model'),
  conf = require('../config/conf');

exports.toJson = function (dailySummary) {
  var json = {
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

  // CALORIES DOUGHNUT CHART
  var caloriesDoughnut = baseMsHealthModel.getChartOptions('Doughnut', 'Calories Burned', 'primary');
  caloriesDoughnut.value = json.caloriesBurned;
  var caloriesRemainingDoughnut = baseMsHealthModel.getChartOptions('Doughnut', 'Remaining to Goal', 'secondary');
  caloriesRemainingDoughnut.value = json.caloriesBurned > 3000 ? 0 : 3000 - json.caloriesBurned;
  json.chartCalories = [caloriesDoughnut, caloriesRemainingDoughnut];

  // STEPS DOUGHNUT CHART
  var stepsDoughnut = baseMsHealthModel.getChartOptions('Doughnut', 'Steps Taken', 'primary');
  stepsDoughnut.value = json.stepsTaken;
  var stepsRemainingDoughnut = baseMsHealthModel.getChartOptions('Doughnut', 'Remaining to Goal', 'secondary');
  stepsRemainingDoughnut.value = json.stepsTaken > 9000 ? 0 : 9000 - json.stepsTaken;
  json.chartSteps = [stepsDoughnut, stepsRemainingDoughnut];

  return json;
};

exports.fromJson = function (msHealthDailySummary) {
  var dailySummary = {
    user_id: conf.msftHealth.gentryId,
    steps_taken: msHealthDailySummary.stepsTaken,
    distance: msHealthDailySummary.distanceSummary.totalDistance
  };

  dailySummary = baseMsHealthModel.getDayId(msHealthDailySummary, dailySummary);
  dailySummary = baseMsHealthModel.getCaloricSummary(msHealthDailySummary, dailySummary);
  dailySummary = baseMsHealthModel.getHeartRateSummary(msHealthDailySummary, dailySummary);


  return dailySummary;
};
