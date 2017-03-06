export NODE_ENV=development
echo Stopping app
pm2 stop app
echo Ensuring node version 7.4.0
sh $NVM_DIR/nvm.sh use v7.4.0
git pull
echo Cleaning node_modules
rm -rf node_modules
yarn install
echo Updating client directory
cd client
echo Cleaning node_modules
rm -rf node_modules
yarn install
yarnpkg build
cd ..
export NODE_ENV=production
pm2 start app
