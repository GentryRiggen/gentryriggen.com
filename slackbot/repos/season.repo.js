const Q = require('q');
const R = require('ramda');
const model = require('./generic.model');
const baseRepo = require('../../repos/base.repo.js')('slackbot_pong_season', model);
const db = require('../../db');

const repo = {};

repo.getById = baseRepo.getById;

repo.closeAllSeasons = () => {
  const dfd = Q.defer();
  const sql = `UPDATE slackbot_pong_season SET closed = 1`;
  db.raw(sql, [])
    .then(() => dfd.resolve())
    .catch(() => dfd.reject('Failed to close all seasons.'));
  return dfd.promise;
};

repo.createNewSeason = (name, teamId) => {
  var dfd = Q.defer();
  repo.closeAllSeasons()
    .then(() => {
      baseRepo.createOrUpdate({
        teamId,
        name,
        closed: 0,
        dateCreated: (new Date()).toMysqlFormat(),
      })
        .then(newSeason => dfd.resolve(newSeason));
    })
    .catch(() => dfd.reject('Failed to create new Season'));
  return dfd.promise;
};

repo.getLeaderboard = (seasonId, leaderboardType = 'elo') => {
  let orderBy;
  switch (leaderboardType.toLowerCase()) {
    case 'points':
      orderBy = 'ranking.pointDifferential DESC';
      break;
    default:
      orderBy = 'ranking.elo DESC';
      break;
  }
  const dfd = Q.defer();
  const sql = `
  SELECT
    ranking.elo
    , ranking.wins
    , ranking.losses
    , ranking.lws
    , ranking.lls
    , ranking.pointDifferential
    , ranking.totalPoints
    , user.name
    , whippingBoi.name AS whippingBoi
    , nemesis.name AS nemesis
  FROM slackbot_pong_ranking AS ranking
  JOIN slackbot_pong_user AS user
    ON user.id = ranking.userId
  LEFT JOIN slackbot_pong_user AS whippingBoi
    ON whippingBoi.id = ranking.whippingBoi
  LEFT JOIN slackbot_pong_user AS nemesis
    ON nemesis.id = ranking.nemesis
  WHERE
    ranking.seasonId = ?
  ORDER BY ${orderBy}`;
  const query = db.raw(sql, [seasonId]);
  query.then((results) => {
    let rank = 1;
    let previousElo = 0;
    let previousPd = 0;
    const rankings = results[0].map((ranking, index) => {
      if (index === 0) {
	previousElo = ranking.elo;
	previousPd = ranking.pointDifferential;
      }

      if (ranking.elo < previousElo || ranking.pointDifferential < previousPd) rank++;

      const pointDifferential = ranking.pointDifferential > 0
        ? `+${ranking.pointDifferential}`
        : ranking.pointDifferential;
      return {
        rank,
        name: ranking.name,
        elo: ranking.elo,
        wins: ranking.wins,
        losses: ranking.losses,
        lws: ranking.lws,
        lls: ranking.lls,
        whippingBoi: ranking.whippingBoi == null ? 'N/A' : ranking.whippingBoi,
        nemesis: ranking.nemesis == null ? 'N/A' : ranking.nemesis,
        pointDifferential,
        totalPoints: ranking.totalPoints,
      }
    });

    dfd.resolve(rankings);
  });

  return dfd.promise;
};

repo.del = baseRepo.del;

module.exports = repo;
