'use strict';

const socket = io();
const canvas_ft = $('#canvas-front')[0];
const canvas_md = $('#canvas-middle')[0];
const canvas_bk = $('#canvas-back')[0];
const ctt_ft = canvas_ft.getContext('2d');
const ctt_md = canvas_md.getContext('2d');
const ctt_bk = canvas_bk.getContext('2d');
const playerImage = $('#player-image')[0];
const botImage = $('#bot-image')[0];

function gameStart(){
    socket.emit('game-start', {nickname: $("#nickname").val() });
    $("#start-screen").hide();
}
$("#start-button").on('click', gameStart);

let movement = {};

document.addEventListener('keypress', keypress_ivent);
document.addEventListener('keyup', keyup_ivent);

function keypress_ivent(e) {
	document.getElementById('output').innerHTML = e.key;
	return false; 
}
function keydown_ivent(e) {
	document.getElementById('output').innerHTML = e.key;
	return false; 
}
function keyup_ivent(e) {
	document.getElementById('output').innerHTML = '　';
	return false; 
}

$(document).on('keydown keyup', (event) => {
    const KeyToCommand = {
        'ArrowUp': 'forward',
        'ArrowDown': 'back',
        'ArrowLeft': 'left',
        'ArrowRight': 'right',
    };
    const command = KeyToCommand[event.key];
    if(command){
        if(event.type === 'keydown'){
            movement[command] = true;
        }else{ /* keyup */
            movement[command] = false;
        }
        socket.emit('movement', movement);
    }
    if(event.key === ' ' && event.type === 'keydown'){
        socket.emit('shoot');
    }
});

function drawImage(ctt, img, px, py=null, pw=null, ph=null){
    let x; let y; let w; let h;
    if(py == null){
        x = px.x; y = px.y;
        w = px.width; h = px.height;
    }else if(ph == null){
        x = px; y = py;
        w = pw.width; h = pw.height;
    }else{
        x = px; y = py;
        w = pw; h = ph;
    }
    ctt.drawImage(
        img,
        0, 0, img.width, img.height,
        x, y, w, h
    );
}
function view_back(){
    ctt_bk.clearRect(0, 0, canvas_ft.width, canvas_ft.height);
    ctt_bk.lineWidth = 10;
    ctt_bk.beginPath();
    ctt_bk.rect(200, 200, canvas_ft.width - 400, canvas_ft.height - 400);
    ctt_bk.stroke();
}

// init -----
view_back();

// ----------

socket.on('back-frame', function(ccdm) {
    view_back();
});

socket.on('state', function(ccdm) {
    ctt_ft.clearRect(0, 0, canvas_ft.width, canvas_ft.height);

    ctt_ft.lineWidth = 10;
    ctt_ft.beginPath();
    ctt_ft.rect(0, 0, canvas_ft.width, canvas_ft.height);
    ctt_ft.stroke();

    Object.values(ccdm.players).forEach((player) => {
        ctt_ft.save();
        ctt_ft.font = '20px Bold Arial';
        ctt_ft.fillText(player.nickname, player.x, player.y + player.height + 25);
        ctt_ft.font = '10px Bold Arial';
        ctt_ft.fillStyle = "gray";
        ctt_ft.fillText('♥'.repeat(player.maxHealth), player.x, player.y + player.height + 10);
        ctt_ft.fillStyle = "red";
        ctt_ft.fillText('♥'.repeat(player.health), player.x, player.y + player.height + 10);
        ctt_ft.translate(player.x + player.width/2, player.y + player.height/2);
        ctt_ft.rotate(player.angle);
        if(player.player_type === 'player'){
            drawImage(ctt_ft, playerImage, -player.width/2, -player.height/2, player.width, player.height);
        }else if(player.player_type === 'bot'){
            drawImage(ctt_ft, botImage, -player.width/2, -player.height/2, player.width, player.height);
        }else{
            // no drawImage.
        }
        ctt_ft.restore();
        
        if(player.socketId === socket.id){
            ctt_ft.save();
            ctt_ft.font = '30px Bold Arial';
            ctt_ft.fillText('You', player.x, player.y - 20);
            ctt_ft.fillText(player.point + ' point', 20, 40);
            ctt_ft.restore();
        }
    });
    Object.values(ccdm.bullets).forEach((bullet) => {
        ctt_ft.beginPath();
        ctt_ft.arc(bullet.x, bullet.y, bullet.width/2, 0, 2 * Math.PI);
        ctt_ft.stroke();
    });
    Object.values(ccdm.walls).forEach((wall) => {
        ctt_ft.fillStyle = 'black';
        ctt_ft.fillRect(wall.x, wall.y, wall.width, wall.height);
    });
    Object.values(ccdm.pieces).forEach((piece) => {
        ctt_ft.save();
        drawImage(ctt_ft, playerImage, piece);
        ctt_ft.restore();
    });
});

socket.on('dead', () => {
    $("#start-screen").show();
});