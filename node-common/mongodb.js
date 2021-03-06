const mongoose = require('mongoose');

const DB_NAME = 'kotoba';
const DB_HOST = process.env.MONGO_HOST || 'localhost:27017';
const connection = mongoose.createConnection(
  `mongodb://${DB_HOST}/${DB_NAME}`,
  {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  },
);

module.exports = {
  connection,
};
