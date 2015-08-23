export NODE_ENV=development
pm2 stop app
npm install
cd client
gulp clean
gulp build
cd ..
export NODE_ENV=production
pm2 start app
