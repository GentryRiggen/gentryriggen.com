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
  var chartData = {
    chart: {
      type: 'column'
    },
    title: {
      text: 'Hourly Breakdown'
    },
    xAxis: {
      categories: []
    },
    yAxis: {
      title: {
        text: 'Calories / Steps / Heart Rate'
      }
    },
    series: [
      {name: 'Calories', data: []},
      {name: 'Heart Rate', data: []}
    ]
  };

  hours.forEach(function (hour) {
    chartData.xAxis.categories.push(baseMsHealthModel.getLocalMoment(hour.startTime).format('hA') + ' - ' + baseMsHealthModel.getLocalMoment(hour.endTime).format('hA'));
    chartData.series[0].data.push(hour.caloriesBurned);
    chartData.series[1].data.push(hour.averageHeartRate);
  });

  return chartData
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
