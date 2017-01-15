const Q = require('q');
const model = require('../models/generic.model');
const baseRepo = require('../../repos/base.repo')('broboto_pong_user', model);
const db = require('../../db');

const repo = {};
repo.getById = baseRepo.getById;

repo.getAllById = function (id) {
  const dfd = Q.defer();
  const sql = `
  SELECT
    user.id AS userId
    , user.name AS username
    , user.dateCreated AS userDateCreated
    , team.id AS teamId
    , team.name AS teamName
    , team.dateCreated AS teamDateCreated
    , CASE
        WHEN team.captainId = user.id THEN 1
        ELSE 0
      END AS isCaptain
    , season.id AS seasonId
    , season.name AS seasonName
    , season.dateCreated AS seasonDateCreated
    , IFNULL(ranking.elo, 0) AS elo
    , IFNULL(ranking.lws, 0) AS lws
    , IFNULL(ranking.lls, 0) AS lls
    , whippingBoi.id AS whippingBoiId
    , whippingBoi.name AS whippingBoiName
    , nemesis.id AS nemesisId
    , nemesis.name AS nemesisName
    , captain.id AS captainId
    , captain.name AS captainName
  FROM broboto_pong_user AS user
  JOIN broboto_pong_team AS team
    ON team.id = user.teamId
  JOIN broboto_pong_user AS captain
    ON captain.id = team.captainId
  LEFT JOIN broboto_pong_season AS season
    ON season.teamId = team.id
      AND season.closed != 1
  LEFT JOIN broboto_pong_ranking AS ranking
    ON ranking.seasonId = season.id
      AND ranking.userId = user.id
  LEFT JOIN broboto_pong_user AS whippingBoi
    ON ranking.whippingBoi = whippingBoi.id
  LEFT JOIN broboto_pong_user AS nemesis
    ON ranking.nemesis = nemesis.id
  WHERE user.id = ?
`;
  const query = db.raw(sql, [id]);
  query.then((results) => {
    if (results[0].length < 1) {
      dfd.reject('I couldn\'t find your account. Try \npong register');
    } else {
      let user = false;
      results[0].forEach((result) => {
        user = result;
      });

      dfd.resolve(user);
    }
  });

  return dfd.promise;
};
repo.createOrUpdate = baseRepo.createOrUpdate;
repo.del = baseRepo.del;

module.exports = repo;
