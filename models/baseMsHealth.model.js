var baseModel = {};

// P[n]DT[n]H[n]M[n]S
// NDays - NHours - NMinutes - NSeconds
baseModel.durationToSeconds = function (duration) {
  var seconds = 0, startIndex;
  if (duration.indexOf('D') > 0) {
    var days = parseInt(duration.substr(1, duration.indexOf('D')));
    seconds += days*(24*60*60);
  }

  if (duration.indexOf('H') > 0) {
    var hours = parseInt(duration.substr((duration.indexOf('T') + 1), duration.indexOf('H')));
    seconds += hours*(60*60);
  }

  if (duration.indexOf('M') > 0) {
    startIndex = duration.indexOf('H') > 0 ? (duration.indexOf('H') + 1) : (duration.indexOf('T') + 1);
    var minutes = parseInt(duration.substr(startIndex, duration.indexOf('M')));
    seconds += minutes*60;
  }

  if (duration.indexOf('S') > 0) {
    startIndex = duration.indexOf('M') > 0 ? (duration.indexOf('M') + 1) : (duration.indexOf('T') + 1);
    seconds += parseInt(duration.substr(startIndex, duration.indexOf('S')));
  }

  return seconds;
};

baseModel.getPerformanceSummary = function (msHealthModel, dbModel) {
  if (msHealthModel.performanceSummary) {
    dbModel.finish_heart_rate = msHealthModel.performanceSummary.finishHeartRate;
    if (msHealthModel.performanceSummary.heartRateZones) {
      dbModel.under_aerobic_time = msHealthModel.performanceSummary.heartRateZones.underAerobic ?
        msHealthModel.performanceSummary.heartRateZones.underAerobic : 0;
      dbModel.aerobic_time = msHealthModel.performanceSummary.heartRateZones.aerobic ?
        msHealthModel.performanceSummary.heartRateZones.aerobic : 0;
      dbModel.anaerobic_time = msHealthModel.performanceSummary.heartRateZones.anaerobic ?
        msHealthModel.performanceSummary.heartRateZones.anaerobic : 0;
      dbModel.fitness_zone_time = msHealthModel.performanceSummary.heartRateZones.fitnessZone ?
        msHealthModel.performanceSummary.heartRateZones.fitnessZone : 0;
      dbModel.healthy_heart_time = msHealthModel.performanceSummary.heartRateZones.healthyHeart ?
        msHealthModel.performanceSummary.heartRateZones.healthyHeart : 0;
      dbModel.redline_time = msHealthModel.performanceSummary.heartRateZones.redline ?
        msHealthModel.performanceSummary.heartRateZones.redline : 0;
    } else {
      dbModel.under_aerobic_time = 0;
      dbModel.aerobic_time = 0;
      dbModel.fitness_zone_time = 0;
      dbModel.healthy_heart_time = 0;
      dbModel.redline_time = 0;
    }
  } else {
    dbModel.finish_heart_rate = 0;
  }

  return dbModel;
};

baseModel.getCaloricSummary = function (msHealthModel, dbModel) {
  if (msHealthModel.caloriesBurnedSummary) {
    dbModel.calories_burned = msHealthModel.caloriesBurnedSummary.totalCalories ?
      msHealthModel.caloriesBurnedSummary.totalCalories : 0;
  } else {
    dbModel.calories_burned = 0;
  }

  return dbModel;
};

baseModel.getHeartRateSummary = function (msHealthModel, dbModel) {
  if (msHealthModel.heartRateSummary) {
    dbModel.average_heart_rate = msHealthModel.heartRateSummary.averageHeartRate ?
      msHealthModel.heartRateSummary.averageHeartRate : 0;
    dbModel.peak_heart_rate = msHealthModel.heartRateSummary.peakHeartRate ?
      msHealthModel.heartRateSummary.peakHeartRate : 0;
    dbModel.lowest_heart_rate = msHealthModel.heartRateSummary.lowestHeartRate ?
      msHealthModel.heartRateSummary.lowestHeartRate : 0;
  } else {
    dbModel.average_heart_rate = 0;
    dbModel.peak_heart_rate = 0;
    dbModel.lowest_heart_rate = 0;
  }

  return dbModel;
};

baseModel.getDistanceSummary = function (msHealthModel, dbModel) {
  if (msHealthModel.distanceSummary) {
    dbModel.total_distance = msHealthModel.distanceSummary.totalDistance ?
      msHealthModel.distanceSummary.totalDistance : 0;
    dbModel.actual_distance = msHealthModel.distanceSummary.actualDistance ?
      msHealthModel.distanceSummary.actualDistance : 0;
    dbModel.elevation_gain = msHealthModel.distanceSummary.elevationGain ?
      msHealthModel.distanceSummary.elevationGain : 0;
    dbModel.elevation_loss = msHealthModel.distanceSummary.elevationLoss ?
      msHealthModel.distanceSummary.elevationLoss : 0;
    dbModel.pace = msHealthModel.distanceSummary.pace ?
      msHealthModel.distanceSummary.pace : 0;
  } else {
    dbModel.total_distance = 0;
    dbModel.actual_distance = 0;
    dbModel.elevation_gain = 0;
    dbModel.elevation_loss = 0;
    dbModel.pace = 0;
  }

  return dbModel;
};

module.exports = baseModel;
