/**
 * Created by gentryriggen on 8/11/15.
 */
exports.appUrl = 'http://gentryriggen.com';
exports.jwt = {
  issuer: 'gentryriggen.com',
  secret: 'FluffyBunnies'
};
exports.databaseConfig = {
  connectionLimit: 100,
  host: 'gr.do',
  user: 'gentry',
  password: 'SuCc3$$F@|lisN@0',
  database: 'gentryriggenDB',
  debug: false
};
exports.blobStorage = {
  container: 'binary',
  connectionString: 'DefaultEndpointsProtocol=http;AccountName=gentryriggen;AccountKey=8Uw5+gPteHPNv6HFToE88dfHh3IJSJfVDnDCK5J7zet9/6gNpZZvVpUHnSAJiiCjh3s8g75mP6zq7qbU3mEMqg==;BlobEndpoint=http://gentryriggen.blob.core.windows.net/',
  url: 'http://cdn.gentryriggen.com/binary'
};
