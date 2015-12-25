var baseMsHealthModel = require('./baseMsHealth.model');

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

exports.toMinutesChartJson = baseMsHealthModel.toMinutesChartJson;

exports.fromJson = function (msHealthWorkoutMinute) {
  var workoutMinute = {
    steps_taken: msHealthWorkoutMinute.stepsTaken
  };

  workoutMinute = baseMsHealthModel.getStartAndEndTime(msHealthWorkoutMinute, workoutMinute);
  workoutMinute = baseMsHealthModel.getCaloricSummary(msHealthWorkoutMinute, workoutMinute);
  workoutMinute = baseMsHealthModel.getHeartRateSummary(msHealthWorkoutMinute, workoutMinute);

  return workoutMinute;
};
