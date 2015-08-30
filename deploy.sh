export NODE_ENV=development
pm2 stop app
npm install
cd client
npm install
bower install
gulp clean
gulp build
cd ..
export NODE_ENV=production
pm2 start app
