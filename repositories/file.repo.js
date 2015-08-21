/**
 * Created by gentryriggen on 8/11/15.
 */

var fileModel = require('../models/file.model'),
  Q = require('q'),
  azure = require('azure-storage'),
  conf = require('../config/conf'),
  blobSvc = azure.createBlobService(conf.blobStorage.connectionString);

var repo = function (dbPool) {
  var fileRepo = {};

  fileRepo.getAll = function (skip, take, search) {
    var dfd = Q.defer();
    blobSvc.listBlobsSegmented(conf.blobStorage.container, null, function(err, result) {
      if (err) {
        dfd.reject(err);
      } else {
        var files = [],
          taken = 0;
        for (var i = 0; i < result.entries.length; i++) {
          if (search.length > 0 && result.entries[i].name.toLowerCase().indexOf(search.toLowerCase()) > -1) {
            files.push(fileModel.toJson(result.entries[i].name));
            taken++;
          } else if (search.length === 0 && i -1  >= skip) {
            files.push(fileModel.toJson(result.entries[i].name));
            taken++;
          }

          // See if we have all we need
          if (taken == take) {
            break;
          }
        }
        dfd.resolve({
          total: result.entries.length,
          files: files
        });
      }
    });

    return dfd.promise;
  };

  fileRepo.delete = function(fileName) {
    var dfd = Q.defer();
    blobSvc.deleteBlob(conf.blobStorage.container, fileName, function(err, response) {
      if (err) {
        dfd.reject(err);
      } else {
        dfd.resolve(response);
      }
    });

    return dfd.promise;
  };

  fileRepo.upload = function(fileStream, length, fileName) {
    var dfd = Q.defer();
    blobSvc.createBlockBlobFromStream(conf.blobStorage.container, fileName, fileStream, length, function(err) {
      if(!err){
        dfd.resolve();
      } else {
        dfd.reject(err)
      }
    });
    return dfd.promise;
  };

  return fileRepo;
};

module.exports = repo;
