/* jshint -W117 */
var express = require('express'),
  Q = require('q');

var ctrl = function () {
  var booksCtrl = express.Router(),
    bookRepo = require('../repos/book.repo');

  booksCtrl.route('/')
    .get(function (req, res) {
      var params = bookRepo.getPaginatedParams(req.query);
      var query = 'q' in req.query ? req.query.q : '';

      var totalPromise = bookRepo.getTotal(false);
      var getPaginatedPromise = bookRepo.getPaginated(params.skip, params.pageSize, query, false);
      Q.all([totalPromise, getPaginatedPromise]).then(
        function (results) {
          res.json({
            books: results[1],
            numPages: Math.ceil(results[0] / params.pageSize),
            page: params.page,
            pageSize: params.pageSize
          });
        }, function (err) {
          console.log(err);
          res.status(500).send({error: 'Failed to get books'});
        });
    });

  booksCtrl.route('/:id')
    .get(function (req, res) {
      bookRepo.getById(req.params.id).then(
        function (book) {
          res.json(book);
        }, function () {
          res.status(500).send({error: 'Failed to get book'});
        });
    });

  return booksCtrl;
};

module.exports = ctrl;
