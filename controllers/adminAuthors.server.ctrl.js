/* jshint -W117 */
var express = require('express');

var ctrl = function (dbPool) {
  var authorsCtrl = express.Router(),
    authorRepo = require('../repositories/author.repo')(dbPool);

  function ensureAccess(req, res, next) {
    if (req.currentUser && req.currentUser.hasLibrarianRole) {
      next();
    } else {
      res.status(401).send({error: 'Unauthorized'});
    }
  }

  authorsCtrl.use('/', ensureAccess);
  authorsCtrl.route('/')
    .get(function (req, res) {
      authorRepo.getAll().then(
        function (authors) {
          res.json(authors);
        }, function (err) {
          console.log(err);
          res.status(500).send({error: 'Failed to get authors'});
        });
    });

  authorsCtrl.use('/:id', ensureAccess);
  authorsCtrl.route('/:id')
    .get(function (req, res) {
      authorRepo.getById(req.params.id).then(
        function (author) {
          res.json(author);
        }, function () {
          res.status(500).send({error: 'Failed to find author with id: ' + req.params.id});
        });
    })
    .put(function (req, res) {
      console.log('Author details', req.params.id, req.body);
      authorRepo.save(req.params.id, req.body).then(
        function () {
          res.status(204).send({message: 'Author updated'});
        }, function () {
          res.status(500).send({error: 'Failed to save author'});
        });
    });

  authorsCtrl.use('/new', ensureAccess);
  authorsCtrl.route('/new')
    .post(function (req, res) {
      authorRepo.new().then(
        function (newAuthorId) {
          authorRepo.getById(newAuthorId).then(
            function (newAuthor) {
              res.json(newAuthor);
            }, function (err) {
              console.log(err);
              res.status(500).send({error: 'Failed to create new author'});
            });
        }, function (err) {
          console.log(err);
          res.status(500).send({error: 'Failed to create new author'});
        });
    });

  return authorsCtrl;
};

module.exports = ctrl;
