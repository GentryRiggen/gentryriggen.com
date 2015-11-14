/* jshint -W117 */
var express = require('express'),
  multiparty = require('multiparty'),
  bookModel = require('../models/book.model'),
  Q = require('q');

var booksCtrl = express.Router(),
  bookRepo = require('../repos/book.repo'),
  fileRepo = require('../repos/file.repo')();

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
    var params = bookRepo.getPaginatedParams(req.query);
    var query = 'q' in req.query ? req.query.q : '';

    bookRepo.getTotal().then(
      function (total) {
        bookRepo.getPaginated(params.skip, params.pageSize, query, true).then(
          function (books) {
            res.json({
              books: books,
              numPages: Math.ceil(total / params.pageSize),
              page: params.page,
              pageSize: params.pageSize
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
    bookRepo.createOrUpdate(bookModel.fromJson({})).then(
      function (newBook) {
        res.json(newBook);
      }, function (err) {
        console.log(err);
        res.status(500).send({error: 'Failed to create new book'});
      });
  });

booksCtrl.use('/:id', ensureAccess);
booksCtrl.route('/:id')
  .get(function (req, res) {
    bookRepo.getById(req.params.id, true).then(
      function (book) {
        res.json(book);
      }, function () {
        res.status(500).send({error: 'Failed to get books'});
      });
  })
  .put(function (req, res) {
    bookRepo.createOrUpdate(req.body, true).then(
      function () {
        res.status(204).send({message: 'book updated'});
      }, function () {
        res.status(500).send({error: 'Failed to save book'});
      });
  })
  .delete(function (req, res) {
    bookRepo.del(req.params.id).then(
      function () {
        res.status(204).send({message: 'book deleted'});
      }, function () {
        res.status(500).send({error: 'Failed to delete book'});
      });
  });

booksCtrl.use('/:id/artwork', ensureAccess);
booksCtrl.route('/:id/artwork')
  .post(function (req, res) {
    var form = new multiparty.Form();

    // Upload to Azure
    form.on('part', function (part) {
      var upload = fileRepo.upload(part, part.byteCount, part.filename);
      var getById = bookRepo.getById(req.params.id);
      Q.all([upload, getById])
        .then(function (results) {
          var book = results[1];
          book.artworkUrl = '/' + part.filename;
          bookRepo.createOrUpdate(bookModel.fromJson(book))
            .then(function () {
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

booksCtrl.use('/:id/file', ensureAccess);
booksCtrl.route('/:id/file')
  .post(function (req, res) {
    var form = new multiparty.Form();

    // Upload to Azure
    form.on('part', function (part) {
      var upload = fileRepo.upload(part, part.byteCount, part.filename);
      var getById = bookRepo.getById(req.params.id);
      Q.all([upload, getById])
        .then(function (results) {
          var book = results[1];
          book.fileUrl = '/' + part.filename;
          bookRepo.createOrUpdate(bookModel.fromJson(book))
            .then(function () {
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


module.exports = booksCtrl;
