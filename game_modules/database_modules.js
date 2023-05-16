// ########################
// database modules
// ########################

class dataBaseClass{
    constructor(obj={}){
        this.url_base = obj.url_base;
        this.table = 'names'
    }
    get(url){
        let data = [];
        http.get(url, function(res){
            // logger.debug('call get');
            res.on('data', (chunk) => { data.push(chunk) }).on('end', () => {
                let events = JSON.parse(Buffer.concat(data));
                // logger.debug(events[0]);
                console.log(events[0]);
                return events;
            })
        });
    }
    get_rand(){
        this.get(`${this.url_base}${this.table}/rand`);
    }
}
exports.database = param => new dataBaseClass(param);
