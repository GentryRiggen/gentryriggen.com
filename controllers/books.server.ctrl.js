/* jshint -W117 */
var express = require('express');

var ctrl = function (dbPool) {
  var booksCtrl = express.Router(),
    bookRepo = require('../repositories/book.repo')(dbPool);

  booksCtrl.route('/')
    .get(function (req, res) {
      var page = 'page' in req.query ? parseInt(req.query.page) : 1,
        pageSize = 'pageSize' in req.query ? parseInt(req.query.pageSize) : 50,
        query = 'q' in req.query ? req.query.q : '',
        skip = query.length > 0 ? 0 : (page - 1) * pageSize,
        adminRequest = false;

      bookRepo.getTotal().then(
        function (total) {
          bookRepo.getAll(skip, pageSize, query, adminRequest).then(
            function (books) {
              res.json({
                books: books,
                numPages: Math.ceil(total / req.query.pageSize),
                page: page,
                pageSize: pageSize
              });
            }, function (err) {
              console.log(err);
              res.status(500).send({error: 'Failed to get books'});
            });
        }, function (err) {
          console.log(err);
          res.status(500).send({error: 'Failed to get books'});
        });

    });

  booksCtrl.route('/:id')
    .get(function (req, res) {
      bookRepo.getById(req.params.id, false).then(
        function (book) {
          res.json(book);
        }, function () {
          res.status(500).send({error: 'Failed to get books'});
        });
    });

  return booksCtrl;
};

module.exports = ctrl;
