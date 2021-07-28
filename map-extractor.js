// First part we load the file into the following array as just a big ol' bunch of HEX then call checkROM
var rawHex = []
var filename = '';
var vanillaWest = false;
var vanillaEast = false;
var vanillaDM = false;
var vanillaMaze = false;
var legacy = false;

$('#legacy').on('change',function(e){
    $("#modern").css('display', $(this).prop('checked') ? 'none' : 'inherit');
});

$('#file').on('change',function(e){
	rawHex = [];
	sprites = []; // CLear it out so we can easily re-change ROMs
	startAt = -1; // Needs to be reset, since the PRG length enevitable changes
	$('#output-container').html('<h3>Loading ROM...</h3>');
	vanillaWest = $("#vanillawest").prop('checked');
	vanillaEast = $("#vanillaeast").prop('checked');
	vanillaDM = $("#vanilladm").prop('checked');
	vanillaMaze = $("#vanillamaze").prop('checked');
	legacy = $("#legacy").prop('checked');
	var fileRead = new FileReader();
	filename = e.target.files[0].name;
	fileRead.onload = function(file){
		var buffer = new Uint8Array(fileRead.result);
		buffer.forEach(function(dec){
			rawHex.push(dec.toString(16).padStart(2,'0'));
		});
		checkROM();
	}
	fileRead.readAsArrayBuffer(e.target.files[0]);
});

// This function will check the headers to grab some data from it (PRG length, trainer Y/N that sorta thing) Once done it calls drawData
var romDetails = {}
function checkROM(){
	$('#output-container').html('<h3>Loading ROM data...</h3>');
	// First we can check the headers, NES roms always start the same way.
	if(rawHex[0]+rawHex[1]+rawHex[2]+rawHex[3]=='4e45531a'){ // "NES" and a DOS line break
		romDetails.valid = true;
	}else{
		romDetails.valid = false;
	}
	// New we check if the rom has a trainer, this is stored in byte 6 in a binary format
	var flags = parseInt(rawHex[6],16).toString('2').padStart('8','0');
	if(flags.substr(5,1)=='1'){
		romDetails.trainer = true;
	}else{
		romDetails.trainer = false;
	}
	// Get the PRG and CHR lengths, these are prepersented in the header as the number of 16384 or 8192 bytes respectivly.
	romDetails['PRGlength'] = parseInt(rawHex[4],16)*16384;
	romDetails['CHRlength'] = parseInt(rawHex[6],16)*8192;
	// And we might want a simple to reference total size
	romDetails['romLength'] = rawHex.length;
	// Finally output any error messages or, if there are none, call the draw function
	if(romDetails.valid){
		getMap();
	}else{
		$('#output-container').html('<h3>The uploaded file does not appear to be an NES rom.</h3>');
	}
}

// Load up the spritesheet image
var spritesheet = new Image();
spritesheet.src = "./zelda-2-overworld-sprites.png";
spritesheet.addEventListener("load",function(){
},false);

// This gets the maps and creates the image
var canvasSize = [0,0];
var cellSize = 16; //Square
function getMap(){
	var htmlMessage = ''; // This is used if there is a message to place above the ROM, like for ROMs missing CHR data

	// Make sure we got some rawHex to work with
	if(rawHex.length==0){
		return false;
		// Do nothing, they are changing color or something without a rom file
	}

	// Map Data starts at the following location
	maps = [
		{	id: 'west-hyrule',		name: 'West Hyrule',	legacyStart: '506C',    start: '7480',    vanillaSize: '0320',	vanilla: vanillaWest,	data:[]	},
		{	id: 'east-hyrule',		name: 'East Hyrule',	legacyStart: '9056',    start: 'B480',    vanillaSize: '0319',	vanilla: vanillaEast,	data:[]	},
		{	id: 'death-mountain',	name: 'Death Mountain',	legacyStart: '665C',    start: '7A00',    vanillaSize: '02E6',	vanilla: vanillaDM,		data:[]	},
		{	id: 'maze-island',		name: 'Maze Island',	legacyStart: 'A65C',    start: 'BA00',    vanillaSize: '02E6',	vanilla: vanillaMaze,	data:[]	},
	];
	maps.forEach(mapObj=>{
		if (legacy) {
		    mapObj.start = parseInt(mapObj.legacyStart, 16);
		    mapObj.end = mapObj.start + parseInt(mapObj.vanillaSize, 16);
		    mapObj.vanilla = true;
		} else {
		    mapObj.start = parseInt(mapObj.start, 16);
		    if (mapObj.vanilla)
		        mapObj.end = mapObj.start + parseInt(mapObj.vanillaSize, 16);
		    else
		        mapObj.end = mapObj.start + 1408;
		}
	});

	// Clear out the map area
	$('#output-container').html('');

	// Loop through each of the maps, creating new canvas for each one and filling it with the appropriate map data
	maps.forEach((mapObj,mapObjId) => {

		// Create a clear raw map array and start loading the map data into it
		var rawMap = [];
		for(var i = mapObj.start; i<mapObj.end; i++){
			hex = rawHex[i].split('');
			count = parseInt(hex[0],16)+1;
			while(count>0){
				mapObj.data.push(hex[1]);
				count--;
			}
		}

		// Pad out the rest of the map data with extra tiles
		var missing = 64-(mapObj.data.length%64)
		console.log(mapObj.name+' map data is not sqare, filling with '+missing+' tiles.')
		while(missing >0){
			mapObj.data.push(mapObj.vanilla ? 'c' : 'b')
			missing --
		}

		// Calculate the canvas size and get it ready for drawing
		if($('canvas#'+mapObj.id).length==0){
			canvasSize[0] = 64*cellSize; // Map is 64 pixels white, sprites are 16 pixels square
			canvasSize[1] = Math.ceil(mapObj.data.length/64)*cellSize
			if(canvasSize[1]==0){
				$('#output-container').html('Something has gone wrong and it looks like we have no map data.'); 
				return false;
			}else{
				$('#output-container').append('<p><canvas id="'+mapObj.id+'" width="'+canvasSize[0]+'" height="'+canvasSize[1]+'" class="canvas"/><br/><a href="#" class="'+mapObj.id+' download" download>Download '+mapObj.name+' Map</a></p>'); 
			}
		}
		var canvasEl = document.getElementById(mapObj.id);
		var canvas = canvasEl.getContext('2d');

		// Loop through the map data drawing it in
		mapObj.data.forEach((cellType,cellNum) => {
			yPos = Math.floor(cellNum/64)*cellSize;
			xPos = (cellNum%64)*cellSize
			switch(cellType){
				case '0': // Town
					canvas.drawImage(spritesheet,(cellSize*0),0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
				case '1': // Cave
					canvas.drawImage(spritesheet,(cellSize*1),0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
				case '2': // Palace
					canvas.drawImage(spritesheet,(cellSize*2),0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
				case '3': // Bridge
					canvas.drawImage(spritesheet,(cellSize*3),0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
				case '4': // Desert
					canvas.drawImage(spritesheet,(cellSize*4),0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
				case '5': // Grass
					canvas.drawImage(spritesheet,(cellSize*5) ,0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
				case '6': // Forest
					canvas.drawImage(spritesheet,(cellSize*6),0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
				case '7': // Swamp
					canvas.drawImage(spritesheet,(cellSize*7),0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
				case '8': // Graveyard
					canvas.drawImage(spritesheet,(cellSize*8),0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
				case '9': // Road
					canvas.drawImage(spritesheet,(cellSize*9),0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
				case 'a': // Lava
					canvas.drawImage(spritesheet,(cellSize*10),0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
				case 'b': // Mountain
					canvas.drawImage(spritesheet,(cellSize*11),0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
				case 'c': // Water
					canvas.drawImage(spritesheet,(cellSize*12),0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
				case 'd': // Water (walkable)
					canvas.drawImage(spritesheet,(cellSize*13),0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
				case 'e': // Rock
					canvas.drawImage(spritesheet,(cellSize*14),0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
				case 'f': // Spider
					canvas.drawImage(spritesheet,(cellSize*15),0,cellSize,cellSize,xPos,yPos,cellSize,cellSize);
				break;
			}
		})

		// Prep that download link
		var downloadName = mapObj.name+' Map (Zelda II).png';
		$('a.'+mapObj.id+'.download').attr('href',canvasEl.toDataURL()).attr('download',downloadName);

	})
}