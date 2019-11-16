const CROSS_SIZE = 20;
const CROSS_LENGTH = 15;
const CROSS_WIDTH = 4;
const CROSS_CHAMFER = 3;

function drawMedicine(x, y) {
    ctx.moveTo(x - CROSS_SIZE / 2 + CROSS_CHAMFER, y - CROSS_SIZE / 2);
    ctx.beginPath();
    ctx.lineTo(x + CROSS_SIZE / 2, y - CROSS_SIZE / 2);
    ctx.lineTo(x + CROSS_SIZE / 2, y + CROSS_SIZE / 2 - CROSS_CHAMFER);
    ctx.lineTo(x + CROSS_SIZE / 2 - CROSS_CHAMFER, y + CROSS_SIZE / 2);
    ctx.lineTo(x - CROSS_SIZE / 2, y + CROSS_SIZE / 2);
    ctx.lineTo(x - CROSS_SIZE / 2, y - CROSS_SIZE / 2 + CROSS_CHAMFER);
    ctx.lineTo(x - CROSS_SIZE / 2 + CROSS_CHAMFER, y - CROSS_SIZE / 2);
    ctx.closePath();
    // ctx.fillStyle = textColor;
    // ctx.fill();
    ctx.strokeStyle = textColor;
    ctx.stroke();


    ctx.moveTo(x - CROSS_WIDTH / 2, y - CROSS_LENGTH /2);
    ctx.beginPath();
    ctx.lineTo(x - CROSS_WIDTH / 2, y - CROSS_LENGTH /2);
    ctx.lineTo(x + CROSS_WIDTH / 2, y - CROSS_LENGTH /2);
    ctx.lineTo(x + CROSS_WIDTH / 2, y - CROSS_WIDTH /2);
    ctx.lineTo(x + CROSS_LENGTH / 2, y - CROSS_WIDTH /2);
    ctx.lineTo(x + CROSS_LENGTH / 2, y + CROSS_WIDTH /2);
    ctx.lineTo(x + CROSS_LENGTH / 2, y + CROSS_WIDTH /2);
    ctx.lineTo(x + CROSS_WIDTH / 2, y + CROSS_WIDTH /2);
    ctx.lineTo(x + CROSS_WIDTH / 2, y + CROSS_LENGTH /2);
    ctx.lineTo(x - CROSS_WIDTH / 2, y + CROSS_LENGTH /2);
    ctx.lineTo(x - CROSS_WIDTH / 2, y + CROSS_WIDTH /2);
    ctx.lineTo(x - CROSS_LENGTH / 2, y + CROSS_WIDTH /2);
    ctx.lineTo(x - CROSS_LENGTH / 2, y - CROSS_WIDTH /2);
    ctx.lineTo(x - CROSS_WIDTH / 2, y - CROSS_WIDTH /2);
    ctx.lineTo(x - CROSS_WIDTH / 2, y - CROSS_WIDTH /2);
    ctx.closePath();
    // ctx.fillStyle = textColor;
    // ctx.fill();
    ctx.strokeStyle = textColor;
    ctx.stroke();
}

