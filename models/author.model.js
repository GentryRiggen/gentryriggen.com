/* jshint -W117 */
exports.toJson = function (author) {
  return {
    id: author.id,
    firstName: author.first_name,
    lastName: author.last_name
  };
};
