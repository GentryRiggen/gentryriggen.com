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
  var chartData = {
    chart: {
      type: 'area'
    },
    title: {
      text: 'Sleep Breakdown'
    },
    xAxis: {
      categories: []
    },
    yAxis: {
      title: {
        text: 'Heart Rate'
      }
    },
    series: [
      {name: 'Heart Rate', data: []}
    ]
  };

  var lastHeartRate = 0,
    rollingHeartRateCount = 0;
  for (var i = 0; i < minutes.length; i++) {
    if (i > 0 && i % 15 === 0) {
      var avg = Math.round((i / 60) * 100) / 100;
      var label = avg + ' hour(s)';
      chartData.xAxis.categories.push(label);

      chartData.series[0].data.push(Math.round(rollingHeartRateCount / 15));
      rollingHeartRateCount = 0;
    }

    if (minutes[i].averageHeartRate > 1) {
      lastHeartRate = minutes[i].averageHeartRate;
    }
    if (lastHeartRate < 1) {
      lastHeartRate = 60;
    }
    rollingHeartRateCount += lastHeartRate;
  }

  return chartData;
};

exports.fromJson = function (msHealthSleepMinute) {
  var sleepMinute = {};

  sleepMinute = baseMsHealthModel.getStartAndEndTime(msHealthSleepMinute, sleepMinute);
  sleepMinute = baseMsHealthModel.getCaloricSummary(msHealthSleepMinute, sleepMinute);
  sleepMinute = baseMsHealthModel.getHeartRateSummary(msHealthSleepMinute, sleepMinute);

  return sleepMinute;
};
