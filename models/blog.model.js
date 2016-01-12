/* jshint -W117 */
var conf = require('../config/conf'),
  util = require('../services/util.service');

/* jshint -W117 */
exports.toJson = function (blogPost) {
  var sampleContent = blogPost.content;
  if (sampleContent.length > 500) {
    sampleContent = util.htmlSubStr(sampleContent, 500);
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
    visibleOn: blogPost.visible_on,
    url: conf.appUrl + '/#!/blog/' + blogPost.permalink
  };
};

exports.fromJson = function (blogPost) {
  return {
    id: ('id' in blogPost) ? blogPost.id : 0,
    title: ('title' in blogPost) ? blogPost.title : "",
    subtitle: ('subtitle' in blogPost) ? blogPost.subtitle : "",
    permalink: ('permalink' in blogPost) ? blogPost.permalink : "",
    content: ('content' in blogPost) ? blogPost.content : "",
    visible: ('visible' in blogPost) ? blogPost.visible : 0,
    created_by: ('createdBy' in blogPost) ? blogPost.createdBy : null,
    created_on: ('createdOn' in blogPost) ? blogPost.createdOn : (new Date()).toMysqlFormat(),
    updated_on: ('updatedOn' in blogPost) ? blogPost.updatedOn : (new Date()).toMysqlFormat(),
    visible_on: ('visibleOn' in blogPost) ? blogPost.visibleOn : (new Date()).toMysqlFormat()
  };
};
