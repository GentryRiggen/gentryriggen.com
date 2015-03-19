(function () {
    'use strict';
    angular
        .module('gr')
        .factory('user', [user]);

    function user() {
        return {
            userName: "",
            firstName: "",
            lastName: "",
            bioSnippet: "",
            profilePicture: "",
        }
    }
})();