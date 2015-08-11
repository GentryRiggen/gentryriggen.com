/**
 * Created by gentryriggen on 8/11/15.
 */
// REQUIRES
var express = require('express');
var mysql = require('mysql');
var conf = require('./config/conf');

// ENVIRONMENT SETUP
var app = express();
var port = process.env.PORT || 3000;

// DB CONNECTIONS
var dbPool = mysql.createPool(conf.databaseConfig);

// ROUTES
var blogRouter = require('./routes/blogRoutes')();
app.use('/api/blog', blogRouter);
var userRouter = require('./routes/userRoutes')(dbPool);
app.use('/api/user', userRouter);

app.listen(port, function() {
  console.log('Listening on PORT: ', port);
});
