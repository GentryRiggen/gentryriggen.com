const Q = require('q');
const db = require('../../db');
const model = require('../models/generic.model');
const baseRepo = require('../../repos/base.repo')('broboto_pong_match', model);

const repo = {};
repo.getById = baseRepo.getById;
repo.createOrUpdate = baseRepo.createOrUpdate;
repo.del = baseRepo.del;

repo.getMatchHistory = (seasonId, meId, againstId) => {
  const dfd = Q.defer();
  const sql = `
  SELECT
    pongMatch.seasonId
    , CASE
        WHEN pongMatch.loserId = ? THEN 0
        ELSE 1
      END AS won
  FROM broboto_pong_match AS pongMatch
  WHERE
    (pongMatch.loserId = ? OR pongMatch.winnerId = ?)
    AND (pongMatch.loserId = ? OR pongMatch.winnerId = ?)
  `;
  const query = db.raw(sql, [meId, meId, meId, againstId, againstId]);
  query.then((results) => {
    let seasonWins = 0;
    let seasonLosses = 0;
    let allTimeWins = 0;
    let allTimeLosses = 0;
    results[0].forEach((match) => {
      if (match.won) {
        allTimeWins++;
        if (match.seasonId === seasonId) seasonWins++;
      } else {
        allTimeLosses++;
        if (match.seasonId === seasonId) seasonLosses++;
      }
    });

    const seasonGamesTotal = seasonWins + seasonLosses;
    const seasonAverage = seasonGamesTotal > 0
      ? ((seasonWins / (seasonWins + seasonLosses)) * 100).toFixed(1) + '%'
      : '0%';

    const allTimeGamesTotal = allTimeWins + allTimeLosses;
    const allTimeAverage = allTimeGamesTotal > 0
      ? ((allTimeWins / (allTimeWins + allTimeLosses))* 100).toFixed(1) + '%'
      : '0%';

    const sDiff = seasonWins - seasonLosses;
    const seasonDifference = sDiff > 0 ? `+${sDiff}` : sDiff;
    const aDiff = allTimeWins - allTimeLosses;
    const allTimeDifference = aDiff > 0 ? `+${aDiff}` : aDiff;
    dfd.resolve({
      seasonWins,
      seasonLosses,
      seasonAverage,
      seasonDifference,
      allTimeWins,
      allTimeLosses,
      allTimeAverage,
      allTimeDifference,
    });
  })
  .catch((err) => {
    console.log(err);
    dfd.reject();
  });

  return dfd.promise;
};

module.exports = repo;
