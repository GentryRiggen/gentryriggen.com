(function () {
    'use strict';
    angular
        .module('gr')
        .controller('fileAdminCtrl', fileAdminCtrl);

    fileAdminCtrl.$inject = ['$state', 'alert', 'dialog', 'fileService'];
    function fileAdminCtrl($state, alert, dialog, fileService) {
        var vm = this;
        var page = 1;
        var pageSize = 100;
        vm.files = [];

        var main = function () {
            alert.showMessage("info", "Fetching Files...", "", false);
            vm.refresh(function () {
                alert.hideMessage();
            });
        };

        vm.refresh = function (callback) {
            fileService.getFilesPaginate(page, pageSize)
                .success(function (data, status, headers, config) {
                    vm.files = data;
                    if (typeof callback != 'undefined')
                        callback();
                }).error(function (data, status, headers, config) {
                    if (status !== 401)
                        alert.showmessage("warning", "uh oh!", "could not retrieve files!");
                });
        };

        vm.searchFiles = function (q) {
            fileService.getFilesPaginate(page, pageSize, q)
                .success(function (data, status, headers, config) {
                    vm.files = data;
                    alert.hideMessage();
                }).error(function (data, status, headers, config) {
                    if (!status === 401)
                        alert.showMessage("warning", "uh oh!", "could not retrieve files!");
                });
        };

        vm.delete = function (path) {
            dialog.confirm('Are you sure?', 'Are you sure you want to delete the file "' + path + '"').then(function () {
                fileService.deleteFile(path)
                    .success(function (data, status, headers, config) {
                        alert.showMessage("success", "Deleted!");
                        vm.refresh();
                    }).error(function (data, status, headers, config) {
                        if (!status === 401)
                            alert.showMessage("warning", "uh oh!", "could not retrieve files!");
                    });
            });
        };

        vm.uploadFile = function (files) {
            alert.showMessage("info", "Uploading File", "", false);
            fileService.uploadFile(files[0])
                .success(function (data, status, headers, config) {
                    alert.showMessage("success", "Uploaded!");
                    vm.refresh();
                }).error(function (data, status, headers, config) {
                    if (!status === 401)
                        alert.showMessage("warning", "uh oh!", "could not retrieve files!");
                });
        };

        main();
    }
})();