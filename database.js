'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const app = express();
const server = http.Server(app);
const io = socketIO(server);
const fs = require('fs');
const yaml = require('yaml');

// ### system param, common methods ###
const server_conf = yaml.parse(fs.readFileSync(__dirname + '/conf/server_conf.yml', 'utf-8'));

class loggerClass{
  constructor(obj={}){
      this.level_no = {
          debug: 1,
          info: 2,
          error: 3,
      };
      this.log_level = this.level_no[server_conf.loglevel];
      this.iam = obj.name;
  }
  // not use.
  log(msg, level='debug'){
      let logmsg = '';
      logmsg += '[' + level;
      logmsg += ' ' + this.iam + '] ';
      logmsg += msg;
      if(this.level_no[level] >= this.log_level){
          console.log(logmsg);
      }
  }
  debug(msg){
    this.log(msg, 'debug');
  }
  info(msg){
      this.log(msg, 'info');
  }
  error(msg){
      this.log(msg, 'error');
  }
}
const logger = new loggerClass({name: this.constructor.name});

// Server config. -----------

app.get('/', (request, response) => {
    response.send('Sample REST API');
});

server.listen(server_conf.apl_db, function() {
  logger.info(`Starting server on port ${server_conf.apl_db}`);
});
