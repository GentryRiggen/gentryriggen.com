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
  json.chartCalories = {
    chart: {
      plotBackgroundColor: null,
      plotBorderWidth: 0,
      plotShadow: false
    },
    title: {
      text: 'Daily Calorie Goal',
      align: 'center',
      verticalAlign: 'middle',
      y: 115
    },
    plotOptions: {
      pie: {
        startAngle: -90,
        endAngle: 90,
        center: ['50%', '75%']
      }
    },
    series: [
      {
        type: 'pie', name: 'Calories', innerSize: '50%',
        data: [
          ['Burned', json.caloriesBurned],
          ['Remaining', json.caloriesBurned > 3000 ? 0 : (3000 - json.caloriesBurned)]
        ]
      }
    ]
  };

  // STEPS DOUGHNUT CHART
  json.chartSteps = {
    chart: {
      plotBackgroundColor: null,
      plotBorderWidth: 0,
      plotShadow: false
    },
    title: {
      text: 'Daily Steps Goal',
      align: 'center',
      verticalAlign: 'middle',
      y: 115
    },
    plotOptions: {
      pie: {
        startAngle: -90,
        endAngle: 90,
        center: ['50%', '75%']
      }
    },
    series: [
      {
        type: 'pie', name: 'Steps Taken', innerSize: '50%',
        data: [
          ['Taken', json.stepsTaken],
          ['Remaining', json.stepsTaken > 9000 ? 0 : (9000 - json.stepsTaken)]
        ]
      }
    ]
  };

  return json;
};

exports.getActivityLevelByMonthsData = function (data) {
  var labels = [],
    calorieData = [],
    stepsData = [];

  for (var i = 0; i < data.length; i++) {
    labels.push(data[i].month);
    calorieData.push(data[i].avgCals);
    stepsData.push(data[i].avgSteps);
  }

  var primaryDataSet = baseMsHealthModel.getChartOptions('Line', 'Avg Calories', 'primary');
  primaryDataSet.data = calorieData;

  var secondaryDataSet = baseMsHealthModel.getChartOptions('Line', 'Avg Steps', 'secondary');
  secondaryDataSet.data = stepsData;

  return {
    labels: labels,
    datasets: [primaryDataSet, secondaryDataSet]
  };
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
