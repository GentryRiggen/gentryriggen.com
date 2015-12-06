var baseMsHealthModel = require('./baseMsHealth.model'),
  conf = require('../config/conf');

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
    heartRateData = [];

  hours.forEach(function (hour) {
    labels.push(baseMsHealthModel.getLocalMoment(hour.startTime).format('hA') + ' - ' + baseMsHealthModel.getLocalMoment(hour.endTime).format('hA'));
    calorieData.push(hour.caloriesBurned);
    heartRateData.push(hour.averageHeartRate);
  });

  return {
    labels: labels,
    datasets: [
      {
        label: 'Calories',
        fillColor: "rgba(" + conf.colors.primaryRGB.R + "," + conf.colors.primaryRGB.G + "," + conf.colors.primaryRGB.B + ",.75)",
        strokeColor: "rgba(" + (conf.colors.primaryRGB.R + 10) + "," + (conf.colors.primaryRGB.G + 10) + "," + (conf.colors.primaryRGB.B + 10) + ",.75)",
        highlightFill: "rgba(" + conf.colors.primaryRGB.R + "," + conf.colors.primaryRGB.G + "," + conf.colors.primaryRGB.B + ",1)",
        highlightStroke: "rgba(" + (conf.colors.primaryRGB.R + 10) + "," + (conf.colors.primaryRGB.G + 10) + "," + (conf.colors.primaryRGB.B + 10) + ",1)",
        data: calorieData
      },
      {
        label: 'Avg Heart Rate',
        fillColor: "rgba(" + conf.colors.secondaryRGB.R + "," + conf.colors.secondaryRGB.G + "," + conf.colors.secondaryRGB.B + ",.75)",
        strokeColor: "rgba(" + (conf.colors.secondaryRGB.R + 10) + "," + (conf.colors.secondaryRGB.G + 10) + "," + (conf.colors.secondaryRGB.B + 10) + ",.75)",
        highlightFill: "rgba(" + conf.colors.secondaryRGB.R + "," + conf.colors.secondaryRGB.G + "," + conf.colors.secondaryRGB.B + ",1)",
        highlightStroke: "rgba(" + (conf.colors.secondaryRGB.R + 10) + "," + (conf.colors.secondaryRGB.G + 10) + "," + (conf.colors.secondaryRGB.B + 10) + ",1)",
        data: heartRateData
      }
    ]
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
