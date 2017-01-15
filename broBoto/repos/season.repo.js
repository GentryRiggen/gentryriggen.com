const Q = require('q');
const R = require('ramda');
const model = require('../models/generic.model');
const baseRepo = require('../../repos/base.repo')('broboto_pong_season', model);
const db = require('../../db');

const repo = {};

repo.getById = baseRepo.getById;

repo.closeAllSeasons = () => {
  const dfd = Q.defer();
  const sql = `UPDATE broboto_pong_season SET closed = 1`;
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

repo.getLeaderboard = (seasonId) => {
  const dfd = Q.defer();
  const sql = `
  SELECT
    ranking.elo
    , ranking.wins
    , ranking.losses
    , ranking.lws
    , ranking.lls
    , user.name
    , whippingBoi.name AS whippingBoi
    , nemesis.name AS nemesis
  FROM broboto_pong_ranking AS ranking
  JOIN broboto_pong_user AS user
    ON user.id = ranking.userId
  LEFT JOIN broboto_pong_user AS whippingBoi
    ON whippingBoi.id = ranking.whippingBoi
  LEFT JOIN broboto_pong_user AS nemesis
    ON nemesis.id = ranking.nemesis
  WHERE
    ranking.seasonId = ?
  ORDER BY ranking.elo DESC`;
  const query = db.raw(sql, [seasonId]);
  query.then((results) => {
      let rank = 1;
      let previousElo = 0;
      const rankings = results[0].map((ranking, index) => {
        if (index === 0) previousElo = ranking.elo;

        if (ranking.elo < previousElo) rank++;

        return {
          rank,
          name: ranking.name,
          elo: ranking.elo,
          wins: ranking.wins,
          losses: ranking.losses,
          lws: ranking.lws,
          lls: ranking.lls,
          whippingBoi: ranking.whippingBoi == null ? 'UNKNOWN' : ranking.whippingBoi,
          nemesis: ranking.nemesis == null ? 'UNKNOWN' : ranking.nemesis,
        }
      });

      dfd.resolve(rankings);
  });

  return dfd.promise;
};

repo.del = baseRepo.del;

module.exports = repo;
