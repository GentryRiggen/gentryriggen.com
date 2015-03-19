(function () {
    'use strict';
    angular
        .module('gr')
        .factory('blogPost', [blogPost]);

    function blogPost() {
        return {
            id: "",
            title: "",
            subTitle: "",
            content: "",
            authorName: "",
            authorBio: "",
            visible: false,
            linkTo: "",
            createdOn: new Date(),
            modifiedOd: new Date(),
            permalink: ""
        }
    }
})();