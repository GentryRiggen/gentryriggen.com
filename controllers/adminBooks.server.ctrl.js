(function () {
  'use strict';

  /* jshint -W117 */
  var express = require('express'),
    multiparty = require('multiparty');

  var ctrl = function (dbPool) {
    var booksCtrl = express.Router(),
      bookRepo = require('../repositories/book.repo')(dbPool),
      fileRepo = require('../repositories/file.repo')();

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

      });

    booksCtrl.use('/new', ensureAccess);
    booksCtrl.route('/new')
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
        console.log('Admin book get book by id', req.params.id);
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

    booksCtrl.route('/:id/artwork')
      .post(function (req, res) {
        var form = new multiparty.Form();

        // Upload to Azure
        form.on('part', function (part) {
          fileRepo.upload(part, part.byteCount, part.filename).then(
            function () {
              bookRepo.saveArtwork(req.params.id, part.filename).then(
                function() {
                  res.json({message: 'Artwork updated successfully'});
                }, function (err) {
                  console.log(err);
                  res.status(500).send({error: 'Failed to upload file'});
                });
            }, function (err) {
              console.log(err);
              res.status(500).send({error: 'Failed to upload file'});
            });
        });

        form.parse(req);
      });

    booksCtrl.route('/:id/file')
      .post(function (req, res) {
        var form = new multiparty.Form();

        // Upload to Azure
        form.on('part', function (part) {
          fileRepo.upload(part, part.byteCount, part.filename).then(
            function () {
              bookRepo.saveFile(req.params.id, part.filename).then(
                function() {
                  res.json({message: 'File updated successfully'});
                }, function (err) {
                  console.log(err);
                  res.status(500).send({error: 'Failed to upload file'});
                });
            }, function (err) {
              console.log(err);
              res.status(500).send({error: 'Failed to upload file'});
            });
        });

        form.parse(req);
      });

    return booksCtrl;
  };

  module.exports = ctrl;
})();
