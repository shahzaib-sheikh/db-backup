const cron = require("node-cron");

const mysql = require("./driver/mysql");
const redis = require("./driver/redis");
const mongo = require("./driver/mongo");

const file = require("./driver/file");
const awsS3 = require("./driver/aws_s3");

const backupDrivers = {
  mysql: mysql.dump,
  mongo: mongo.dump,
  redis: redis.dump
};

const storageDrivers = {
  file: file.write,
  "aws-s3": awsS3.write
};

const { getConfig, parseConfig } = require("./helper/config");

const config = getConfig();

const parsedConfig = parseConfig(config);

let backup = async function(config) {
  if (!backupDrivers[config.source.type]) {
    throw "no valid backup driver forund for " + config.source.type;
  }

  let fileName = await backupDrivers[config.source.type](config.source);

  for (let dest of config.destinations) {
    try {
      if (!storageDrivers[dest.type]) {
        throw "no valid storage driver found for " + dest.type;
      }
      await storageDrivers[dest.type]({
        ...dest,
        tempFilePath: fileName
      });
    } catch (e) {
      console.log(e);
    }
  }
};

for (let config of parsedConfig) {
  let processor = function() {
    backup(config);
  };
  config.cron_exp === false
    ? setTimeout(processor, 0)
    : cron.schedule(config.cron_exp, processor, { scheduled: true });
}
