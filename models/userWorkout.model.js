var baseMsHealthModel = require('./baseMsHealth.model'),
  conf = require('../config/conf');

exports.toJson = function (workout) {
  return {
    id: workout.id,
    msHealthId: workout.mshealth_id,
    userId: workout.user_id,
    dayId: workout.day_id,
    startTime: workout.start_time,
    endTime: workout.end_time,
    duration: workout.duration,
    caloriesBurned: workout.calories_burned,
    averageHeartRate: workout.average_heart_rate,
    peakHeartRate: workout.peak_heart_rate,
    lowestHeartRate: workout.lowest_heart_rate,
    finishHeartRate: workout.finish_heart_rate,
    underAerobicTime: workout.under_aerobic_time,
    aerobicTime: workout.aerobic_time,
    anaerobicTime: workout.anaerobic_time,
    fitnessZoneTime: workout.fitness_zone_time,
    healthyHeartTime: workout.healthy_heart_time,
    redlineTime: workout.redline_time
  };
};

exports.fromJson = function (msHealthWorkout) {
  var workout = {
    mshealth_id: msHealthWorkout.id,
    user_id: conf.msftHealth.gentryId,
    start_time: (new Date(msHealthWorkout.startTime)).toLocalMysqlFormat(),
    end_time: (new Date(msHealthWorkout.endTime)).toLocalMysqlFormat(),
    day_id: (new Date(msHealthWorkout.dayId)).formatLocalYearMonthDay(),
    duration: baseMsHealthModel.durationToSeconds(msHealthWorkout.duration)
  };

  workout = baseMsHealthModel.getPerformanceSummary(msHealthWorkout, workout);
  workout = baseMsHealthModel.getCaloricSummary(msHealthWorkout, workout);
  workout = baseMsHealthModel.getHeartRateSummary(msHealthWorkout, workout);

  return workout;
};
