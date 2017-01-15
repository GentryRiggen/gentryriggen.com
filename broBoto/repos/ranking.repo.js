const Q = require('q');
const R = require('ramda');
const db = require('../../db');
const model = require('../models/generic.model');
const tableName = 'broboto_pong_ranking';
const baseRepo = require('../../repos/base.repo')(tableName, model);

const repo = {};
repo.getById = baseRepo.getById;
repo.createOrUpdate = baseRepo.createOrUpdate;
repo.del = baseRepo.del;

repo.updateUserRanking = (seasonId, userId) => {
  const dfd = Q.defer();

  db(tableName)
    .where('seasonId', seasonId)
    .where('userId', userId)
    .first()
    .then((ranking) => {
      const oldRanking = ranking || {};
      repo.getUserRanking(seasonId, userId)
        .then((newRanking) => {
          const finalRanking = Object.assign({}, oldRanking, newRanking);
          repo.createOrUpdate(finalRanking)
            .then(() => dfd.resolve());
        });
    });

  return dfd.promise;
};

repo.getUserRanking = (seasonId, userId) => {
  const dfd = Q.defer();
  const sql = `
  SELECT
    pongMatch.*
    , CASE
        WHEN pongMatch.loserId = ? THEN 0
        ELSE 1
      END AS won
  FROM broboto_pong_match AS pongMatch
  WHERE
    (pongMatch.loserId = ? OR pongMatch.winnerId = ?)
    AND pongMatch.seasonId = ?
  ORDER BY dateCreated DESC`;
  const query = db.raw(sql, [userId, userId, userId, seasonId]);
  query.then((results) => {
    if (results[0].length < 1) {
      dfd.reject('Could not find matches.');
    } else {
      let currentELO = 0;

      let peopleBeaten = {};
      let lastWon = true;
      let rollingWon = 0;
      let lws = 0;

      let peopleLostTo = {};
      let lastLost = true;
      let rollingLost = 0;
      let lls = 0;
      results[0].forEach((match, index) => {
        if (match.won) {
          if (index === 0) currentELO = match.winnerNewELO;
          const vs = R.propOr(0, match.loserId, peopleBeaten);
          peopleBeaten[match.loserId] = vs + 1;

          if (lastWon) {
            rollingWon++;
            if (rollingWon > lws) {
              lws = rollingWon;
            }
          }

          lastWon = true;
          lastLost = false;
          rollingLost = 0;
        } else {
          if (index === 0) currentELO = match.loserNewELO;
          const vs = R.propOr(0, match.winnerId, peopleLostTo);
          peopleLostTo[match.winnerId] = vs + 1;

          if (lastLost) {
            rollingLost++;
            if (rollingLost > lls) {
              lls = rollingLost;
            }
          }

          lastWon = false;
          lastLost = true;
          rollingWon = 0;
        }
      });

      let whippingBoiId = null;
      Object.keys(peopleBeaten).forEach((id) => {
        const best = R.propOr(0, whippingBoiId, peopleBeaten);
        const thisGuy = R.propOr(0, id, peopleBeaten);
        if (best <= thisGuy) {
          whippingBoiId = id;
        }
      });

      let nemesisId = null;
      Object.keys(peopleLostTo).forEach((id) => {
        const best = R.propOr(0, nemesisId, peopleLostTo);
        const thisGuy = R.propOr(0, id, peopleLostTo);
        if (best <= thisGuy) {
          nemesisId = id;
        }
      });

      const ranking = {
        seasonId,
        userId,
        elo: currentELO,
        wins: Object.keys(peopleBeaten).length,
        losses: Object.keys(peopleLostTo).length,
        lws,
        lls,
        whippingBoi: whippingBoiId,
        nemesis: nemesisId,
      };

      dfd.resolve(ranking);
    }
  });

  return dfd.promise;
};

module.exports = repo;
