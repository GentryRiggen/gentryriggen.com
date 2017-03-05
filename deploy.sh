export NODE_ENV=development
echo Stopping app
pm2 stop app
echo Ensuring node version 7.4.0
sh $NVM_DIR/nvm.sh use v7.4.0
echo Cleaning node_modules
rm -rf node_modules
npm install
echo Updating client directory
cd client
echo Ensuring node version 6.0.0
sh $NVM_DIR/nvm.sh use v6.0.0
echo Cleaning node_modules
rm -rf node_modules
npm install
bower install
gulp clean
gulp build
cd ..
echo Ensuring node version 7.4.0
sh $NVM_DIR/nvm.sh use v7.4.0
export NODE_ENV=production
pm2 start app
