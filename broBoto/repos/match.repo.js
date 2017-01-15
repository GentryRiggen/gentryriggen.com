/* jshint -W117 */
const model = require('../models/generic.model');
const baseRepo = require('../../repos/base.repo')('broboto_pong_match', model);

const repo = {};
repo.getById = baseRepo.getById;
repo.createOrUpdate = baseRepo.createOrUpdate;
repo.del = baseRepo.del;

module.exports = repo;
