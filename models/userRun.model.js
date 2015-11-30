var baseMsHealthModel = require('./baseMsHealth.model'),
  conf = require('../config/conf');

exports.toJson = function (run) {
  return {
    id: run.id,
    msHealthId: run.mshealth_id,
    userId: run.user_id,
    dayId: run.day_id,
    finishHeartRate: run.finish_heart_rate,
    totalDistance: run.total_distance,
    actualDistance: run.actual_distance,
    elevationGain: run.elevation_gain,
    elevationLoss: run.elevation_loss,
    pace: run.pace,
    splitDistance: run.split_distance,
    underAerobicTime: run.under_aerobic_time,
    aerobicTime: run.aerobic_time,
    anaerobicTime: run.anaerobic_time,
    fitnessZoneTime: run.fitness_zone_time,
    healthyHeartTime: run.healthy_heart_time,
    redlineTime: run.redline_time,
    startTime: run.start_time,
    endTime: run.end_time,
    duration: run.duration,
    caloriesBurned: run.calories_burned,
    averageHeartRate: run.average_heart_rate,
    peakHeartRate: run.peak_heart_rate,
    lowestHeartRate: run.lowest_heart_rate
  };
};

exports.fromJson = function (msHealthRun) {
  var run = {
    mshealth_id: msHealthRun.id,
    user_id: conf.msftHealth.gentryId,
    start_time: (new Date(msHealthRun.startTime)).toMysqlFormat(),
    end_time: (new Date(msHealthRun.endTime)).toMysqlFormat(),
    day_id: (new Date(msHealthRun.dayId)).formatYearMonthDay(),
    duration: baseMsHealthModel.durationToSeconds(msHealthRun.duration),
    split_distance: msHealthRun.splitDistance
  };

  run = baseMsHealthModel.getPerformanceSummary(msHealthRun, run);
  run = baseMsHealthModel.getCaloricSummary(msHealthRun, run);
  run = baseMsHealthModel.getHeartRateSummary(msHealthRun, run);
  run = baseMsHealthModel.getDistanceSummary(msHealthRun, run);

  return run;
};
