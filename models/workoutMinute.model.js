var baseMsHealthModel = require('./baseMsHealth.model'),
  conf = require('../config/conf');

exports.toJson = function (workoutMinute) {
  return {
    id: workoutMinute.id,
    userWorkoutId: workoutMinute.user_workout_id,
    startTime: workoutMinute.start_time.toLocalMysqlFormat(),
    endTime: workoutMinute.end_time.toLocalMysqlFormat(),
    stepsTaken: workoutMinute.steps_taken,
    caloriesBurned: workoutMinute.calories_burned,
    averageHeartRate: workoutMinute.average_heart_rate,
    peakHeartRate: workoutMinute.peak_heart_rate,
    lowestHeartRate: workoutMinute.lowest_heart_rate
  };
};

exports.toMinutesChartJson = function (minutes) {
  var labels = [],
    calorieData = [],
    heartRateData = [];

  for (var i = 0; i < minutes.length; i++) {
    labels.push(i + 1);
    calorieData.push(minutes[i].caloriesBurned);
    heartRateData.push(minutes[i].averageHeartRate);
  }

  var primaryDataSet = baseMsHealthModel.getChartOptions('Line', 'Calories', 'primary');
  primaryDataSet.data = calorieData;

  var secondaryDataSet = baseMsHealthModel.getChartOptions('Line', 'Avg Heart Rate', 'secondary');
  secondaryDataSet.data = heartRateData;

  return {
    labels: labels,
    datasets: [primaryDataSet, secondaryDataSet]
  };
};

exports.fromJson = function (msHealthWorkoutMinute) {
  var workoutMinute = {
    steps_taken: msHealthWorkoutMinute.stepsTaken
  };

  workoutMinute = baseMsHealthModel.getStartAndEndTime(msHealthWorkoutMinute, workoutMinute);
  workoutMinute = baseMsHealthModel.getCaloricSummary(msHealthWorkoutMinute, workoutMinute);
  workoutMinute = baseMsHealthModel.getHeartRateSummary(msHealthWorkoutMinute, workoutMinute);

  return workoutMinute;
};
