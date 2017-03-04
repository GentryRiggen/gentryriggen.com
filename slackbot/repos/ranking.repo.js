const Q = require('q');
const R = require('ramda');
const db = require('../../db');
const model = require('./generic.model');
const tableName = 'slackbot_pong_ranking';
const baseRepo = require('../../repos/base.repo.js')(tableName, model);

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
  FROM slackbot_pong_match AS pongMatch
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
      let lastWon = false;
      let rollingWon = 1;
      let lws = 0;

      let peopleLostTo = {};
      let lastLost = false;
      let rollingLost = 1;
      let lls = 0;
      let pointDifferential = 0;
      let totalPoints = 0;
      results[0].forEach((match, index) => {
        if (match.won) {
          pointDifferential += match.winnerPoints - match.loserPoints;
          totalPoints += match.winnerPoints;
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
          rollingLost = 1;
        } else {
          pointDifferential += match.loserPoints - match.winnerPoints;
          totalPoints += match.loserPoints;
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
          rollingWon = 1;
        }
      });

      let whippingBoiId = null;
      let wins = 0;
      Object.keys(peopleBeaten).forEach((id) => {
        const best = R.propOr(0, whippingBoiId, peopleBeaten);
        const thisGuy = R.propOr(0, id, peopleBeaten);
        wins += thisGuy;
        if (best <= thisGuy) {
          whippingBoiId = id;
        }
      });

      let nemesisId = null;
      let losses = 0;
      Object.keys(peopleLostTo).forEach((id) => {
        const best = R.propOr(0, nemesisId, peopleLostTo);
        const thisGuy = R.propOr(0, id, peopleLostTo);
        losses += thisGuy;
        if (best <= thisGuy) {
          nemesisId = id;
        }
      });

      const time = (new Date()).toMysqlFormat();
      const ranking = {
        seasonId,
        userId,
        elo: currentELO,
        wins,
        losses,
        lws,
        lls,
        whippingBoi: whippingBoiId,
        nemesis: nemesisId,
        pointDifferential,
        totalPoints,
        dateCreated: time,
        dateModified: time,
      };

      dfd.resolve(ranking);
    }
  });

  return dfd.promise;
};

module.exports = repo;
