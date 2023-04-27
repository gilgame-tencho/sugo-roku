'use strict';

const socket = io();
const canvas = $('#canvas-2d')[0];
const context = canvas.getContext('2d');
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
	document.getElementById('log').innerHTML = 'keypress';
	return false; 
}

function keydown_ivent(e) {
	document.getElementById('output').innerHTML = e.key;
	document.getElementById('log').innerHTML = 'keydown';
	return false; 
}

function keyup_ivent(e) {
	document.getElementById('output').innerHTML = '　';
	document.getElementById('log').innerHTML = 'keyup';
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

socket.on('state', function(players, bullets, walls) {
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.lineWidth = 10;
    context.beginPath();
    context.rect(0, 0, canvas.width, canvas.height);
    context.stroke();

    Object.values(players).forEach((player) => {
        context.save();
        context.font = '20px Bold Arial';
        context.fillText(player.nickname, player.x, player.y + player.height + 25);
        context.font = '10px Bold Arial';
        context.fillStyle = "gray";
        context.fillText('♥'.repeat(player.maxHealth), player.x, player.y + player.height + 10);
        context.fillStyle = "red";
        context.fillText('♥'.repeat(player.health), player.x, player.y + player.height + 10);
        context.translate(player.x + player.width/2, player.y + player.height/2);
        context.rotate(player.angle);
        if(player.player_type === 'player'){
            context.drawImage(playerImage, 0, 0, playerImage.width, playerImage.height, -player.width/2, -player.height/2, player.width, player.height);
        }else if(player.player_type === 'bot'){
            context.drawImage(botImage, 0, 0, botImage.width, botImage.height, -player.width/2, -player.height/2, player.width, player.height);
        }else{
            // no drawImage.
        }
        context.restore();
        
        if(player.socketId === socket.id){
            context.save();
            context.font = '30px Bold Arial';
            context.fillText('You', player.x, player.y - 20);
            context.fillText(player.point + ' point', 20, 40);
            context.restore();
        }
    });
    Object.values(bullets).forEach((bullet) => {
        context.beginPath();
        context.arc(bullet.x, bullet.y, bullet.width/2, 0, 2 * Math.PI);
        context.stroke();
    });
    Object.values(walls).forEach((wall) => {
        context.fillStyle = 'black';
        context.fillRect(wall.x, wall.y, wall.width, wall.height);
    });
});

socket.on('dead', () => {
    $("#start-screen").show();
});