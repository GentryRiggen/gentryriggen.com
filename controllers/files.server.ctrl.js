/**
 * Created by gentryriggen on 8/11/15.
 */
var express = require('express'),
  path = require('path'),
  fs = require('fs'),
  os = require('os'),
  multiparty = require('multiparty');

function getFilesizeInBytes(filename) {
  var stats = fs.statSync(filename)
  var fileSizeInBytes = stats["size"]
  return fileSizeInBytes
}

var ctrl = function (dbPool) {
  var fileCtrl = express.Router();
  var fileRepo = require('../repositories/file.repo')(dbPool);

  function ensureAccess(req, res, next) {
    if (req.currentUser && req.currentUser.hasEditorRole) {
      next();
    } else {
      res.status(401).send({error: 'Unauthorized'});
    }
  }

  fileCtrl.use('/', ensureAccess);


  fileCtrl.route('/')
    .get(function (req, res) {
      var page = 'page' in req.query ? parseInt(req.query.page) : 1,
        pageSize = 'pageSize' in req.query ? parseInt(req.query.pageSize) : 5,
        skip = (page - 1) * pageSize,
        search = 'q' in req.query ? req.query.q : '';

      fileRepo.getAll(skip, pageSize, search).then(
        function (result) {
          res.json({
            files: result.files,
            page: page,
            pageSize: pageSize,
            numPages: Math.ceil(result.total / pageSize)
          });
        }, function (err) {
          console.log(err);
          res.status(500).send({error: 'Failed to get files'});
        });
    })
    .post(function(req, res) {
      var form = new multiparty.Form();
      form.on('part', function(part) {
        if (part.filename) {
          var size = part.byteCount - part.byteOffset;
          var name = part.filename;
          fileRepo.upload(part, size, name).then(
            function () {
              res.json({message: 'File uploaded successfully'});
            }, function (err) {
              res.status(500).send({error: 'Failed to upload file'});
            });
        } else {
          form.handlePart(part);
        }
      });
      form.parse(req);
    })
    .delete(function(req, res) {
      var fileToDelete = 'fileName' in req.query ? req.query.fileName : false;
      if (!fileToDelete) {
        res.status(400).send({error: 'fileName is required to delete'});
      }

      fileRepo.delete(fileToDelete).then(
        function() {
          res.json({message: 'Successfully delete file'});
        }, function(err) {
          console.log(err);
          res.status(500).send({error: 'Failed to delete file'});
        });
    });

  return fileCtrl;
};

module.exports = ctrl;
