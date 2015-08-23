(function () {
  'use strict';

  /* jshint -W117 */
  var express = require('express');

  var ctrl = function (dbPool) {
    var booksCtrl = express.Router();
    var bookRepo = require('../repositories/book.repo')(dbPool);

    function ensureAccess(req, res, next) {
      if (req.currentUser && req.currentUser.hasLibrarianRole) {
        next();
      } else {
        res.status(401).send({error: 'Unauthorized'});
      }
    }

    booksCtrl.use('/', ensureAccess);
    booksCtrl.route('/')
      .get(function (req, res) {
        var page = 'page' in req.query ? parseInt(req.query.page) : 1,
          pageSize = 'pageSize' in req.query ? parseInt(req.query.pageSize) : 50,
          skip = (page - 1) * pageSize,
          adminRequest = true;

        bookRepo.getTotal().then(
          function (total) {
            bookRepo.getAll(skip, pageSize, adminRequest).then(
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

      })
      .post(function (req, res) {
        console.log('Creating new book');
        bookRepo.new().then(
          function (newBookId) {
            bookRepo.getById(newBookId).then(
              function (newBook) {
                res.json(newBook);
              }, function (err) {
                console.log(err);
                res.status(500).send({error: 'Failed to create new book'});
              });
          }, function (err) {
            console.log(err);
            res.status(500).send({error: 'Failed to create new book'});
          });
      });

    booksCtrl.use('/:id', ensureAccess);
    booksCtrl.route('/:id')
      .get(function (req, res) {
        bookRepo.getById(req.params.id).then(
          function (book) {
            res.json(book);
          }, function () {
            res.status(500).send({error: 'Failed to get books'});
          });
      })
      .put(function (req, res) {
        bookRepo.save(req.params.id, req.body).then(
          function () {
            res.status(204).send({message: 'book updated'});
          }, function () {
            res.status(500).send({error: 'Failed to save book'});
          });
      })
      .delete(function (req, res) {
        bookRepo.deleteById(req.params.id).then(
          function () {
            res.status(204).send({message: 'book deleted'});
          }, function () {
            res.status(500).send({error: 'Failed to delete book'});
          });
      });

    return booksCtrl;
  };

  module.exports = ctrl;
})();
