// ########################
// standerd modules
// ########################

class loggerClass{
  constructor(obj={}){
    this.server_name = obj.server_name;
      this.level_no = {
          debug: 1,
          info: 2,
          error: 3,
      };
      this.log_level = this.level_no[obj.log_level];
      this.iam = obj.name;
  }
  // not use.
  log(msg, level='debug'){
      let logmsg = '';
      logmsg += `[${this.server_name}] `;
      logmsg += `[${level} ${this.iam}] `;
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
exports.logger = param => new loggerClass(param);

exports.random = range => Math.round(Math.random() * range * 10, 0) % range;
