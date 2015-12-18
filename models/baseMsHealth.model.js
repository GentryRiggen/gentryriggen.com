var moment = require('moment'),
  conf = require('../config/conf');
require('moment-timezone');

var baseModel = {};

// P[n]DT[n]H[n]M[n]S
// NDays - NHours - NMinutes - NSeconds
baseModel.durationToSeconds = function (duration) {
  var seconds = 0, startIndex;
  if (duration.indexOf('D') > 0) {
    var days = parseInt(duration.substr(1, duration.indexOf('D')));
    seconds += days * (24 * 60 * 60);
  }

  if (duration.indexOf('H') > 0) {
    var hours = parseInt(duration.substr((duration.indexOf('T') + 1), duration.indexOf('H')));
    seconds += hours * (60 * 60);
  }

  if (duration.indexOf('M') > 0) {
    startIndex = duration.indexOf('H') > 0 ? (duration.indexOf('H') + 1) : (duration.indexOf('T') + 1);
    var minutes = parseInt(duration.substr(startIndex, duration.indexOf('M')));
    seconds += minutes * 60;
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

baseModel.getDayId = function (msHealthModel, dbModel) {
  dbModel.day_id = moment(msHealthModel.startTime).tz(conf.msftHealth.timeZone).toDate().formatLocalYearMonthDay();

  return dbModel;
};

baseModel.getStartAndEndTime = function (msHealthModel, dbModel) {
  dbModel.start_time = moment(msHealthModel.startTime).tz(conf.msftHealth.timeZone).toDate().toLocalMysqlFormat();
  dbModel.end_time = moment(msHealthModel.endTime).tz(conf.msftHealth.timeZone).toDate().toLocalMysqlFormat();

  return dbModel;
};

baseModel.getLocalMoment = function (date) {
  return moment(date).tz(conf.msftHealth.timeZone);
};

baseModel.getPrimaryRGBString = function (opacity) {
  return 'rgba(' + conf.colors.primaryRGB.R + ',' + conf.colors.primaryRGB.G + ',' + conf.colors.primaryRGB.B + ',' + opacity + ')';
};

baseModel.getSecondaryRGBString = function (opacity) {
  return 'rgba(' + conf.colors.secondaryRGB.R + ',' + conf.colors.secondaryRGB.G + ',' + conf.colors.secondaryRGB.B + ',' + opacity + ')';
};

baseModel.getChartOptions = function (type, title, color) {
  var primaryRGB, primaryHex, secondaryRGB, secondaryHex;
  switch (color) {
    case 'primary':
      primaryRGB = baseModel.getPrimaryRGBString('.75');
      primaryHex = conf.colors.primaryHex;
      secondaryRGB = baseModel.getPrimaryRGBString('1');
      secondaryHex = conf.colors.primaryHighlightHex;
      break;
    case 'secondary':
      primaryRGB = baseModel.getSecondaryRGBString('.75');
      primaryHex = conf.colors.secondaryHex;
      secondaryRGB = baseModel.getSecondaryRGBString('1');
      secondaryHex = conf.colors.secondaryHighlightHex;
      break;
    case 'tertiary':
      primaryRGB = baseModel.getSecondaryRGBString('.75');
      primaryHex = conf.colors.secondaryHex;
      secondaryRGB = baseModel.getSecondaryRGBString('1');
      secondaryHex = conf.colors.secondaryHighlightHex;
      break;
  }

  var chart = {
    label: title
  };

  switch (type) {
    case 'Bar':
      chart.highlightFill = secondaryRGB;
      chart.highlightStroke = secondaryRGB;
      chart.fillColor = primaryRGB;
      chart.strokeColor = primaryRGB;
      chart.data = [];
      break;
    case 'Line':
      chart.pointColor = primaryRGB;
      chart.pointStrokeColor = '#fff';
      chart.pointHighlightFill = '#fff';
      chart.pointHighlightStroke = secondaryRGB;
      chart.fillColor = primaryRGB;
      chart.strokeColor = primaryRGB;
      chart.data = [];
      break;
    case 'Doughnut':
      chart.color = primaryHex;
      chart.highlight = secondaryHex;
      chart.value = 0;
      break;
  }

  return chart;
};

baseModel.toMinutesChartJson = function (minutes) {
  var labels = [],
    calorieData = [],
    heartRateData = [];

  for (var i = 0; i < minutes.length; i++) {
    labels.push(i + 1);
    calorieData.push(minutes[i].caloriesBurned);
    heartRateData.push(minutes[i].averageHeartRate);
  }

  var primaryDataSet = baseModel.getChartOptions('Line', 'Avg Heart Rate', 'primary');
  primaryDataSet.data = heartRateData;

  var secondaryDataSet = baseModel.getChartOptions('Line', 'Calories', 'secondary');
  secondaryDataSet.data = calorieData;

  return {
    labels: labels,
    datasets: [primaryDataSet, secondaryDataSet]
  };
};

module.exports = baseModel;
