(function () {
  'use strict';

  /* jshint -W117 */
  var conf = require('../config/conf');

  /* jshint -W117 */
  exports.toJson = function (blogPost) {
    var sampleContent = blogPost.content;
    if (sampleContent.length > 300) {
      sampleContent = sampleContent.substring(0, 300);
    }

    return {
      id: blogPost.id,
      title: blogPost.title,
      subtitle: blogPost.subtitle,
      permalink: blogPost.permalink,
      content: blogPost.content,
      sampleContent: sampleContent,
      visible: blogPost.visible,
      createdBy: blogPost.created_by,
      createdOn: blogPost.created_on,
      updatedOn: blogPost.updated_on,
      url: conf.appUrl + '/#!/blog/' + blogPost.permalink
    };
  };
})();
